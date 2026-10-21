import { TestBed } from '@angular/core/testing';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { AiServiceSearchService } from './ai-service-search.service';
import { ServiceDirectoryService } from './service-directory.service';
import { SupabaseService } from './supabase.service';
import { listing } from '../models/listing-test-fixtures';

describe('AiServiceSearchService', () => {
  const invoke = vi.fn();
  const search = vi.fn();
  let service: AiServiceSearchService;
  const response = { mode: 'ai', reason: null, language: 'en', intent: { category: null, location: null, keywords: '' }, listings: [listing()], hasMore: false };

  beforeEach(() => {
    vi.resetAllMocks();
    invoke.mockResolvedValue({ data: response, error: null });
    search.mockResolvedValue({ listings: [listing()], hasMore: false });
    TestBed.configureTestingModule({ providers: [
      { provide: SupabaseService, useValue: { client: { functions: { invoke } } } },
      { provide: ServiceDirectoryService, useValue: { search } },
    ] });
    service = TestBed.inject(AiServiceSearchService);
  });

  for (const query of ['I need a plumber in Chidambaram', 'சிதம்பரத்தில் பிளம்பர் தேவை']) {
    it(`invokes the function for ${query}`, async () => {
      expect((await service.search(query, null)).mode).toBe('ai');
      expect(invoke).toHaveBeenCalledWith('ai-service-search', { body: { query, location: null }, timeout: 20_000 });
      expect(search).not.toHaveBeenCalled();
    });
  }

  it('rejects invalid input before invoking the function', async () => {
    for (const query of ['', 'x', 'x'.repeat(201), 'plum\nber']) {
      await expect(service.search(query, null)).rejects.toThrow('Invalid search query');
    }
    expect(invoke).not.toHaveBeenCalled();
  });

  it('uses the existing RLS-scoped RPC on API failure and for explicit keyword mode', async () => {
    invoke.mockRejectedValueOnce(new Error('network'));
    const result = await service.search('plumber', null);
    expect(result.mode).toBe('keyword');
    expect(search).toHaveBeenCalledWith(null, null, 'plumber');
    invoke.mockClear();
    await service.search('plumber', null, true);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('preserves server fallback and empty results, and filters non-public rows defensively', async () => {
    invoke.mockResolvedValueOnce({ data: { ...response, mode: 'keyword', listings: [] }, error: null });
    expect((await service.search('plumber', null)).listings).toEqual([]);
    expect(search).not.toHaveBeenCalled();
    invoke.mockResolvedValueOnce({ data: { ...response, listings: [listing(), listing({ status: 'draft' })] }, error: null });
    expect((await service.search('plumber', null)).listings).toHaveLength(1);
  });

  it('does not downgrade authorization or validation failures into fallback', async () => {
    for (const status of [400, 401, 403]) {
      invoke.mockResolvedValueOnce({ data: null, error: new FunctionsHttpError(new Response(null, { status })) });
      await expect(service.search('plumber', null)).rejects.toThrow('Search rejected');
    }
    expect(search).not.toHaveBeenCalled();
  });

  it('does not broaden invalid location fallback and exposes fallback failures for retry', async () => {
    await expect(service.search('plumber', 'unknown', true)).rejects.toThrow('Select a location');
    expect(search).not.toHaveBeenCalled();
    search.mockRejectedValueOnce(new Error('offline'));
    await expect(service.search('plumber', null, true)).rejects.toThrow('offline');
  });
});
