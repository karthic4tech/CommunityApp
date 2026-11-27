import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { AnalyticsService } from './analytics.service';
import { environment } from '../../../environments/environment';

describe('AnalyticsService', () => {
  const originalMeasurementId = environment.googleAnalyticsMeasurementId;

  afterEach(() => {
    environment.googleAnalyticsMeasurementId = originalMeasurementId;
    TestBed.resetTestingModule();
  });

  it('does not load analytics or record events when GA4 is unconfigured', () => {
    environment.googleAnalyticsMeasurementId = '';
    TestBed.configureTestingModule({ providers: [AnalyticsService] });
    const analytics = TestBed.inject(AnalyticsService);
    const document = TestBed.inject(DOCUMENT);

    analytics.pageView('/tourism?guest_phone=private');
    analytics.setConsent(true);
    analytics.track('hotel_enquiry_submitted');

    expect(document.querySelector('script[data-cdm360-ga4]')).toBeNull();
  });

  it('requires consent and sends one sanitized page view per path', () => {
    environment.googleAnalyticsMeasurementId = 'G-TEST123456';
    TestBed.configureTestingModule({ providers: [AnalyticsService] });
    const analytics = TestBed.inject(AnalyticsService);
    const document = TestBed.inject(DOCUMENT);
    document.title = 'Tourism';

    analytics.pageView('/tourism?guest_email=private@example.com');
    expect(document.querySelector('script[data-cdm360-ga4]')).toBeNull();

    analytics.setConsent(true);
    analytics.pageView('/tourism?guest_phone=private');
    analytics.track('hotel_enquiry_submitted');

    const window = document.defaultView as (Window & { dataLayer?: unknown[] }) | null;
    const events = (window?.dataLayer ?? []).filter((entry): entry is unknown[] =>
      Array.isArray(entry) && entry[0] === 'event',
    );
    const pageViews = events.filter((entry) => entry[1] === 'page_view');
    expect(document.querySelector('script[data-cdm360-ga4]')).not.toBeNull();
    expect(pageViews).toHaveLength(1);
    expect(JSON.stringify(events)).toContain('tourism_page_view');
    expect(JSON.stringify(events)).toContain('hotel_enquiry_submitted');
    expect(JSON.stringify(events)).not.toContain('private@example.com');
    expect(JSON.stringify(events)).not.toContain('guest_phone');
  });
});
