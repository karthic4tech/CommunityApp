import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { LocalBrandService } from './local-brand.service';
import { MediaService } from './media.service';
import { SupabaseService } from './supabase.service';

const activeListing = {
  id: 'listing-new',
  status: 'published',
  published_at: '2026-10-31T12:00:00Z',
  service_categories: { is_active: true },
};

const publicLogo = {
  storage_path: 'cdm360-public-media/businesses/provider-1/logo.webp',
  bucket_name: 'cdm360-public-media',
  visibility: 'public',
  media_type: 'image',
  upload_status: 'uploaded',
  deleted_at: null,
  alt_text: 'Business logo',
};

const featuredProvider = {
  id: 'provider-1',
  display_name: 'Local Brand One',
  provider_type: 'business',
  verification_status: 'verified',
  is_featured: true,
  feature_order: 2,
  service_listings: [activeListing],
  provider_media: [{ role: 'logo', sort_order: 0, is_primary: true, media_assets: publicLogo }],
};

describe('LocalBrandService', () => {
  const rows = [
    featuredProvider,
    { ...featuredProvider, service_listings: [{ ...activeListing, id: 'listing-older', published_at: '2025-01-01T00:00:00Z' }] },
    {
      ...featuredProvider,
      id: 'provider-2',
      display_name: 'Brand Without Logo',
      feature_order: 1,
      provider_media: [{ role: 'logo', sort_order: 0, is_primary: true, media_assets: { ...publicLogo, visibility: 'private' } }],
    },
    { ...featuredProvider, id: 'provider-3', display_name: 'Unverified Brand', verification_status: 'pending', feature_order: 0 },
  ];
  let filterCalls: unknown[][];

  beforeEach(() => {
    filterCalls = [];
    const chain: Record<string, (...args: unknown[]) => unknown> = {};
    chain['select'] = vi.fn(() => chain);
    chain['eq'] = vi.fn((...args: unknown[]) => { filterCalls.push(args); return chain; });
    chain['is'] = vi.fn((...args: unknown[]) => { filterCalls.push(args); return chain; });
    chain['order'] = vi.fn(() => chain);
    chain['range'] = vi.fn(() => chain);
    chain['returns'] = vi.fn(async () => ({ data: rows, error: null }));

    TestBed.configureTestingModule({ providers: [
      LocalBrandService,
      { provide: SupabaseService, useValue: { client: { from: vi.fn(() => chain) } } },
      { provide: MediaService, useValue: { getPublicUrl: vi.fn((path: string) => `https://cdn.example/${path}`) } },
    ] });
  });

  it('filters for featured verified businesses and deduplicates providers with eligible listings', async () => {
    const service = TestBed.inject(LocalBrandService);
    const brands = await service.featuredBusinesses();

    expect(filterCalls).toContainEqual(['provider_type', 'business']);
    expect(filterCalls).toContainEqual(['verification_status', 'verified']);
    expect(filterCalls).toContainEqual(['is_featured', true]);
    expect(filterCalls).toContainEqual(['service_listings.status', 'published']);
    expect(brands.map((brand) => brand.id)).toEqual(['provider-2', 'provider-1']);
    expect(brands[0].logoUrl).toBeNull();
    expect(brands[1].logoUrl).toBe('https://cdn.example/cdm360-public-media/businesses/provider-1/logo.webp');
    expect(brands[1].listingId).toBe('listing-new');
  });
});
