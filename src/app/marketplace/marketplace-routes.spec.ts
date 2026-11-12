import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { routes } from '../app.routes';
import { ServiceDirectoryService } from '../core/services/service-directory.service';
import { LanguageService } from '../core/services/language.service';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceCategory, MarketplaceListing } from './marketplace.models';

describe('Marketplace routes', () => {
  const search = vi.fn();
  const detailByRoute = vi.fn();
  const categories: MarketplaceCategory[] = [{
    id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa', parent_id: null, name: 'Mobiles & Tablets', name_ta: 'மொபைல்கள்',
    slug: 'mobiles-tablets', description: 'Phones and tablets', icon: 'bi bi-phone', sort_order: 10,
    attributes_schema: [], is_active: true, subcategories: [{
      id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb', parent_id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      name: 'Android Phones', name_ta: 'ஆண்ட்ராய்டு போன்கள்', slug: 'android-phones', description: null,
      icon: 'bi bi-phone', sort_order: 10, attributes_schema: [], is_active: true, subcategories: [],
    }],
  }];
  const item: MarketplaceListing = {
    id: 'listing-1', seller_id: 'seller-1', category_id: categories[0].id, subcategory_id: null,
    title: 'Indigo', slug: 'indigo', description: 'Community listing', price: 200000, is_negotiable: false,
    condition: 'gently_used', brand: null, model: null, location_id: 'location-1', seller_display_name: 'Local Seller',
    seller_contact_phone: null, contact_method: 'enquiry', seller_contact_consent: true, status: 'published',
    rejection_reason: null, is_featured: false, published_at: '2026-11-06T00:00:00Z', submitted_at: null,
    expires_at: null, sold_at: null, created_at: '2026-11-06T00:00:00Z', updated_at: '2026-11-06T00:00:00Z',
    location: { id: 'location-1', name_en: 'Chidambaram', name_ta: 'சிதம்பரம்' },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    search.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 12 });
    detailByRoute.mockResolvedValue(null);
    TestBed.configureTestingModule({ providers: [
      provideRouter(routes),
      { provide: MarketplaceService, useValue: { categories: vi.fn().mockResolvedValue(categories), search, detailByRoute, recentlyViewed: vi.fn().mockResolvedValue([]), rememberViewed: vi.fn(), hasAdminAccess: vi.fn().mockReturnValue(false), currentUserId: vi.fn().mockReturnValue(null) } },
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
    const categoryMenu = harness.routeNativeElement?.querySelector<HTMLDetailsElement>('.mp-category-disclosure');
    expect(categoryMenu?.open).toBe(false);
    categoryMenu?.querySelector<HTMLElement>('summary')?.click();
    harness.detectChanges();
    expect(categoryMenu?.open).toBe(true);
    expect(categoryMenu?.querySelector('.mp-category-tile strong')?.textContent).toBe('Mobiles & Tablets');
  });

  it('shows marketplace listings as cards that navigate to their detail page when clicked', async () => {
    search.mockResolvedValue({ items: [item], total: 1, page: 1, pageSize: 12 });
    detailByRoute.mockResolvedValue(item);
    const harness = await RouterTestingHarness.create('/marketplace');
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    await harness.fixture.whenStable();
    harness.detectChanges();

    const card = harness.routeNativeElement?.querySelector<HTMLElement>('.mp-card');
    const link = card?.querySelector<HTMLAnchorElement>('.mp-card-link');
    expect(card).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('/marketplace/item/listing-1/indigo');
    link?.click();
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(harness.routeNativeElement?.querySelector('app-marketplace-item-detail h1')?.textContent).toBe('Indigo');
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
