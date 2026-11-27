import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { ANALYTICS_CONFIG, AnalyticsConfig, AnalyticsService } from './analytics.service';

const TEST_ORIGIN = globalThis.window?.location.origin ?? 'http://localhost';
const config = (production: boolean, productionOrigin = TEST_ORIGIN): AnalyticsConfig => ({
  tagManagerId: 'GTM-5FG93SJC',
  measurementId: 'G-WWQX1NRF3W',
  productionOrigin,
  production,
});

describe('AnalyticsService', () => {
  let document: Document;

  function setup(production = true, productionOrigin?: string): AnalyticsService {
    TestBed.configureTestingModule({
      providers: [
        AnalyticsService,
        { provide: ANALYTICS_CONFIG, useValue: config(production, productionOrigin) },
      ],
    });
    document = TestBed.inject(DOCUMENT);
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
      clear: () => values.clear(),
      key: (index: number) => [...values.keys()][index] ?? null,
      get length() { return values.size; },
    } satisfies Storage;
    if (document.defaultView) {
      Object.defineProperty(document.defaultView, 'localStorage', {
        configurable: true,
        value: storage,
      });
    }
    document.head.replaceChildren();
    return TestBed.inject(AnalyticsService);
  }

  afterEach(() => {
    document?.defaultView?.localStorage?.removeItem('cdm360.analytics-consent.v1');
    const window = document?.defaultView as (Window & { dataLayer?: unknown[]; gtag?: unknown }) | null;
    if (window) {
      delete window.dataLayer;
      delete window.gtag;
    }
    TestBed.resetTestingModule();
  });

  it('does not initialize analytics in development builds', () => {
    const analytics = setup(false);
    analytics.pageView('/', 1);
    analytics.setConsent(true);
    expect(document.querySelector('script[data-cdm360-gtm]')).toBeNull();
  });

  it('does not initialize analytics outside the configured production origin', () => {
    const analytics = setup(true, 'https://cdm360.in');
    analytics.pageView('/', 1);
    analytics.setConsent(true);
    expect(document.querySelector('script[data-cdm360-gtm]')).toBeNull();
  });

  it('waits for consent, loads one GTM container, and emits sanitized page views', () => {
    const analytics = setup();
    analytics.pageView('/tourism?guest_email=private@example.com#booking', 1);
    expect(document.querySelector('script[data-cdm360-gtm]')).toBeNull();

    analytics.setConsent(true);
    analytics.setConsent(true);
    analytics.pageView('/tourism?guest_phone=9876543210', 1);
    analytics.track('hotel_enquiry_submitted', {
      public_listing_id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      service_category: 'lodge-stay',
      content_language: 'en',
    });

    const window = document.defaultView as (Window & { dataLayer?: unknown[] }) | null;
    const events = (window?.dataLayer ?? []).filter((entry): entry is Record<string, unknown> =>
      typeof entry === 'object' && entry !== null && 'event' in entry,
    );
    const pageViews = events.filter((entry) => entry['event'] === 'page_view');
    const script = document.querySelector<HTMLScriptElement>('script[data-cdm360-gtm]');

    expect(document.querySelectorAll('script[data-cdm360-gtm]')).toHaveLength(1);
    expect(script?.src).toBe('https://www.googletagmanager.com/gtm.js?id=GTM-5FG93SJC');
    expect(document.querySelector('script[src*="gtag/js"]')).toBeNull();
    expect(pageViews).toHaveLength(1);
    expect(pageViews[0]?.['page_location']).toMatch(/\/tourism$/);
    expect(pageViews[0]?.['page_title']).toBe('Chidambaram Travel Guide, Stays & Local Services | CDM 360');
    expect(JSON.stringify(events)).toContain('tourism_page_view');
    expect(JSON.stringify(events)).toContain('hotel_enquiry_submitted');
    expect(JSON.stringify(events)).toContain('lodge-stay');
    expect(JSON.stringify(events)).not.toContain('private@example.com');
    expect(JSON.stringify(events)).not.toContain('9876543210');
    expect(JSON.stringify(events)).not.toContain('booking');
  });

  it('tracks initial, forward, and back navigations once per successful route transition', () => {
    const analytics = setup();
    analytics.pageView('/', 1);
    analytics.setConsent(true);
    analytics.pageView('/services', 2);
    analytics.pageView('/businesses', 3);
    analytics.pageView('/services', 4); // Browser back is a new NavigationEnd ID.
    analytics.pageView('/services', 4); // Duplicate notification for the same ID.

    const window = document.defaultView as (Window & { dataLayer?: unknown[] }) | null;
    const pageViews = (window?.dataLayer ?? []).filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === 'object' && entry !== null && 'event' in entry && entry['event'] === 'page_view',
    );
    expect(pageViews).toHaveLength(4);
    expect(pageViews.map(entry => entry['page_path'])).toEqual([
      '/',
      '/services',
      '/businesses',
      '/services',
    ]);
  });

  it('limits page views to the six priority pages and gates event tags on safe public routes', () => {
    const analytics = setup();
    analytics.pageView('/services/category/electrical?query=private', 1);
    analytics.setConsent(true);
    analytics.track('service_contact_click', {
      public_listing_id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      contact_method: 'phone',
    });
    analytics.pageView('/account?email=private@example.com', 2);
    analytics.track('service_contact_click', {
      public_listing_id: 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
      contact_method: 'phone',
    });

    const window = document.defaultView as (Window & { dataLayer?: unknown[] }) | null;
    const entries = window?.dataLayer ?? [];
    const pageViews = entries.filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === 'object' && entry !== null && 'event' in entry && entry['event'] === 'page_view',
    );
    const contactEvents = entries.filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === 'object' && entry !== null && 'event' in entry && entry['event'] === 'service_contact_click',
    );
    const routeStates = entries.filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === 'object' && entry !== null && 'event' in entry && entry['event'] === 'cdm360_route_state',
    );

    expect(pageViews).toHaveLength(0);
    expect(contactEvents).toHaveLength(1);
    expect(contactEvents[0]?.['page_path']).toBe('/services/category/:category');
    expect(routeStates.at(-1)?.['analytics_route_allowed']).toBe(false);
    expect(JSON.stringify(entries)).not.toContain('private@example.com');
    expect(JSON.stringify(entries)).not.toContain('query=private');
  });

  it('does not load the container or record page views on sensitive routes', () => {
    const analytics = setup();
    analytics.pageView('/admin?token=secret', 1);
    analytics.setConsent(true);
    analytics.pageView('/account?email=private@example.com', 2);

    expect(document.querySelector('script[data-cdm360-gtm]')).toBeNull();
    expect(document.defaultView?.localStorage.getItem('cdm360.analytics-consent.v1')).toBeNull();
  });

  it('records a confirmed registration conversion without a private form URL or values', () => {
    const analytics = setup();
    analytics.pageView('/services', 1);
    analytics.setConsent(true);
    analytics.pageView('/services/submit/aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa?phone=private', 2);
    analytics.track('service_registration_completed', { service_category: 'electrician' });

    const window = document.defaultView as (Window & { dataLayer?: unknown[] }) | null;
    const events = (window?.dataLayer ?? []).filter((entry): entry is Record<string, unknown> =>
      typeof entry === 'object' && entry !== null && 'event' in entry,
    );
    const registration = events.find((entry) => entry['event'] === 'service_registration_completed');
    expect(registration?.['service_category']).toBe('electrician');
    expect(registration?.['page_location']).toMatch(/\/services$/);
    expect(JSON.stringify(registration)).not.toContain('/services/submit');
    expect(JSON.stringify(registration)).not.toContain('phone=private');
  });

  it('allows deduplicated promoted-listing events on the public marketplace', () => {
    const analytics = setup();
    analytics.pageView('/marketplace', 1);
    analytics.setConsent(true);
    const parameters = {
      advertisement_id: 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa',
      advertisement_position: 1,
      page_section: 'featured-deals',
    } as const;
    analytics.trackOnce('advertisement_impression', parameters.advertisement_id, parameters);
    analytics.trackOnce('advertisement_impression', parameters.advertisement_id, parameters);
    analytics.track('advertisement_click', parameters);

    const window = document.defaultView as (Window & { dataLayer?: unknown[] }) | null;
    const events = (window?.dataLayer ?? []).filter((entry): entry is Record<string, unknown> =>
      typeof entry === 'object' && entry !== null && 'event' in entry,
    );
    expect(events.filter(entry => entry['event'] === 'advertisement_impression')).toHaveLength(1);
    expect(events.filter(entry => entry['event'] === 'advertisement_click')).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain('tel:');
  });
});
