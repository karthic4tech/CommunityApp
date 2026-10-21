import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { listing, listingId, places } from '../models/listing-test-fixtures';
import { DIRECTORY_PAGE_SIZE, ServiceDirectoryService } from './service-directory.service';
import { SupabaseService } from './supabase.service';

describe('ServiceDirectoryService', () => {
  const rpcReturns = vi.fn();
  const tableReturns = vi.fn();
  const maybeSingle = vi.fn();
  const select = vi.fn();
  const eq = vi.fn();
  const neq = vi.fn();
  const inFilter = vi.fn();
  const order = vi.fn();
  const range = vi.fn();
  const rpcOrder = vi.fn();
  const rpcRange = vi.fn();
  const rpc = vi.fn();
  const from = vi.fn();
  let service: ServiceDirectoryService;

  beforeEach(() => {
    vi.resetAllMocks();
    const tableQuery = { select, eq, neq, in: inFilter, order, range, returns: tableReturns, maybeSingle };
    const rpcQuery = { order: rpcOrder, range: rpcRange, returns: rpcReturns };
    for (const method of [select, eq, neq, inFilter, order, range]) method.mockReturnValue(tableQuery);
    rpcOrder.mockReturnValue(rpcQuery);
    rpcRange.mockReturnValue(rpcQuery);
    rpc.mockReturnValue(rpcQuery);
    from.mockReturnValue(tableQuery);
    rpcReturns.mockResolvedValue({ data: [{ id: listingId, category_id: 'child' }], error: null });
    tableReturns.mockResolvedValue({ data: [listing()], error: null });
    maybeSingle.mockResolvedValue({ data: null, error: null });
    TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: { client: { rpc, from } } }] });
    service = TestBed.inject(ServiceDirectoryService);
  });

  it('uses the existing RPC for filters, then enriches only its ids with public DB filters', async () => {
    const result = await service.search('parent', 'town', '  plumbing  ');
    expect(rpc).toHaveBeenCalledWith('directory_listings', { category: 'parent', location: 'town', keyword: 'plumbing' });
    expect(inFilter).toHaveBeenCalledWith('id', [listingId]);
    expect(eq).toHaveBeenCalledWith('status', 'published');
    expect(eq).toHaveBeenCalledWith('service_providers.verification_status', 'verified');
    expect(eq).toHaveBeenCalledWith('service_categories.is_active', true);
    expect(eq).toHaveBeenCalledWith('listing_contacts.is_public', true);
    expect(eq).toHaveBeenCalledWith('listing_media.media_assets.visibility', 'public');
    expect(select.mock.calls[0][0]).not.toContain('owner_user_id');
    expect(result.listings).toEqual([listing()]);
  });

  it('defensively excludes non-public rows returned by a malformed or over-broad response', async () => {
    const ids = [
      'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa1',
      'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa2',
      'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaa3',
    ];
    rpcReturns.mockResolvedValue({ data: ids.map(id => ({ id, category_id: 'child' })), error: null });
    tableReturns.mockResolvedValue({ data: [
      listing({ id: ids[0] }), listing({ id: ids[1], status: 'draft' }), listing({ id: ids[2], status: 'suspended' }),
    ], error: null });
    const result = await service.search('leaf', null, '');
    expect(result.listings).toEqual([listing({ id: ids[0] })]);
  });

  it('paginates with one RPC lookahead row and restores the RPC order after enrichment', async () => {
    const ids = Array.from({ length: DIRECTORY_PAGE_SIZE + 1 }, (_, index) => `aaaaaaaa-aaaa-4aaa-aaaa-${String(index + 1).padStart(12, '0')}`);
    rpcReturns.mockResolvedValue({ data: ids.map((id, index) => ({ id, category_id: 'child', published_at: `2026-01-${String(index + 1).padStart(2, '0')}` })), error: null });
    tableReturns.mockResolvedValue({ data: ids.slice().reverse().map((id, index) => listing({ id, title: `Service ${index}` })), error: null });
    const result = await service.search('parent', null, '', 1);
    expect(rpcRange).toHaveBeenCalledWith(12, 24);
    expect(result.listings).toHaveLength(12);
    expect(result.listings.map(item => item.id)).toEqual(ids.slice(0, 12));
    expect(result.hasMore).toBe(true);
    expect(rpcOrder).toHaveBeenCalledWith('id', { ascending: true });
  });

  it('surfaces query and network errors without exposing raw errors', async () => {
    rpcReturns.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'sensitive payload' } });
    await expect(service.search('parent', null, '')).rejects.toThrow('Unable to load service listings.');
    rpcReturns.mockRejectedValueOnce(new Error('offline'));
    await expect(service.search('parent', null, '')).rejects.toThrow();
  });

  it('loads a stable UUID detail with publication, category and public relation filters', async () => {
    maybeSingle.mockResolvedValueOnce({ data: listing(), error: null });
    expect(await service.detail(listingId)).toEqual(listing());
    expect(eq).toHaveBeenCalledWith('id', listingId);
    expect(eq).toHaveBeenCalledWith('status', 'published');
    expect(eq).toHaveBeenCalledWith('service_providers.verification_status', 'verified');
    expect(eq).toHaveBeenCalledWith('service_categories.is_active', true);
    maybeSingle.mockResolvedValueOnce({ data: listing({ status: 'archived' }), error: null });
    expect(await service.detail(listingId)).toBeNull();
    expect(await service.detail('not-a-uuid')).toBeNull();
  });

  it('reports detail errors and can read other published services for the same provider', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { code: '42501' } });
    await expect(service.detail(listingId)).rejects.toThrow('Unable to load this service listing.');
    tableReturns.mockResolvedValue({ data: [listing({ id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb' })], error: null });
    await expect(service.related(listing().service_providers.id, listingId)).resolves.toHaveLength(1);
    expect(eq).toHaveBeenCalledWith('provider_id', listing().service_providers.id);
    expect(neq).toHaveBeenCalledWith('id', listingId);
  });

  it('loads only active locations and reports location errors', async () => {
    tableReturns.mockResolvedValueOnce({ data: places, error: null });
    expect(await service.locations()).toEqual(places);
    expect(from).toHaveBeenCalledWith('locations');
    expect(eq).toHaveBeenCalledWith('is_active', true);
    tableReturns.mockResolvedValueOnce({ data: null, error: { code: '42501' } });
    await expect(service.locations()).rejects.toThrow('Unable to load locations.');
  });

  it('loads subsequent location pages instead of truncating the hierarchy', async () => {
    tableReturns.mockResolvedValueOnce({ data: Array.from({ length: 500 }, () => places[0]), error: null });
    tableReturns.mockResolvedValueOnce({ data: [places[1]], error: null });
    expect(await service.locations()).toHaveLength(501);
    expect(range).toHaveBeenLastCalledWith(500, 999);
  });

  it('accepts explicit HTTPS image URLs but does not guess missing buckets', () => {
    expect(service.imageUrl('https://example.com/photo.jpg')).toBe('https://example.com/photo.jpg');
    expect(service.imageUrl('photo.jpg')).toBeNull();
    expect(service.imageUrl('javascript:alert(1)')).toBeNull();
    expect(service.imageUrl('bucket/../private')).toBeNull();
  });
});
