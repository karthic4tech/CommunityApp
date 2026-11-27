import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, InjectionToken, isDevMode, PLATFORM_ID, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

export type AnalyticsEvent =
  | 'service_listing_view'
  | 'service_contact_click'
  | 'service_search'
  | 'tourism_page_view'
  | 'hotel_listing_view'
  | 'hotel_enquiry_submitted'
  | 'cab_enquiry_submitted'
  | 'advertisement_impression'
  | 'advertisement_click'
  | 'job_listing_view'
  | 'job_contact_click'
  | 'service_registration_completed'
  | 'booking_confirmed';

export type ContactMethod = 'phone' | 'whatsapp' | 'email' | 'website' | 'other';
export type ContentLanguage = 'en' | 'ta';
export type AnalyticsConsent = 'unknown' | 'granted' | 'denied';

/** Only reviewed, non-sensitive event parameters are representable. */
export interface AnalyticsEventParameters {
  readonly service_category?: string;
  readonly public_listing_id?: string;
  readonly public_job_id?: string;
  readonly contact_method?: ContactMethod;
  readonly advertisement_id?: string;
  readonly advertisement_position?: number;
  readonly page_section?: string;
  readonly content_language?: ContentLanguage;
  readonly result_count?: number;
}

export interface AnalyticsConfig {
  readonly tagManagerId: string;
  readonly measurementId: string;
  readonly productionOrigin: string;
  readonly production: boolean;
}

export const ANALYTICS_CONFIG = new InjectionToken<AnalyticsConfig>('CDM360_ANALYTICS_CONFIG', {
  providedIn: 'root',
  factory: () => ({
    tagManagerId: environment.googleTagManagerId,
    measurementId: environment.googleAnalyticsMeasurementId,
    productionOrigin: environment.googleAnalyticsProductionOrigin,
    production: !isDevMode(),
  }),
});

type GtagCommand = (...args: unknown[]) => void;
type TagManagerWindow = Window & {
  dataLayer?: unknown[];
  gtag?: GtagCommand;
};

