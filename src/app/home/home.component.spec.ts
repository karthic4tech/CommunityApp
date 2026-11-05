import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
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
import { EssentialServiceService } from '../core/services/essential-service.service';
import { AuthService } from '../core/auth/auth.service';

describe('Home and Services navigation', () => {
  const categories = signal(buildCategoryHierarchy([]));
  const loading = signal(false);
  const error = signal<string | null>(null);
  const refresh = vi.fn();
  const load = vi.fn();
  const authLoading = signal(false);
  const authenticated = signal(false);
  const authenticatedUser = signal({ email: 'member@example.com', user_metadata: { full_name: 'Community Member' } });
  const signOut = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    categories.set([]);
    loading.set(false);
    error.set(null);
    authLoading.set(false);
    authenticated.set(false);
    signOut.mockClear();
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [provideRouter(routes),
      { provide: ServiceCategoryService, useValue: { categories, loading, error, refresh, load, getEssentialCategories: vi.fn().mockResolvedValue([]) } },
      { provide: ServiceDirectoryService, useValue: { locations: vi.fn().mockResolvedValue([]), search: vi.fn().mockResolvedValue({ listings: [], hasMore: false }), searchEssential: vi.fn().mockResolvedValue({ listings: [], hasMore: false }) } },
      { provide: AiServiceSearchService, useValue: { search: vi.fn().mockResolvedValue({ listings: [], hasMore: false, mode: 'keyword', language: 'en', reason: null, intent: { category: null, location: null, keywords: '' } }) } },
      { provide: EssentialServiceService, useValue: { getEssentialShortcuts: vi.fn().mockResolvedValue([]) } },
      { provide: AuthService, useValue: { loading: authLoading, isAuthenticated: authenticated, user: authenticatedUser, signOut } },
    ] });
    TestBed.inject(LanguageService).setLanguage('en');
  });

  afterEach(() => TestBed.inject(LanguageService).setLanguage('ta'));

  it('makes the homepage All Services and Essential Services actions navigate to separate routes', async () => {
    const harness = await RouterTestingHarness.create('/');
    const element = harness.routeNativeElement!;
    expect(element.querySelector<HTMLAnchorElement>('.service-actions a[href="/services"]')).not.toBeNull();
    expect(element.querySelector<HTMLAnchorElement>('.service-actions a[href="/essential-services"]')).not.toBeNull();
    expect(element.querySelector<HTMLAnchorElement>('.main-nav a[href="/services"]')).not.toBeNull();
    expect(element.querySelector<HTMLAnchorElement>('.main-nav a[href="/essential-services"]')).not.toBeNull();
    element.querySelector<HTMLAnchorElement>('.service-actions a[href="/services"]')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/services');
    expect(element.querySelector('app-all-services h1')?.textContent).toContain('Explore Services Across Your Community');
    await harness.navigateByUrl('/');
    harness.routeNativeElement!.querySelector<HTMLAnchorElement>('.service-actions a[href="/essential-services"]')!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/essential-services');
    expect(element.querySelector('app-essential-services h1')?.textContent).toContain('Everything Important. Just a Click Away.');
  });

  it('shows sign-in and sign-up for visitors and a greeting for signed-in members', async () => {
    const harness = await RouterTestingHarness.create('/');
    const element = harness.routeNativeElement!;
    expect(element.querySelector<HTMLAnchorElement>('.header-auth-actions a[href="/auth/sign-in"]')?.textContent).toContain('Sign in');
    expect(element.querySelector<HTMLAnchorElement>('.header-auth-actions a[href="/auth/sign-up"]')?.textContent).toContain('Sign up');

    authenticated.set(true);
    harness.detectChanges();
    expect(element.querySelector<HTMLAnchorElement>('.header-auth-actions a.header-user')?.textContent).toContain('Hi, Community Member');
    expect(element.querySelector<HTMLButtonElement>('.header-auth-actions button.header-sign-out')?.textContent).toContain('Sign out');
    expect(element.querySelector<HTMLAnchorElement>('.header-auth-actions a.header-sign-in')).toBeNull();
    expect(element.querySelector<HTMLAnchorElement>('.header-auth-actions a.header-sign-up')).toBeNull();
    element.querySelector<HTMLButtonElement>('.header-auth-actions button.header-sign-out')!.click();
    await harness.fixture.whenStable();
    expect(signOut).toHaveBeenCalledTimes(1);
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

  it('keeps All Services category search connected to the active dynamic hierarchy', async () => {
    categories.set(buildCategoryHierarchy([
      row('home', { name_en: 'Home Services' }),
      row('carpenter', { parent_id: 'home', name_en: 'Carpenter', name_ta: 'தச்சர்' }),
      row('medical', { name_en: 'Medical Services' }),
    ]));
    const harness = await RouterTestingHarness.create('/services?q=தச்சர்');
    const element = harness.routeNativeElement!;
    expect(element.querySelectorAll('.categories app-category-card')).toHaveLength(1);
    await harness.navigateByUrl('/services?q=missing');
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('No matching services');
    element.querySelector<HTMLButtonElement>('.state button')?.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(element.querySelectorAll('.categories app-category-card')).toHaveLength(2);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
