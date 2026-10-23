import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { routes } from '../app.routes';
import { LanguageService } from '../core/services/language.service';
import { ServiceCategoryService } from '../core/services/service-category.service';
import { buildCategoryHierarchy } from '../core/models/service-category';
import { row } from '../core/models/category-test-fixtures';
import { ServiceDirectoryService } from '../core/services/service-directory.service';
import { AiServiceSearchService } from '../core/services/ai-service-search.service';

describe('Home and Services navigation', () => {
  const categories = signal(buildCategoryHierarchy([]));
  const loading = signal(false);
  const error = signal<string | null>(null);
  const refresh = vi.fn();
  const load = vi.fn();

  beforeEach(() => {
    categories.set([]);
    loading.set(false);
    error.set(null);
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [provideRouter(routes),
      { provide: ServiceCategoryService, useValue: { categories, loading, error, refresh, load } },
      { provide: ServiceDirectoryService, useValue: { locations: vi.fn().mockResolvedValue([]), search: vi.fn().mockResolvedValue({ listings: [], hasMore: false }) } },
      { provide: AiServiceSearchService, useValue: { search: vi.fn().mockResolvedValue({ listings: [], hasMore: false, mode: 'keyword', language: 'en', reason: null, intent: { category: null, location: null, keywords: '' } }) } },
    ] });
    TestBed.inject(LanguageService).setLanguage('en');
  });

  afterEach(() => TestBed.inject(LanguageService).setLanguage('ta'));

  it('renders the homepage and opens Services through navigation', async () => {
    const harness = await RouterTestingHarness.create('/');
    const element = harness.routeNativeElement!;
    expect(element.querySelector('h1')?.textContent).toContain('Everything you need');
    expect(element.querySelector('app-category-card')).toBeNull();
    expect(element.querySelector('.main-nav a[href="/admin/login"]')).not.toBeNull();
    const image = element.querySelector<HTMLImageElement>('.hero-image');
    expect(image?.getAttribute('src')).toBe('assets/images/chidambaram-hero.png');
    expect(image?.alt).toBe('Chidambaram temple, local streets and community');
    expect(image?.getAttribute('width')).toBe('1774');
    expect(image?.getAttribute('height')).toBe('887');
    expect(image?.getAttribute('loading')).toBe('eager');
    expect(image?.getAttribute('fetchpriority')).toBe('high');
    expect(element.querySelector('.temple')).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);
    element.querySelector<HTMLAnchorElement>('.main-nav a[href="/services"]')?.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(element.querySelector('app-services h1')?.textContent).toBe('Service categories');
    expect(element.querySelector('.main-nav a[aria-current="page"]')?.textContent).toContain('Services');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('renders nested categories and switches language on Services', async () => {
    categories.set(buildCategoryHierarchy([
      row('home', { name_ta: 'வீட்டு சேவைகள்', name_en: 'Home Services' }),
      row('child', { parent_id: 'home', name_ta: 'தச்சர் சேவை', name_en: 'Carpenter' }),
    ]));
    const harness = await RouterTestingHarness.create('/services');
    const element = harness.routeNativeElement!;
    expect(element.querySelector('app-category-card strong')?.textContent).toBe('Home Services');
    element.querySelector<HTMLAnchorElement>('app-category-card a')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(element.querySelector('app-service-category-page h1')?.textContent).toBe('Home Services');
    expect(element.querySelector('app-category-card strong')?.textContent).toBe('Carpenter');
    element.querySelector<HTMLButtonElement>('button[lang="ta"]')?.click();
    harness.detectChanges();
    expect(element.querySelector('app-service-category-page h1')?.textContent).toBe('வீட்டு சேவைகள்');
    expect(document.documentElement.lang).toBe('ta');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shows empty, loading and error states on Services with retry', async () => {
    const harness = await RouterTestingHarness.create('/services');
    const element = harness.routeNativeElement!;
    expect(element.querySelector('[role="status"]')?.textContent).toContain('No service categories');
    element.querySelector<HTMLButtonElement>('.state button')?.click();
    expect(refresh).toHaveBeenCalledTimes(1);
    loading.set(true);
    harness.detectChanges();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Loading');
    loading.set(false);
    error.set('error');
    harness.detectChanges();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Unable to load');
    element.querySelector<HTMLButtonElement>('.state button')?.click();
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('carries Home search to AI search while preserving category filtering on Services', async () => {
    categories.set(buildCategoryHierarchy([
      row('home', { name_en: 'Home Services' }),
      row('carpenter', { parent_id: 'home', name_en: 'Carpenter', name_ta: 'தச்சர்' }),
      row('medical', { name_en: 'Medical Services' }),
    ]));
    const harness = await RouterTestingHarness.create('/');
    const element = harness.routeNativeElement!;
    const input = element.querySelector<HTMLInputElement>('.hero-search input')!;
    input.value = 'carpenter';
    element.querySelector<HTMLFormElement>('.hero-search')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(element.querySelector('app-ai-service-search')).not.toBeNull();
    expect(element.querySelector<HTMLInputElement>('app-ai-service-search input')?.value).toBe('carpenter');
    expect(TestBed.inject(AiServiceSearchService).search).toHaveBeenCalledWith('carpenter', null, false);
    await harness.navigateByUrl('/services?q=தச்சர்');
    expect(element.querySelectorAll('.categories > app-category-card')).toHaveLength(1);
    await harness.navigateByUrl('/services?q=missing');
    expect(element.querySelector('[role="status"]')?.textContent).toContain('No matching services');
    element.querySelector<HTMLButtonElement>('.state button')?.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(element.querySelectorAll('.categories > app-category-card')).toHaveLength(2);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