const CONSENT_STORAGE_KEY = 'cdm360.analytics-consent.v1';
const TAG_MANAGER_ID_PATTERN = /^GTM-[A-Z0-9]+$/;
const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{6,}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LANDING_PAGE_TITLES: Readonly<Record<string, string>> = {
  '/': 'Local Services & Businesses in Chidambaram | CDM 360',
  '/services': 'Local Services in Chidambaram | CDM 360',
  '/businesses': 'Local Businesses in Chidambaram | CDM 360',
  '/tourism': 'Chidambaram Travel Guide, Stays & Local Services | CDM 360',
  '/essential-services': 'Essential Local Services in Chidambaram | CDM 360',
  '/jobs': 'Jobs in Chidambaram | CDM 360',
};

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly config = inject(ANALYTICS_CONFIG);
  private readonly browser = isPlatformBrowser(this.platformId);
  private readonly consentState = signal<AnalyticsConsent>(this.readStoredConsent());
  private readonly publicPageState = signal(false);
  private readonly privacySettingsOpen = signal(false);
  private readonly publicEventsThisNavigation = new Set<string>();
  private gtmInitialized = false;
  private currentPath = '/';
  private previousPublicPath: string | null = null;
  private currentNavigationId: number | null = null;
  private lastPageViewNavigationId: number | null = null;

  readonly consent = this.consentState.asReadonly();
  readonly isPublicPage = this.publicPageState.asReadonly();
  readonly showConsentChoices = computed(() =>
    this.available() && this.isPublicPage()
      && (this.consent() === 'unknown' || this.privacySettingsOpen()),
  );
  readonly showPrivacySettings = computed(() =>
    this.available() && this.isPublicPage()
      && this.consent() !== 'unknown' && !this.privacySettingsOpen(),
  );

  available(): boolean {
    const currentOrigin = this.document.defaultView?.location.origin;
    return this.browser
      && this.config.production
      && currentOrigin === this.config.productionOrigin
      && TAG_MANAGER_ID_PATTERN.test(this.config.tagManagerId)
      && MEASUREMENT_ID_PATTERN.test(this.config.measurementId);
  }

  /** Called on successful Angular Router navigation; query and fragment are never sent. */
  pageView(url: string, navigationId: number): void {
    const rawPath = this.cleanPath(url);
    const isPublic = this.isAllowedPublicPath(rawPath);
    if (isPublic && this.publicPageState() && this.currentPath !== rawPath) {
      this.previousPublicPath = this.analyticsPath(this.currentPath);
    }
    this.currentPath = rawPath;
    this.currentNavigationId = navigationId;
    this.publicPageState.set(isPublic);
    this.publicEventsThisNavigation.clear();

    if (!isPublic || this.consent() !== 'granted' || this.lastPageViewNavigationId === navigationId) return;
    this.ensureTagManager();
    this.lastPageViewNavigationId = navigationId;

    this.pushEvent('page_view');
    if (rawPath === '/tourism') this.pushEvent('tourism_page_view', { content_language: this.contentLanguage() });
    this.previousPublicPath = this.analyticsPath(rawPath);
  }

  track(event: AnalyticsEvent, parameters: AnalyticsEventParameters = {}): void {
    if (!this.available() || this.consent() !== 'granted') return;
    const privateRegistrationConversion = !this.isPublicPage() && event === 'service_registration_completed';
    if (!this.isPublicPage() && !privateRegistrationConversion) return;
    this.ensureTagManager(privateRegistrationConversion);
    this.pushEvent(event, this.sanitizeParameters(parameters));
  }

  trackOnce(event: AnalyticsEvent, dedupeKey: string, parameters: AnalyticsEventParameters = {}): void {
    if (!this.available() || this.consent() !== 'granted'
      || (!this.isPublicPage() && event !== 'service_registration_completed')) return;
    const key = `${this.currentNavigationId ?? -1}:${event}:${dedupeKey}`;
    if (this.publicEventsThisNavigation.has(key)) return;
    this.publicEventsThisNavigation.add(key);
    this.track(event, parameters);
  }

  setConsent(granted: boolean): void {
    if (!this.available() || (granted && !this.isPublicPage())) return;
    const choice: AnalyticsConsent = granted ? 'granted' : 'denied';
    this.consentState.set(choice);
    this.privacySettingsOpen.set(false);
    try {
      this.document.defaultView?.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
    } catch {
      // The explicit in-memory choice still applies for this page session.
    }

    if (granted) {
      this.ensureTagManager();
      this.sendPageViewForCurrentNavigation();
    } else {
      this.lastPageViewNavigationId = null;
      this.pushConsentUpdate('denied');
    }
  }

  openPrivacySettings(): void {
    if (this.available() && this.isPublicPage()) this.privacySettingsOpen.set(true);
  }

  closePrivacySettings(): void {
    if (this.consent() !== 'unknown') this.privacySettingsOpen.set(false);
  }

  /**
   * Use only after the trusted workflow confirms customer acceptance and
   * partner confirmation. The key is hashed locally and never sent to GTM.
   */
  async bookingConfirmed(idempotencyKey: string): Promise<void> {
    if (!this.available() || this.consent() !== 'granted' || !idempotencyKey.trim()) return;
    try {
      const storage = this.document.defaultView?.localStorage;
      const crypto = this.document.defaultView?.crypto;
      if (!storage || !crypto?.subtle) return;
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(idempotencyKey.trim()));
      const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
      const storageKey = `cdm360.analytics.booking-confirmed.${hash}`;
      if (storage.getItem(storageKey)) return;
      storage.setItem(storageKey, '1');
      this.trackOnce('booking_confirmed', hash);
    } catch {
      // Do not send an event if duplicate prevention cannot be guaranteed.
    }
  }

  private readStoredConsent(): AnalyticsConsent {
    if (!this.browser || !this.config.production) return 'unknown';
    try {
      const choice = this.document.defaultView?.localStorage.getItem(CONSENT_STORAGE_KEY);
      return choice === 'granted' || choice === 'denied' ? choice : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private cleanPath(url: string): string {
    const path = url.split(/[?#]/, 1)[0] || '/';
    if (!path.startsWith('/') || path.startsWith('//')) return '/';
    const normalized = `/${path.split('/').filter(Boolean).join('/')}`;
    return normalized.length <= 300 ? normalized : '/';
  }

  private isAllowedPublicPath(path: string): boolean {
    if (Object.hasOwn(LANDING_PAGE_TITLES, path)) return true;
    if (path === '/service-search' || path === '/account' || path.startsWith('/admin') || path.startsWith('/auth/')) return false;
    if (path === '/my-submissions' || path.startsWith('/my-submissions/')
      || path === '/my-lodging-inquiries' || path.startsWith('/my-lodging-inquiries/')
      || path === '/services/submit' || path.startsWith('/services/submit/')
      || path === '/jobs/submit' || path.startsWith('/jobs/submit/')
      || path.startsWith('/marketplace/my-')
      || path.startsWith('/marketplace/sell')
      || path.startsWith('/marketplace/edit')
      || path.startsWith('/marketplace/favourites')) return false;
    const segments = path.split('/').filter(Boolean);
    if (segments[0] === 'marketplace' && segments.length === 1) return true;
    if (segments[0] === 'marketplace' && segments[1] === 'category') {
      return segments.length === 3 && SAFE_SLUG_PATTERN.test(segments[2]);
    }
    if (segments[0] === 'services' && segments[1] === 'category') {
      return segments.length === 3 && SAFE_SLUG_PATTERN.test(segments[2]);
    }
    if (segments[0] === 'services' && segments.length === 3) {
      return segments.slice(1).every(segment => SAFE_SLUG_PATTERN.test(segment));
    }
    if (segments[0] === 'services' && segments.length === 2) {
      return SAFE_SLUG_PATTERN.test(segments[1]);
    }
    return segments[0] === 'providers' && segments.length === 2 && UUID_PATTERN.test(segments[1]);
  }

  private analyticsPath(path: string): string {
    if (path === '/services/submit' || path.startsWith('/services/submit/')) return '/services';
    if (path.startsWith('/services/category/')) return path;
    if (/^\/services\/[^/]+\/[^/]+$/.test(path)) return path;
    if (path.startsWith('/services/')) return '/services/:listing';
    if (path.startsWith('/providers/')) return '/providers/:listing';
    return path;
  }

  private safePageTitle(path: string): string {
    if (LANDING_PAGE_TITLES[path]) return LANDING_PAGE_TITLES[path];
    if (path.startsWith('/services/category/') || /^\/services\/[^/]+\/[^/]+$/.test(path)) {
      const slug = path.split('/').filter(Boolean).at(-1) ?? '';
      const label = slug.replaceAll('-', ' ').replace(/\b[a-z]/g, letter => letter.toUpperCase());
      return `${label} in Chidambaram | CDM 360`;
    }
    if (path.startsWith('/services/') || path.startsWith('/providers/')) return 'Public service | CDM 360';
    return 'Public page | CDM 360';
  }

  private contentLanguage(): ContentLanguage {
    return this.document.documentElement.lang === 'ta' ? 'ta' : 'en';
  }

  private sanitizeParameters(parameters: AnalyticsEventParameters): Readonly<Record<string, unknown>> {
    const result: {
      service_category?: string;
      public_listing_id?: string;
      public_job_id?: string;
      contact_method?: ContactMethod;
      advertisement_id?: string;
      advertisement_position?: number;
      page_section?: string;
      content_language?: ContentLanguage;
      result_count?: number;
    } = {};
    if (parameters.service_category && SAFE_SLUG_PATTERN.test(parameters.service_category)) {
      result.service_category = parameters.service_category;
    }
    if (parameters.public_listing_id && UUID_PATTERN.test(parameters.public_listing_id)) {
      result.public_listing_id = parameters.public_listing_id;
    }
    if (parameters.public_job_id && UUID_PATTERN.test(parameters.public_job_id)) {
      result.public_job_id = parameters.public_job_id;
    }
    if (parameters.contact_method && ['phone', 'whatsapp', 'email', 'website', 'other'].includes(parameters.contact_method)) {
      result.contact_method = parameters.contact_method;
    }
    if (parameters.advertisement_id && (UUID_PATTERN.test(parameters.advertisement_id) || SAFE_SLUG_PATTERN.test(parameters.advertisement_id))) {
      result.advertisement_id = parameters.advertisement_id;
    }
    if (Number.isInteger(parameters.advertisement_position) && parameters.advertisement_position! >= 0) {
      result.advertisement_position = parameters.advertisement_position;
    }
    if (parameters.page_section && SAFE_SLUG_PATTERN.test(parameters.page_section)) result.page_section = parameters.page_section;
    if (parameters.content_language === 'en' || parameters.content_language === 'ta') result.content_language = parameters.content_language;
    if (Number.isInteger(parameters.result_count) && parameters.result_count! >= 0 && parameters.result_count! <= 10_000) {
      result.result_count = parameters.result_count;
    }
    return result;
  }

  private sendPageViewForCurrentNavigation(): void {
    if (this.currentNavigationId === null || !this.isPublicPage()
      || this.lastPageViewNavigationId === this.currentNavigationId) return;
    this.pageView(this.currentPath, this.currentNavigationId);
  }

  private ensureTagManager(allowPrivateRegistration = false): void {
    if (!this.available() || this.gtmInitialized || this.consent() !== 'granted'
      || (!this.isPublicPage() && !allowPrivateRegistration)) return;
    const window = this.tagManagerWindow();
    if (!window) return;
    window.dataLayer ??= [];
    window.gtag ??= (...args: unknown[]) => window.dataLayer?.push(args);
    window.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    this.pushConsentUpdate('granted');
    window.dataLayer.push(this.pageContext());

    const existingScript = this.document.querySelector<HTMLScriptElement>(
      `script[data-cdm360-gtm],script[src*="googletagmanager.com/gtm.js?id=${this.config.tagManagerId}"]`,
    );
    if (!existingScript) {
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      const script = this.document.createElement('script');
      script.async = true;
      script.referrerPolicy = 'no-referrer';
      script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(this.config.tagManagerId)}`;
      script.setAttribute('data-cdm360-gtm', this.config.tagManagerId);
      this.document.head.appendChild(script);
    }
    this.gtmInitialized = true;
  }

  private pushConsentUpdate(state: 'granted' | 'denied'): void {
    const window = this.tagManagerWindow();
    if (!window) return;
    window.dataLayer ??= [];
    window.gtag ??= (...args: unknown[]) => window.dataLayer?.push(args);
    window.gtag('consent', 'update', {
      analytics_storage: state,
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  }

  private pushEvent(event: string, parameters: Readonly<Record<string, unknown>> = {}): void {
    const dataLayer = this.tagManagerWindow()?.dataLayer;
    dataLayer?.push({
      event,
      ...this.pageContext(),
      ...parameters,
    });
  }

  private pageContext(): Readonly<Record<string, string>> {
    const pagePath = this.analyticsPath(this.currentPath);
    const origin = this.document.defaultView?.location.origin ?? 'https://cdm360.in';
    return {
      page_location: `${origin}${pagePath}`,
      page_path: pagePath,
      page_referrer: `${origin}${this.previousPublicPath ?? '/'}`,
      page_title: this.safePageTitle(pagePath),
      content_language: this.contentLanguage(),
    };
  }

  private tagManagerWindow(): TagManagerWindow | null {
    return this.document.defaultView as TagManagerWindow | null;
  }
}
