# CDM 360 GTM and GA4 implementation

## Configuration and architecture

- GTM web container: **GTM-5FG93SJC**
- GA4 web Measurement ID: **G-WWQX1NRF3W**
- GA4 stream ID: **16428268987** (Google administration reference; GTM uses the Measurement ID).
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

Allowed page views cover the six public landing routes, public service category/subcategory routes, and public provider/service details. Admin, authentication, account, private submission/inquiry, search-helper and unknown routes are excluded. `service_registration_completed` is a deliberate conversion exception: it can emit only after backend success and only with consent, with a sanitized `/services` context and category slug; it never sends the private form URL or contents.

**Do not enable overlapping page-view mechanisms.** In GTM, set the Google tag's `send_page_view` to `false`. In GA4 Enhanced Measurement disable history-change page views. Also disable automatic site-search, form-interaction and outbound-click collection to prevent duplicate tracking or capture of search/contact details.

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

Parameters are strongly typed and runtime-allowlisted. Names, emails, phone/WhatsApp numbers, private addresses, form values, auth tokens, booking references, search text, raw URLs and referrers are not emitted.

The repository has no cab quote/enquiry flow, so `cab_enquiry_submitted` is not wired. The existing marketplace Featured Deals are explicitly promoted listings; their impressions are recorded only after at least 50% visibility, and clicks only from the promoted card link. Other cards/banners are not classified as ads.

## GTM container setup (manual)

The repository cannot publish or inspect the remote GTM workspace. Before publishing:

1. In container **GTM-5FG93SJC**, inspect existing tags and remove duplicate direct GA installs, Ads/remarketing tags, automatic form capture and outbound URL capture.
2. Create one Google tag with **G-WWQX1NRF3W**. Set `send_page_view=false`; fire it on **Initialization - All Pages** with built-in consent required for `analytics_storage`. The app loads the GTM container itself only after opt-in, so the tag's Initialization trigger executes only in an accepted session. Configure `page_location`, `page_path`, `page_referrer`, and `page_title` using the sanitized data-layer variables provided by the app. Keep advertising consent denied.
3. Create a GA4 Event tag for `page_view`, triggered by the Custom Event `page_view`. Do not add an All Pages page-view trigger or History Change page-view trigger.
4. Add Custom Event triggers and GA4 Event tags for each implemented event above. Configure Data Layer Variables for `page_location`, `page_path`, `page_referrer`, `page_title`, `service_category`, `public_listing_id`, `public_job_id`, `contact_method`, `advertisement_id`, `advertisement_position`, `page_section`, `content_language`, and `result_count`. Configure only parameters listed for actual implemented events.
5. Ensure Enhanced Measurement history page views, site search, form interactions and outbound clicks are disabled. Prefer disabling all Enhanced Measurement events and using only reviewed manual events.
6. Use GTM Preview/Tag Assistant to check consent, event triggers, parameter values and route exclusions; publish only after confirming no extra tags fire.

Consent Mode default-denied and consent-update commands are queued before loading the GTM container. The GA4 Google tag and its event tags must be configured in GTM; the app does not add a separate GA4 script.

## Testing and deployment

Automated checks run:

```sh
npm test -- --watch=false
npm run build
```

The analytics tests cover development-mode disablement, production-origin gating, consent gating, single GTM injection, sanitized/deduplicated page views, sensitive-route exclusion, safe registration conversion, and deduplicated marketplace promotion events.

After deployment and GTM publication:

- Verify the container with **Google Tag Assistant** and **GTM Preview**.
- Verify one page view per route in GA4 **DebugView** and **Realtime**.
- Inspect Network requests and data-layer events for query values, PII, contact URLs, referrers and private route paths.
- Test accept, reject, revoke, blocked GTM and direct navigation to a private route; the site must work when analytics is unavailable.

The GTM container configuration, GA4 tags, Enhanced Measurement toggles, privacy notice approval and live GA4 collection remain manual owner tasks. No deployment was performed.
