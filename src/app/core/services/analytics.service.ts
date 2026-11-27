import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

export type AnalyticsEvent =
  | 'tourism_page_view'
  | 'hotel_listing_view'
  | 'cab_listing_view'
  | 'hotel_enquiry_submitted'
  | 'cab_enquiry_submitted'
  | 'service_contact_click'
  | 'advertisement_click'
  | 'booking_confirmed';

type Gtag = (...args: unknown[]) => void;
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag };

const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{6,}$/;

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly measurementId = environment.googleAnalyticsMeasurementId.trim();
  private readonly browser = isPlatformBrowser(this.platformId);
  private consentGranted = false;
  private scriptRequested = false;
  private currentPath = '/';
  private lastPageViewPath: string | null = null;

  get available(): boolean {
    return this.browser && MEASUREMENT_ID_PATTERN.test(this.measurementId);
  }

  /**
   * Analytics remains disabled until a site consent UI calls this with true.
   * The project currently has no GA ID or consent-management interface.
   */
  setConsent(granted: boolean): void {
    if (!this.available) return;
    this.consentGranted = granted;
    if (!granted) {
      this.lastPageViewPath = null;
      this.gtag()?.('consent', 'update', {
        analytics_storage: 'denied',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
      return;
    }
    this.initialize();
    this.sendPageViewIfNeeded();
  }

  pageView(path: string): void {
    this.currentPath = this.sanitizePath(path);
    if (!this.consentGranted) return;
    this.sendPageViewIfNeeded();
  }

  track(event: AnalyticsEvent): void {
    if (!this.consentGranted || !this.available) return;
    this.gtag()?.('event', event);
  }

  /**
   * Call only after the trusted booking workflow confirms customer acceptance
   * and partner confirmation. The supplied key is hashed locally for
   * idempotency and is never sent to Google.
   */
  async bookingConfirmed(idempotencyKey: string): Promise<void> {
    if (!this.consentGranted || !this.available || !idempotencyKey.trim()) return;
    try {
      const storage = this.document.defaultView?.localStorage;
      if (!storage) return;
      const digest = await this.hash(idempotencyKey.trim());
      const storageKey = `cdm360.ga4.booking-confirmed.${digest}`;
      if (storage.getItem(storageKey)) return;
      storage.setItem(storageKey, '1');
      this.track('booking_confirmed');
    } catch {
      // Do not send an event if duplicate prevention cannot be guaranteed.
    }
  }

  private initialize(): void {
    if (!this.available || this.scriptRequested) return;
    const window = this.analyticsWindow();
    if (!window) return;
    this.scriptRequested = true;
    window.dataLayer ??= [];
    window.gtag ??= (...args: unknown[]) => window.dataLayer?.push(args);
    window.gtag('js', new Date());
    window.gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    window.gtag('config', this.measurementId, {
      send_page_view: false,
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
    const script = this.document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(this.measurementId)}`;
    script.setAttribute('data-cdm360-ga4', 'true');
    this.document.head.appendChild(script);
  }

  private sendPageViewIfNeeded(): void {
    if (!this.available || this.lastPageViewPath === this.currentPath) return;
    const window = this.analyticsWindow();
    if (!window?.gtag) {
      this.initialize();
    }
    const gtag = this.gtag();
    if (!gtag) return;
    this.lastPageViewPath = this.currentPath;
    const origin = this.document.defaultView?.location.origin ?? 'https://cdm360.in';
    gtag('event', 'page_view', {
      page_location: `${origin}${this.currentPath}`,
      page_path: this.currentPath,
      page_title: this.document.title.slice(0, 120),
    });
    if (this.currentPath === '/tourism') gtag('event', 'tourism_page_view');
  }

  private sanitizePath(path: string): string {
    const candidate = path.split(/[?#]/, 1)[0] || '/';
    if (!candidate.startsWith('/') || candidate.startsWith('//')) return '/';
    const withoutUuid = candidate.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':id',
    );
    return withoutUuid.length > 300 ? '/' : withoutUuid;
  }

  private analyticsWindow(): AnalyticsWindow | null {
    return this.document.defaultView as AnalyticsWindow | null;
  }

  private gtag(): Gtag | undefined {
    return this.analyticsWindow()?.gtag;
  }

  private async hash(value: string): Promise<string> {
    const crypto = this.document.defaultView?.crypto;
    if (!crypto?.subtle) throw new Error('Secure event deduplication is unavailable.');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  }
}
