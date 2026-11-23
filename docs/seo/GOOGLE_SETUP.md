# Google Search Console and GA4 setup

Google Search Console and GA4 are not configured by this repository change. No ownership verification, analytics property, DNS record or measurement ID has been created.

## Google Search Console

1. Sign in at [Google Search Console](https://search.google.com/search-console/) with the project owner’s Google account.
2. Choose **Add property** → **Domain** and enter `cdm360.in` (no protocol or path).
3. Copy the TXT verification value shown by Google. In the DNS provider authoritative for `cdm360.in`, add a TXT record at the root (`@`, or the provider’s equivalent). Preserve existing TXT records. Do not paste a guessed value.
4. Wait for DNS propagation, then click **Verify** in Search Console. If verification fails, confirm the authoritative nameservers and TXT value with the DNS provider; do not remove unrelated records.
5. After the site is deployed, open **Sitemaps**, submit `https://cdm360.in/sitemap.xml`, and confirm Google can fetch it.
6. Use **URL inspection** for `https://cdm360.in/`, `/tourism`, `/services`, a real published category URL and a real published service URL. Inspect the indexed/crawled HTML and live-test result. Do this after crawlable rendering is shipped; metadata added by browser JavaScript alone is not evidence that raw HTML is correct.
7. Review **Indexing → Pages** for excluded, not found, duplicate canonical, blocked-by-robots and crawled-not-indexed patterns. Fix causes before requesting re-indexing.
8. Use the **Performance → Search results** report to record query, page, country/device, clicks, impressions, CTR and average position. Compare consistent 28-day windows and annotate releases/content publications.
9. Review **Experience → Core Web Vitals** (mobile and desktop). Search Console needs sufficient field data; use Lighthouse/PageSpeed Insights for interim lab diagnostics.
10. Do not interpret “submitted” as “indexed,” and do not claim verification until Search Console itself reports the property as verified.

## Optional GA4 activation

No Measurement ID is present. The owner must create a GA4 property and provide an actual `G-XXXXXXXXXX` ID before adding it to the app. Do not enable a placeholder or invent an ID.

Before enabling:

- Confirm the applicable privacy notice and consent requirements with the site owner/legal contact.
- Use a consent-management experience that defaults to no analytics until valid consent where required; provide a way to change/revoke consent.
- Do not send names, phone numbers, emails, message text, booking details, query text or other personal data to analytics.
- Send one `page_view` per Angular route transition. Avoid loading GA’s automatic page-view and also sending a duplicate manual view.
- Define the agreed events: tourism view, hotel listing view, cab listing view, hotel enquiry submitted, cab enquiry submitted, booking request acknowledged/confirmed only after partner confirmation, and contact-button click. Use IDs or broad event types, not personal data.
- Keep the app functional with analytics disabled, blocked or missing an ID.

Testing after owner configuration:

1. In GA4, open **Reports → Realtime** and visit the site in a fresh browser with analytics consent granted.
2. Confirm only one page view is recorded for the initial route and one per Angular navigation; check that query strings and fragment identifiers do not leak search or personal data.
3. Use **Admin → DebugView** with the owner-approved debug setup. Trigger each implemented event with test data and confirm parameters contain no personal information.
4. Test decline/revoke and blocked-script cases; no analytics request should be sent without consent when consent is required.
5. Treat Realtime/DebugView as validation, not proof that production users have consented.
