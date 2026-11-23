import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ServiceCategoryRow } from '../core/models/service-category';
import { LanguageService } from '../core/services/language.service';
import { ServiceCategoryService } from '../core/services/service-category.service';
import { ServiceDirectoryService } from '../core/services/service-directory.service';
import { TourismComponent } from './tourism.component';

const categoryRow = (id: string, slug: string, parent_id: string | null = null): ServiceCategoryRow => ({
  id, slug, parent_id, name_en: slug, name_ta: slug, description: null, icon_name: null, sort_order: 1, is_active: true,
});

describe('TourismComponent', () => {
  const search = vi.fn();
  const serviceCategories = signal([
    { ...categoryRow('food', 'food-restaurant-services'), subcategories: [
      { ...categoryRow('hotels', 'hotels', 'food'), subcategories: [] },
      { ...categoryRow('restaurants', 'restaurants', 'food'), subcategories: [] },
      { ...categoryRow('veg', 'vegetarian-restaurants', 'food'), subcategories: [] },
      { ...categoryRow('nonveg', 'non-vegetarian-restaurants', 'food'), subcategories: [] },
      { ...categoryRow('mess', 'mess-tiffin-services', 'food'), subcategories: [] },
    ] },
  ]);

  beforeEach(() => {
    vi.resetAllMocks();
    search.mockResolvedValue({ listings: [], hasMore: false });
    TestBed.configureTestingModule({
      imports: [TourismComponent],
      providers: [
        provideRouter([]),
        { provide: ServiceCategoryService, useValue: { categories: serviceCategories, load: vi.fn().mockResolvedValue(undefined) } },
        { provide: ServiceDirectoryService, useValue: { search } },
      ],
    });
    TestBed.inject(LanguageService).setLanguage('en');
  });

  afterEach(() => TestBed.inject(LanguageService).setLanguage('ta'));

  it('presents the primary visitor journeys and the visitor sections', async () => {
    const fixture = TestBed.createComponent(TourismComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toContain('Temple-town heritage');
    expect(element.querySelector('a[href="/services/food-restaurant-services/hotels"]')?.textContent).toContain('Find a Stay');
    expect(element.querySelector('a[href="#itinerary"]')?.textContent).toContain('Plan My Visit');
    expect(element.querySelector('#temple-guide')).not.toBeNull();
    expect(element.querySelector('#attractions')).not.toBeNull();
    expect(element.querySelector('#travel-essentials')).not.toBeNull();
    expect(element.querySelector('a[href^="https://wa.me/919514636355?text="]')).not.toBeNull();
    fixture.destroy();
  });

  it('opens Hotels & stays by default when the Tourism page loads', async () => {
    const fixture = TestBed.createComponent(TourismComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.tourism-menu-toggle')).toBeNull();
    expect(element.querySelectorAll('#tourism-menu a')).toHaveLength(5);
    expect((element.querySelector('#tourism-menu') as HTMLElement).hidden).toBe(false);
    expect(element.querySelector('.inline-listing-results h3')?.textContent).toContain('Hotels & stays');
    expect(element.querySelector('.browse-all-stays')?.getAttribute('href')).toBe('/services/food-restaurant-services/hotels');
    expect(element.querySelector('.browse-all-stays')?.textContent).toContain('Browse all hotel listings');
    expect(element.querySelector('.dining-inline h3')?.textContent).toContain('Food & dining');
    expect(element.querySelector('.local-listings-layout')?.children).toHaveLength(2);
    expect(element.querySelector('.inline-listing-close')).not.toBeNull();
    fixture.destroy();
  });

  it('loads inline hotel and dining listings from existing public service categories', async () => {
    const fixture = TestBed.createComponent(TourismComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(search).toHaveBeenCalledWith('hotels', null, '', 0);
    expect(search).not.toHaveBeenCalledWith('cab', null, '', 0);
    expect(search).not.toHaveBeenCalledWith('auto', null, '', 0);
    expect(search).toHaveBeenCalledWith('restaurants', null, '', 0);
    expect(fixture.nativeElement.textContent).toContain('No public stay listings are available yet.');
    fixture.destroy();
  });
});
