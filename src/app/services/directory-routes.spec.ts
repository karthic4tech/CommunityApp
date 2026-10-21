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

describe('Directory routes', () => {
  const search = vi.fn();
  const locations = vi.fn();
  const detail = vi.fn();
  const related = vi.fn();
  const imageUrl = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    search.mockResolvedValue({ listings: [listing()], hasMore: false });
    locations.mockResolvedValue(places);
    detail.mockResolvedValue(listing());
    related.mockResolvedValue([]);
    imageUrl.mockReturnValue(null);
    TestBed.configureTestingModule({ providers: [provideRouter(routes),
      { provide: ServiceCategoryService, useValue: {
        categories: signal(buildCategoryHierarchy([
          row('parent', { name_en: 'Home Services' }),
          row('child', { parent_id: 'parent', name_en: 'Plumber' }),
          row('sibling', { parent_id: 'parent', name_en: 'Electrician' }),
        ])),
        loading: signal(false), error: signal(null), load: vi.fn(), refresh: vi.fn(),
      } },
      { provide: ServiceDirectoryService, useValue: { search, locations, detail, related, imageUrl } },
    ] });
    TestBed.inject(LanguageService).setLanguage('en');
  });

  afterEach(() => TestBed.inject(LanguageService).setLanguage('ta'));

  async function settle(harness: RouterTestingHarness) {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  it('keeps parent and provider browsing as distinct levels', async () => {
    const harness = await RouterTestingHarness.create('/services/parent');
    await settle(harness);
    expect(search).not.toHaveBeenCalled();
    const child = harness.routeNativeElement!.querySelector<HTMLAnchorElement>('app-category-card a')!;
    expect(child.getAttribute('href')).toBe('/services/parent/child');
    child.click();
    await settle(harness);
    expect(search).toHaveBeenLastCalledWith('child', null, '', 0);
    expect(harness.routeNativeElement!.querySelector('app-listing-summary')?.textContent).toContain('Local Plumbing');
    expect(harness.routeNativeElement!.querySelector('app-category-card')).toBeNull();
  });

  it('restores keyword/location filters from URL and submits changes without losing the subcategory', async () => {
    const harness = await RouterTestingHarness.create('/services/parent/child?q=leaks&location=town');
    await settle(harness);
    expect(search).toHaveBeenLastCalledWith('child', 'town', 'leaks', 0);
    const element = harness.routeNativeElement!;
    const select = element.querySelector<HTMLSelectElement>('app-listing-directory select')!;
    expect(select.value).toBe('town');
    expect(select.textContent).toContain('Cuddalore / Chidambaram / Locality');
    select.value = 'locality';
    select.dispatchEvent(new Event('change'));
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
