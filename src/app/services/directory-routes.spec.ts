import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { routes } from '../app.routes';
import { buildCategoryHierarchy } from '../core/models/service-category';
import { row } from '../core/models/category-test-fixtures';
import { listing, listingId, places } from '../core/models/listing-test-fixtures';
import { DirectoryPage } from '../core/models/service-listing';
import { LanguageService } from '../core/services/language.service';
import { ServiceCategoryService } from '../core/services/service-category.service';
import { ServiceDirectoryService } from '../core/services/service-directory.service';
import { EssentialServiceService } from '../core/services/essential-service.service';

describe('Directory routes', () => {
  const search = vi.fn();
  const searchEssential = vi.fn();
  const locations = vi.fn();
  const detail = vi.fn();
  const detailBySlug = vi.fn();
  const related = vi.fn();
  const imageUrl = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    search.mockResolvedValue({ listings: [listing()], hasMore: false });
    searchEssential.mockResolvedValue({ listings: [listing()], hasMore: false });
    locations.mockResolvedValue(places);
    detail.mockResolvedValue(listing());
    detailBySlug.mockResolvedValue(listing({ slug: 'plumbing-repairs-aaaaaaaa' }));
    related.mockResolvedValue([]);
    imageUrl.mockReturnValue(null);
    TestBed.configureTestingModule({ providers: [provideRouter(routes),
      { provide: ServiceCategoryService, useValue: {
        categories: signal(buildCategoryHierarchy([
          row('parent', { name_en: 'Home Services', icon_name: 'house', is_essential: true }),
          row('child', { parent_id: 'parent', name_en: 'Plumber', is_essential: true }),
          row('sibling', { parent_id: 'parent', name_en: 'Electrician' }),
        ])),
        loading: signal(false), error: signal(null), load: vi.fn(), refresh: vi.fn(),
        getEssentialCategories: vi.fn().mockResolvedValue(buildCategoryHierarchy([
          row('parent', { name_en: 'Home Services', icon_name: 'house', is_essential: true }),
          row('child', { parent_id: 'parent', name_en: 'Plumber', is_essential: true }),
        ])),
      } },
      { provide: ServiceDirectoryService, useValue: { search, searchEssential, locations, detail, detailBySlug, related, imageUrl } },
      { provide: EssentialServiceService, useValue: { getEssentialShortcuts: vi.fn().mockResolvedValue([{
        id: 'ambulance-shortcut', category_id: 'parent', subcategory_id: 'child', title: 'Ambulance', title_ta: 'ஆம்புலன்ஸ்',
        icon: 'bi bi-truck-front', display_order: 1, is_active: true, is_emergency: true,
        categorySlug: 'parent', categoryName: 'Home Services', categoryNameTamil: 'வீட்டு சேவைகள்',
        subcategorySlug: 'child', subcategoryName: 'Plumber', subcategoryNameTamil: 'தச்சர்', destination: '/services/parent/child',
      }]) } },
    ] });
    TestBed.inject(LanguageService).setLanguage('en');
  });

  afterEach(() => TestBed.inject(LanguageService).setLanguage('ta'));

  async function settle(harness: RouterTestingHarness) {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  it('serves the separate essential services discovery page using live categories and listings', async () => {
    const harness = await RouterTestingHarness.create('/essential-services');
    await settle(harness);
    const element = harness.routeNativeElement!;
    expect(element.querySelector('.essential-page')).not.toBeNull();
    expect(element.querySelector('h1')?.textContent).toContain('Everything Important. Just a Click Away.');
    expect(element.querySelectorAll('app-category-card')).toHaveLength(1);
    expect(element.textContent).toContain('Essential Services');

    expect(element.querySelector<HTMLAnchorElement>('.emergency-links a')?.getAttribute('href')).toBe('/services/parent/child');
    const query = element.querySelector<HTMLInputElement>('#essential-query')!;
    query.value = 'ambulance';
    element.querySelector<HTMLFormElement>('.essential-search')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle(harness);
    expect(searchEssential).toHaveBeenLastCalledWith(null, 'town', 'ambulance', 0);
  });

  it('keeps parent and provider browsing as distinct levels', async () => {
    const harness = await RouterTestingHarness.create('/services/parent');
    await settle(harness);
    expect(search).not.toHaveBeenCalled();
    const child = harness.routeNativeElement!.querySelector<HTMLAnchorElement>('app-category-card a')!;
    expect(child.getAttribute('href')).toBe('/services/parent/child');
    child.click();
    await settle(harness);
    expect(search).toHaveBeenLastCalledWith('child', 'town', '', 0);
    expect(harness.routeNativeElement!.querySelector('app-listing-summary')?.textContent).toContain('Local Plumbing');
    expect(harness.routeNativeElement!.querySelector('app-category-card')).toBeNull();
  });

  it('supports the explicit category URL without replacing the legacy category route', async () => {
    const harness = await RouterTestingHarness.create('/services/category/parent');
    await settle(harness);
    expect(harness.routeNativeElement?.querySelector('app-service-category-page h1')?.textContent).toBe('Home Services');
    expect(harness.routeNativeElement?.querySelector('.breadcrumbs a')?.getAttribute('href')).toBe('/services');
  });

  it('filters dynamic subcategories by the selected-language name', async () => {
    const harness = await RouterTestingHarness.create('/services/parent');
    await settle(harness);
    const element = harness.routeNativeElement!;
    expect(element.querySelectorAll('.subcategories app-category-card')).toHaveLength(2);
    expect(element.querySelector('.subcategories .marketplace-card .icon i')?.className).toContain('bi-house-heart');

    const searchInput = element.querySelector<HTMLInputElement>('#subcategory-search')!;
    searchInput.value = 'plumb';
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    harness.detectChanges();

    expect(element.querySelectorAll('.subcategories app-category-card')).toHaveLength(1);
    expect(element.querySelector('.subcategories')?.textContent).toContain('Plumber');
  });

  it('restores keyword/location filters from URL and submits changes without losing the subcategory', async () => {
    const harness = await RouterTestingHarness.create('/services/parent/child?q=leaks&location=town');
    await settle(harness);
    expect(search).toHaveBeenLastCalledWith('child', 'town', 'leaks', 0);
    const element = harness.routeNativeElement!;
    const select = element.querySelector<HTMLInputElement>('#directory-location')!;
    expect(select.value).toContain('Chidambaram');
    select.focus();
    select.value = 'Locality';
    select.dispatchEvent(new Event('input', { bubbles:true }));
    harness.detectChanges();
    const localityOption = Array.from(element.querySelectorAll<HTMLElement>('[role="option"]')).find(option => option.textContent?.includes('Locality'));
    localityOption?.click();
    const input = element.querySelector<HTMLInputElement>('app-listing-directory input')!;
    input.value = 'maintenance';
    input.dispatchEvent(new Event('input'));
    element.querySelector<HTMLFormElement>('app-listing-directory form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle(harness);
    expect(search).toHaveBeenLastCalledWith('child', 'locality', 'maintenance', 0);
    expect(TestBed.inject(Router).url).toContain('location=locality');
    expect(locations).toHaveBeenCalledTimes(1);
    await harness.navigateByUrl('/services/parent/child?q=maintenance&location=locality&page=2');
    await settle(harness);
    expect(search).toHaveBeenLastCalledWith('child', 'locality', 'maintenance', 1);
  });

  it('shows loading, then query error with retry, then empty results', async () => {
    let reject!: (error: Error) => void;
    search.mockReturnValueOnce(new Promise<DirectoryPage>((_, fail) => { reject = fail; }));
    const harness = await RouterTestingHarness.create('/services/parent/child');
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('app-listing-directory [role="status"]')?.textContent).toContain('Loading');
    reject(new Error('offline'));
    await settle(harness);
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')?.textContent).toContain('Unable to load');
    search.mockResolvedValueOnce({ listings: [], hasMore: false });
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('app-listing-directory .state button')!.click();
    await settle(harness);
    expect(harness.routeNativeElement!.querySelector('app-listing-directory [role="status"]')?.textContent).toContain('No matching published services');
    expect(search).toHaveBeenCalledTimes(2);
  });

  it('retries location failures and rejects unknown locations rather than silently broadening the search', async () => {
    locations.mockRejectedValueOnce(new Error('offline'));
    const harness = await RouterTestingHarness.create('/services/parent/child');
    await settle(harness);
    expect(search).not.toHaveBeenCalled();
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('app-listing-directory .state button')!.click();
    await settle(harness);
    expect(search).toHaveBeenCalledTimes(1);
    await harness.navigateByUrl('/services/parent/child?location=unknown');
    await settle(harness);
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')).not.toBeNull();
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('ignores stale responses after navigating to another subcategory', async () => {
    let resolve!: (page: DirectoryPage) => void;
    search.mockReturnValueOnce(new Promise<DirectoryPage>(done => { resolve = done; }));
    const harness = await RouterTestingHarness.create('/services/parent/child');
    await settle(harness);
    await harness.navigateByUrl('/services/parent/sibling');
    await settle(harness);
    resolve({ listings: [listing({ title: 'Stale parent response' })], hasMore: false });
    await settle(harness);
    expect(harness.routeNativeElement!.textContent).not.toContain('Stale parent response');
    expect(harness.routeNativeElement!.textContent).toContain('Plumbing repairs');
  });

  it('opens a stable detail URL and offers only valid, public call/enquiry actions', async () => {
    detail.mockResolvedValueOnce(listing({ listing_locations: [{ coverage_type: 'based_here', locations: places[1] }], listing_contacts: [
      { contact_type: 'phone', contact_value: '+91 98765 43210', is_public: true, sort_order: 0 },
      { contact_type: 'email', contact_value: 'hello@example.com', is_public: true, sort_order: 1 },
      { contact_type: 'phone', contact_value: '+919999999999', is_public: false, sort_order: 2 },
      { contact_type: 'website', contact_value: 'javascript:alert(1)', is_public: true, sort_order: 3 },
    ] }));
    const harness = await RouterTestingHarness.create(`/providers/${listingId}`);
    await settle(harness);
    const element = harness.routeNativeElement!;
    expect(detail).toHaveBeenCalledWith(listingId);
    expect(element.querySelector('app-listing-summary h1')?.textContent).toBe('Local Plumbing');
    expect(element.querySelector('a[href="tel:+919876543210"]')).not.toBeNull();
    expect(element.querySelector('a[href="mailto:hello@example.com"]')?.textContent).toContain('Enquire');
    expect(element.textContent).toContain('Chidambaram');
    expect(element.textContent).not.toContain('+919999999999');
    expect(element.querySelector('a[href^="javascript:"]')).toBeNull();
  });

  it('resolves listing slugs at /services/:slug while preserving the provider-id route', async () => {
    const harness = await RouterTestingHarness.create('/services/plumbing-repairs-aaaaaaaa');
    await settle(harness);
    expect(detailBySlug).toHaveBeenCalledWith('plumbing-repairs-aaaaaaaa');
    expect(harness.routeNativeElement?.querySelector('app-listing-summary h1')?.textContent).toBe('Local Plumbing');
  });

  it('distinguishes detail errors from not-found and allows retry', async () => {
    detail.mockRejectedValueOnce(new Error('offline'));
    const harness = await RouterTestingHarness.create(`/providers/${listingId}`);
    await settle(harness);
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')?.textContent).toContain('Unable to load');
    detail.mockResolvedValueOnce(null);
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('app-provider-detail button')!.click();
    await settle(harness);
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent).toBe('Service not found');
  });

  it('shows a graceful not-found state for an invalid category/subcategory relationship', async () => {
    const harness = await RouterTestingHarness.create('/services/child/parent');
    await settle(harness);
    expect(search).not.toHaveBeenCalled();
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent).toBe('Service not found');
  });

  it('does not query listings for an unknown category', async () => {
    const harness = await RouterTestingHarness.create('/services/missing');
    await settle(harness);
    expect(search).not.toHaveBeenCalled();
    expect(harness.routeNativeElement!.querySelector('h1')?.textContent).toBe('Service category not found');
  });
});
