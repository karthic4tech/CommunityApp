import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';
import { routes } from '../../app.routes';
import { AiServiceSearchService } from '../../core/services/ai-service-search.service';
import { ServiceDirectoryService } from '../../core/services/service-directory.service';
import { LanguageService } from '../../core/services/language.service';
import { listing } from '../../core/models/listing-test-fixtures';

describe('AI search page', () => {
  const search = vi.fn();
  const result = { mode: 'ai', reason: null, language: 'en', intent: { category: { id: 'category', slug: 'plumber', name_ta: 'பிளம்பர்', name_en: 'Plumber' }, location: null, keywords: '' }, listings: [listing()], hasMore: false };
  beforeEach(() => {
    vi.resetAllMocks();
    search.mockResolvedValue(result);
    TestBed.configureTestingModule({ providers: [provideRouter(routes),
      { provide: AiServiceSearchService, useValue: { search } },
      { provide: ServiceDirectoryService, useValue: { locations: vi.fn().mockResolvedValue([]), imageUrl: () => null } },
    ] });
    TestBed.inject(LanguageService).setLanguage('en');
  });
  afterEach(() => TestBed.inject(LanguageService).setLanguage('ta'));
  async function settle(harness: RouterTestingHarness) {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
    await harness.fixture.whenStable(); harness.detectChanges();
  }

  it('renders real listing components and interpreted intent; typing does not spend an AI request', async () => {
    const harness = await RouterTestingHarness.create('/service-search?q=need%20a%20plumber');
    await settle(harness);
    expect(search).toHaveBeenCalledWith('need a plumber', null, false);
    expect(harness.routeNativeElement!.textContent).toContain('Search interpreted as: · Plumber');
    expect(harness.routeNativeElement!.querySelector('app-listing-summary')?.textContent).toContain('Local Plumbing');
    const input = harness.routeNativeElement!.querySelector<HTMLInputElement>('app-ai-service-search input')!;
    input.value = 'electrician'; input.dispatchEvent(new Event('input'));
    await settle(harness);
    expect(search).toHaveBeenCalledTimes(1);
  });

  it('shows query errors, supports retry and explicit non-AI empty-result fallback', async () => {
    search.mockRejectedValueOnce(new Error('offline'));
    const harness = await RouterTestingHarness.create('/service-search?q=plumber');
    await settle(harness);
    expect(harness.routeNativeElement!.querySelector('[role="alert"]')?.textContent).toContain('Unable to search');
    harness.routeNativeElement!.querySelector<HTMLButtonElement>('app-ai-service-search .state button')!.click();
    await settle(harness);
    expect(search).toHaveBeenCalledTimes(2);
    search.mockResolvedValueOnce({ ...result, mode: 'keyword', listings: [] });
    const keywordButton = Array.from(harness.routeNativeElement!.querySelectorAll<HTMLButtonElement>('app-ai-service-search form button')).find(button => button.textContent?.includes('Keyword'))!;
    keywordButton.click(); await settle(harness);
    expect(search).toHaveBeenLastCalledWith('plumber', null, true);
    expect(TestBed.inject(Router).url).toContain('mode=keyword');
    expect(harness.routeNativeElement!.textContent).toContain('AI was not used');
    expect(harness.routeNativeElement!.textContent).toContain('No matching published services');
  });

  it('does not search on an empty page and ignores stale responses on navigation', async () => {
    const harness = await RouterTestingHarness.create('/service-search');
    await settle(harness); expect(search).not.toHaveBeenCalled();
    let finish!: (value: typeof result) => void;
    search.mockReturnValueOnce(new Promise<typeof result>(resolve => { finish = resolve; }));
    await harness.navigateByUrl('/service-search?q=old'); await settle(harness);
    expect(harness.routeNativeElement!.querySelector('app-ai-service-search [role="status"]')?.textContent).toContain('Searching');
    await harness.navigateByUrl('/service-search?q=new'); await settle(harness);
    finish({ ...result, listings: [listing({ title: 'Stale result' })] }); await settle(harness);
    expect(harness.routeNativeElement!.textContent).not.toContain('Stale result');
  });
});
