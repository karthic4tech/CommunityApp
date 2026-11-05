import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { ServiceCategory } from '../core/models/service-category';
import { DirectoryLocation } from '../core/models/service-listing';
import { LanguageService } from '../core/services/language.service';
import { ServiceCategoryService } from '../core/services/service-category.service';
import { ServiceDirectoryService } from '../core/services/service-directory.service';
import { ServicesComponent } from './services.component';

describe('ServicesComponent advanced listing filters', () => {
  const categoryId = '11111111-1111-4111-8111-111111111111';
  const locationId = '22222222-2222-4222-8222-222222222222';
  const categoryRows: readonly ServiceCategory[] = [{
    id: categoryId,
    parentCategoryId: null,
    nameTamil: 'வீட்டு சேவைகள்',
    nameEnglish: 'Home Services',
    slug: 'home-services',
    description: null,
    icon: null,
    sortOrder: 1,
    subcategories: [],
  }];
  const categories = signal(categoryRows);
  const locations: DirectoryLocation[] = [{
    id: locationId,
    parent_id: null,
    name_ta: 'சிதம்பரம்',
    name_en: 'Chidambaram',
    location_type: 'town',
  }];
  const loadCategories = vi.fn();
  const refreshCategories = vi.fn();
  const directoryLocations = vi.fn().mockResolvedValue(locations);
  const directorySearch = vi.fn().mockResolvedValue({ listings: [], hasMore: false });

  beforeEach(() => {
    vi.clearAllMocks();
    categories.set(categoryRows);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'services', component: ServicesComponent }]),
        {
          provide: ServiceCategoryService,
          useValue: { categories, loading: signal(false), error: signal(null), load: loadCategories, refresh: refreshCategories },
        },
        {
          provide: ServiceDirectoryService,
          useValue: { locations: directoryLocations, search: directorySearch, imageUrl: vi.fn() },
        },
      ],
    });
    TestBed.inject(LanguageService).setLanguage('en');
  });

  afterEach(() => TestBed.inject(LanguageService).setLanguage('ta'));

  it('searches published listings directly with keyword, category, and location filters from the URL', async () => {
    const harness = await RouterTestingHarness.create(`/services?q=plumber&category=${categoryId}&location=${locationId}`);
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(directorySearch).toHaveBeenCalledWith(categoryId, locationId, 'plumber', 0);
    expect(harness.routeNativeElement?.querySelector('#listing-results-title')?.textContent).toContain('Matching services');
    expect(harness.routeNativeElement?.querySelector<HTMLInputElement>('#service-category-filter')?.value).toContain('Home Services');
    expect(harness.routeNativeElement?.querySelector<HTMLInputElement>('#service-location-filter')?.value).toContain('Chidambaram');
  });

  it('applies advanced filter controls through the query string', async () => {
    const harness = await RouterTestingHarness.create('/services');
    await harness.fixture.whenStable();
    harness.detectChanges();
    const element = harness.routeNativeElement!;
    const query = element.querySelector<HTMLInputElement>('#service-query')!;
    const category = element.querySelector<HTMLInputElement>('#service-category-filter')!;
    const location = element.querySelector<HTMLInputElement>('#service-location-filter')!;
    query.value = 'electrician';
    category.focus();
    category.value = 'Home';
    category.dispatchEvent(new Event('input', { bubbles:true }));
    harness.detectChanges();
    const categoryOption = Array.from(element.querySelectorAll<HTMLElement>('[role="option"]')).find(option => option.textContent?.includes('Home Services'));
    categoryOption?.click();
    location.focus();
    location.value = 'Chidambaram';
    location.dispatchEvent(new Event('input', { bubbles:true }));
    harness.detectChanges();
    const locationOption = Array.from(element.querySelectorAll<HTMLElement>('[role="option"]')).find(option => option.textContent?.includes('Chidambaram'));
    locationOption?.click();
    element.querySelector<HTMLFormElement>('.service-search')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await harness.fixture.whenStable();

    const url = TestBed.inject(Router).url;
    expect(url).toContain(`q=electrician`);
    expect(url).toContain(`category=${categoryId}`);
    expect(url).toContain(`location=${locationId}`);
    expect(directorySearch).toHaveBeenCalledWith(categoryId, locationId, 'electrician', 0);
  });

  it('uses the Chidambaram row from the locations query as the default search location', async () => {
    const harness = await RouterTestingHarness.create('/services');
    await harness.fixture.whenStable();
    harness.detectChanges();

    const element = harness.routeNativeElement!;
    const location = element.querySelector<HTMLInputElement>('#service-location-filter')!;
    expect(location.value).toContain('Chidambaram');
    expect(directorySearch).not.toHaveBeenCalled();

    element.querySelector<HTMLFormElement>('.service-search')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await harness.fixture.whenStable();
    expect(directorySearch).toHaveBeenCalledWith(null, locationId, '', 0);
  });
});
