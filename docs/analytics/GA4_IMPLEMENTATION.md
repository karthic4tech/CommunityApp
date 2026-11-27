# CDM 360 GTM and GA4 implementation

## Configuration and architecture

- GTM web container: **GTM-5FG93SJC**
- GA4 web Measurement ID: **G-WWQX1NRF3W**
- GA4 stream ID: **16428268987** (Google administration reference; GTM uses the Measurement ID).
- Production site: `https://cdm360.in/`. Analytics is restricted to this exact origin and production builds.
- `AnalyticsService` is the single Angular integration point. It sends typed events to `window.dataLayer`; GA4 tags are configured in GTM.
- The app injects the official asynchronous `gtm.js` loader once, only in a production build, after explicit analytics consent and on an eligible route.
- There is no direct `gtag.js`/GA4 installation and no Google script in `src/index.html`.
- `DOCUMENT` and `PLATFORM_ID` keep GTM browser-only and SSR/prerender safe. No npm dependency or Supabase schema change was added.
- No Content Security Policy or privacy-policy route/file was found in the repository. Cloudflare dashboard headers were not accessible from source.
- If a CSP is configured in Cloudflare, validate that its script/connect policies permit the GTM loader and the owner's approved GA collection endpoints; do not add a broad policy without reviewing deployed GTM tags.

The production IDs and allowed origin (`https://cdm360.in`) are in `src/environments/environment.ts`; these are public identifiers, not secrets. `AnalyticsService` requires production mode, the exact production origin and consent. Analytics is inert in development and preview/staging origins.

## Consent and noscript

The app had no existing consent UI. A small accessible opt-in banner and persistent **Privacy settings** control are now included on eligible public routes. Choices are stored locally; a visitor can accept, reject or later change/revoke consent. GTM is not loaded while consent is unknown or denied. Consent Mode defaults analytics and all advertising storage/signals to denied, then grants analytics only after opt-in.

No `<noscript>` GTM image fallback is included because it would bypass the JavaScript consent gate. No privacy policy was found; the banner copy and applicable legal notice require owner/legal review before release.

## SPA page views and route restrictions

The app uses **manual Angular Router page views only**. `NavigationEnd` provides one `page_view` per successful navigation ID, including initial navigation and browser back/forward. Query strings and fragments are omitted; page locations and titles are normalized. `page_referrer` is set only to the previous sanitized public route (or `/`); the browser's raw referrer is never sent.

Page views are limited to the six priority public landing pages: `/`, `/services`, `/businesses`, `/tourism`, `/essential-services`, and `/jobs`. Existing safe service, hotel, job, and promoted-marketplace events may run on their eligible public routes, but those routes do not create extra page views. Admin, authentication, account, private submission/inquiry, search-helper and unknown routes are excluded. A service-registration conversion is a deliberate exception: it can emit only after backend success and consent, with a sanitized `/services` context and category slug; it never sends the private form URL or contents.

**Do not enable overlapping page-view mechanisms.** Angular Router `NavigationEnd` is the sole page-view source. In GTM, set the Google tag's `send_page_view` to `false`; do not add All Pages or History Change page-view triggers. The app emits a `cdm360_route_state` data-layer event with `analytics_route_allowed` set to `true` only on consented, eligible public routes; on private routes it sets the flag to `false` and clears page fields. Require this flag on every GA4 Event tag as defense in depth. In GA4 Enhanced Measurement disable history-change page views, site search, form interactions and outbound clicks to prevent duplicate tracking or capture of search/contact details. Prefer disabling all Enhanced Measurement events at launch.

## Implemented events

| Event | Trigger | Safe parameters |
|---|---|---|
| `page_view` | Eligible Angular route navigation | Sanitized `page_location`, `page_path`, `page_referrer`, generic `page_title`, `content_language` |
| `tourism_page_view` | `/tourism` navigation | `content_language` |
| `service_listing_view` | Public service detail successfully loaded | `public_listing_id`, `service_category`, `content_language` |
| `service_contact_click` | Visitor activates a public service contact link | Public listing ID, category slug, contact method and language; never contact value/URL |
| `service_search` | Public directory search succeeds | Result count and language; no search term/locality |
| `hotel_listing_view` | Public hotel/lodge detail loaded | Public listing ID, category slug and language |
| `hotel_enquiry_submitted` | Only after the lodging inquiry insert succeeds | Public listing ID, category slug and language |
| `job_listing_view` | Published jobs load | Public job ID and language |
| `job_contact_click` | Visitor activates a published job contact link | Public job ID and contact method; never phone/email |
| `service_registration_completed` | Only after a new service submission is accepted by the backend | Validated category slug only |
| `advertisement_impression` | A promoted marketplace Featured Deal is at least 50% visible | Public marketplace listing ID, one-based featured position, `featured-deals` section |
| `advertisement_click` | Visitor opens a promoted Featured Deal | Public marketplace listing ID, one-based featured position, `featured-deals` section |
| `business_registration_completed` | Reserved typed event for a future business-registration workflow | Not currently emitted; existing service submissions use `service_registration_completed` after backend success |

Parameters are strongly typed and runtime-allowlisted. Names, emails, phone/WhatsApp numbers, private addresses, form values, auth tokens, booking references, search text, raw URLs and referrers are not emitted.

The repository has no cab quote/enquiry flow, so `cab_enquiry_submitted` is not wired. The existing marketplace Featured Deals are explicitly promoted listings; their impressions are recorded only after at least 50% visibility, and clicks only from the promoted card link. Other cards/banners are not classified as ads.

