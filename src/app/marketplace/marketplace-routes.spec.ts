import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { routes } from '../app.routes';
import { ServiceDirectoryService } from '../core/services/service-directory.service';
import { LanguageService } from '../core/services/language.service';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceCategory } from './marketplace.models';

describe('Marketplace routes', () => {
  const search = vi.fn();
  const categories: MarketplaceCategory[] = [{
    id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', parent_id: null, name: 'Mobiles & Tablets', name_ta: 'மொபைல்கள்',
    slug: 'mobiles-tablets', description: 'Phones and tablets', icon: 'bi bi-phone', sort_order: 10,
    attributes_schema: [], is_active: true, subcategories: [{
      id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', parent_id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      name: 'Android Phones', name_ta: 'ஆண்ட்ராய்டு போன்கள்', slug: 'android-phones', description: null,
      icon: 'bi bi-phone', sort_order: 10, attributes_schema: [], is_active: true, subcategories: [],
    }],
  }];

  beforeEach(() => {
    vi.resetAllMocks();
    search.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 12 });
    TestBed.configureTestingModule({ providers: [
      provideRouter(routes),
      { provide: MarketplaceService, useValue: { categories: vi.fn().mockResolvedValue(categories), search, recentlyViewed: vi.fn().mockResolvedValue([]), currentUserId: vi.fn().mockReturnValue(null) } },
      { provide: ServiceDirectoryService, useValue: { locations: vi.fn().mockResolvedValue([]) } },
    ] });
    TestBed.inject(LanguageService).setLanguage('en');
  });

  afterEach(() => TestBed.inject(LanguageService).setLanguage('ta'));

  it('renders the independent marketplace route and working sell action', async () => {
    const harness = await RouterTestingHarness.create('/marketplace');
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Buy & Sell Locally');
    expect(harness.routeNativeElement?.querySelector<HTMLAnchorElement>('a[href="/marketplace/sell"]')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('.mp-category-tile strong')?.textContent).toBe('Mobiles & Tablets');
  });

  it('loads category listings with root and subcategory IDs from Supabase categories', async () => {
    const harness = await RouterTestingHarness.create('/marketplace/category/android-phones');
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Android Phones');
    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({
      categoryId: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      subcategoryId: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
    }));
  });
});
