import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ServiceCategoryService } from './service-category.service';
import { SupabaseService } from './supabase.service';
import { row } from '../models/category-test-fixtures';

describe('ServiceCategoryService', () => {
  const returns = vi.fn();
  const order = vi.fn();
  const eq = vi.fn();
  const select = vi.fn();
  const from = vi.fn();
  let service: ServiceCategoryService;

  beforeEach(() => {
    vi.resetAllMocks();
    const query = { select, eq, order, returns };
    from.mockReturnValue(query);
    select.mockReturnValue(query);
    eq.mockReturnValue(query);
    order.mockReturnValue(query);
    TestBed.configureTestingModule({ providers: [
      { provide: SupabaseService, useValue: { client: { from } } },
    ] });
    service = TestBed.inject(ServiceCategoryService);
  });

  it('queries active public columns, shares requests and caches until refresh', async () => {
    returns.mockResolvedValue({ data: [row('a')], error: null });
    const first = service.load();
    expect(service.loading()).toBe(true);
    expect(service.load()).toBe(first);
    await first;
    await service.load();
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith('service_categories');
    expect(eq).toHaveBeenCalledWith('is_active', true);
    expect(order).toHaveBeenCalledWith('sort_order', { ascending: true });
    expect(service.categories()[0].id).toBe('a');
    await service.refresh();
    expect(from).toHaveBeenCalledTimes(2);
  });

  it('handles errors and allows retry, including empty results', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    returns.mockResolvedValueOnce({ data: null, error: { code: '42501' } });
    await service.load();
    expect(service.error()).toBeTruthy();
    expect(service.loading()).toBe(false);
    returns.mockResolvedValueOnce({ data: [], error: null });
    await service.refresh();
    expect(service.error()).toBeNull();
    expect(service.categories()).toEqual([]);
    vi.restoreAllMocks();
  });
});