## GTM container setup (manual)

The repository cannot publish or inspect the remote GTM workspace. Before publishing:

1. In container **GTM-5FG93SJC**, inspect the currently published tags/triggers and confirm the Google tag is the only GA4 configuration tag. Remove duplicate direct GA/Google tags, Ads/remarketing tags, automatic form capture, and any tag that captures full URLs or query strings.
2. Review the existing **Initialization - All Pages** trigger on the Google tag. Keep this trigger, set `send_page_view` to `false`, and require the built-in `analytics_storage` consent check. Do not add the route-state condition to this initialization trigger: the app itself injects GTM only after opt-in and on an eligible public route. Keep advertising consent denied.
3. Create **Data Layer Variables** (Data Layer Version 2) for `analytics_route_allowed`, `page_location`, `page_path`, `page_referrer`, `page_title`, and `content_language`. Use the sanitized variables as the Google tag's shared event settings where applicable; do not use GTM's built-in Page URL or Referrer variables.
4. Create a **Custom Event** trigger with event name exactly `page_view`. Attach a GA4 Event tag with event name `page_view` to this trigger. Map the five sanitized variables above. Do not add an All Pages or History Change page-view trigger.
5. For any event tag being activated, create a Custom Event trigger matching the exact event name from the table above. Require both `analytics_storage` consent and `analytics_route_allowed` equals `true` on every GA4 Event tag, including the manual `page_view` tag. Add Data Layer Variables only for its listed safe parameters (`service_category`, `public_listing_id`, `public_job_id`, `contact_method`, `advertisement_id`, `advertisement_position`, `page_section`, `content_language`, `result_count`). Do not create a GA4 tag for `business_registration_completed` until that workflow exists. Do not map form values, email, phone, message, search text, raw URLs, or IDs outside the documented safe public identifiers.
6. In **GA4 Admin → Data streams → Web stream → Enhanced measurement**, turn off page views based on browser history, site search, form interactions, and outbound clicks. Disable the remaining automatic Enhanced Measurement events for the initial launch unless individually reviewed and approved.
7. Use GTM Preview and Google Tag Assistant to confirm the Google tag initializes only after consent, one manual `page_view` occurs per eligible Angular navigation, no tag fires for private routes, and event parameters contain only approved values. Publish only after this review.

Consent Mode default-denied and consent-update commands are queued before loading the GTM container. The GA4 Google tag and its event tags must be configured in GTM; the app does not add a separate GA4 script.

## Testing and deployment

Automated validation completed:

```sh
npm test -- --watch=false
npm run build
```

The final test run passed **143 tests across 26 files**. Analytics tests cover development-mode disablement, production-origin gating, consent gating, one GTM injection, sanitized/deduplicated initial and subsequent page views (including back navigation), six-page page-view scope, private-route gating, safe registration conversion, and deduplicated marketplace promotion events. The production build passed and prerendered 86 routes; existing bundle/style budget warnings remain.

### Files changed

- `src/environments/environment.ts` — final GTM/GA4 IDs and production-origin allowlist.
- `src/app/core/services/analytics.service.ts` and `.spec.ts` — consent, GTM bootstrap, route-state gating, six-page view allowlist, sanitization, typed events and tests.
- `src/app/app.ts` and `src/app/app.html` — Router `NavigationEnd` integration and consent UI host.
- `src/app/shared/components/analytics-consent.component.ts` — accessible consent and privacy settings controls.
- `src/app/services/` — safe service search/contact, hotel detail/enquiry and registration events in existing workflows.
- `src/app/jobs/jobs-page.component.ts` — safe existing job view/contact events.
- `src/app/marketplace/marketplace-home.component.ts` and `marketplace-listing-card.component.ts` — events for existing promoted Featured Deals only.
- `docs/analytics/GA4_IMPLEMENTATION.md` plus Google/SEO setup notes under `docs/seo/` — operator instructions and validation notes.

No sitemap, robots, SEO metadata, dependency manifest, Supabase schema, or deployment configuration was changed for analytics.

### Deployment and live verification

1. Obtain owner/legal approval for the consent wording and applicable privacy notice before release.
2. Review the existing published Initialization trigger and Google tag against the steps above. Add missing consent checks and `send_page_view=false` to the Google tag; add route-state conditions to GA4 Event tags; adjust Enhanced Measurement as needed. Verify in GTM Preview and Tag Assistant before publishing a new container version.
3. Run `npm run build` and release the generated `dist/community-app/browser` assets through the existing Cloudflare production pipeline (`wrangler.jsonc` points its static asset directory there). No deployment is performed by this change.
4. On `https://cdm360.in/`, use a fresh browser profile to test accept, reject, and later revoke/change consent. Verify the GTM request is absent before consent and that the site works with GTM blocked.
5. With GTM Preview/Tag Assistant connected, verify the six priority routes, browser back/forward, private routes, one page view per eligible navigation, and only safe event parameters.
6. Confirm the same events in GA4 **DebugView** and **Realtime**. Inspect browser Network requests and the data layer for PII, query terms, contact URLs, raw referrers, and private route paths.

The owner reports that GTM Version 2 and its Google tag are published. This repository cannot inspect the remote workspace, so the Initialization trigger, consent checks, route conditions on event tags, Enhanced Measurement settings, and live GA4 collection remain unverified until tested in GTM Preview, Tag Assistant, DebugView, and Realtime.
