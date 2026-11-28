# SEO implementation and deployment notes

## Rendering and hosting

- Angular prerendering is used to generate static HTML for public, crawlable routes. The build still deploys to `dist/community-app/browser` through the existing Cloudflare static-assets configuration; no Node/SSR server is required at runtime.
- `npm run build` runs `seo:images`, `seo:sitemap`, `seo:generate`, then `ng build`. `seo:sitemap` is a pure static allowlist operation and does not read Supabase. `seo:generate` separately uses the app's **public Supabase URL and publishable key** with anonymous/RLS-protected reads for prerender routes and category links; it never reads or requires a service-role key.
- `src/prerender-routes.txt` is generated from the stable public URLs plus active categories with published/verified listing descendants and routable published/verified details. Admin, auth, account, submission and private booking routes are never put in this list.
- `provideClientHydration(withEventReplay())` and Angular `TransferState` carry only public category/listing/location/business/job/review-summary projections into the browser. Server Supabase auth persistence, session restoration and role requests are disabled; browser auth remains unchanged.
- The language service prerenders a deterministic Tamil tree, transfers that choice into hydration, and restores a saved English preference only after the first browser render. This avoids a local-storage-induced server/client text mismatch.
- The prerendered listing/detail HTML is built from existing public Supabase access patterns and public fields. Private inquiries and customer data are not selected for public HTML.
- The hosting fallback remains SPA mode so non-prerendered protected workflows still load. Consequently, an unknown URL still needs a hosting-level 404 solution; Angular's not-found component alone does not set the HTTP status.

## SEO service and metadata

`SeoService` now uses Angular `Title` and `Meta` plus the injected `DOCUMENT`. It updates/removes duplicates for title, description, robots, canonical, Open Graph, Twitter/X card, `og:locale`, global Organization/WebSite JSON-LD and optional per-page JSON-LD. It also removes obsolete `meta keywords` tags.

Public page components use existing records for dynamic category/service title, description and canonical values. Category and service-detail pages include BreadcrumbList JSON-LD. A published provider detail uses `Service` and only selects `Hotel`/`Restaurant` where the actual category supports it; it does not assert ratings, availability, opening hours, invented prices or unsupported addresses. CDM 360 remains the directory/platform, distinct from the actual provider.

Representative metadata follows the actual locale and canonical route:

```text
English title: Electrician in Chidambaram | CDM 360
Tamil title: எலக்ட்ரீஷியன் | நம் சிதம்பரம்
Canonical: https://cdm360.in/services/home-services/electrician
```

The localized title string is selected from the current UI language; both language states share the same canonical URL because no locale-prefixed routes exist. Detail JSON-LD uses a stable `#service` entity and provider `#provider` entity at that canonical URL; provider type is selected from the actual published category (e.g. `Hotel`, `Restaurant`, `Electrician`, `AutoRepair`) or the conservative `Organization` fallback. User-controlled JSON-LD strings escape `<`, `>`, and `&` before embedding so stored text cannot terminate the script element.

Filtered `/services` and `/essential-services` result URLs are `noindex,follow` with clean base canonicals. `/service-search`, authentication and private route families are noindex at runtime. Search terms, query strings and fragments are not included in canonicals or analytics page URLs. No hreflang pairs are emitted because English and Tamil do not have separate URLs.

The production canonical origin is fixed in `SeoService` to `https://cdm360.in`; request/host headers are not used. Existing public content and contextual templates supply metadata; no SEO override columns are present in the inspected schema. The generated indexability registry now controls listing/category sitemap inclusion and `robots` on the corresponding route components. HTML language and landing/category metadata respond to the existing `LanguageService`; the language preference does not create a distinct indexable URL.

## Sitemap and robots

- `scripts/sitemap-urls.mjs` remains the six-route static safety allowlist. `scripts/generate-sitemap.mjs` can create a minimal safe fallback containing these routes without querying Supabase.
- `scripts/generate-seo-artifacts.mjs` now queries active categories and published listings from the existing public/RLS-protected Supabase projection. A single build-time inventory generates `src/prerender-routes.txt`, category links, `SEO_INDEXABLE_PATHS`, and `public/sitemap.xml`.
- The sitemap preserves all six established URLs and adds only canonical category/subcategory routes with eligible inventory plus published/verified service-detail routes whose title, description, provider name, and slug pass the SEO content policy. Generated service/category `lastmod` values come from actual database `updated_at` timestamps; static content without an authoritative timestamp has no `lastmod`.
- The default category indexability threshold is one eligible published listing. Build operators may set `SEO_MIN_PUBLIC_LISTINGS_PER_CATEGORY` (integer 1–1000) to raise it; the same generated policy controls sitemap inclusion and runtime category `robots`.
- Legacy `/services/category/:child` paths are retained in prerender output but resolve to the canonical nested `/services/:parent/:child` metadata. The sitemap and generated internal directory links use the nested canonical form only.
- Invalid XML paths fail closed; URLs are deduplicated, restricted to the production HTTPS origin, XML-escaped, and bounded by the 50,000 URL / 50 MB sitemap limits. XML is atomically renamed into place after the data query and validation succeed.
- `wrangler.jsonc` keeps `drop-trailing-slash` behavior and static direct serving for `sitemap.xml` and `robots.txt`.
- Refresh is build-time, not publication-event-driven. Approved/unpublished changes appear in the next successful artifact build/deployment. No webhook, CI deployment secret, or Cloudflare build hook is configured; a failed database query makes the build fail rather than publishing a partial dynamic sitemap.
- `public/robots.txt` references the production sitemap and excludes private route families. Robots rules are not authorization; Supabase RLS and existing route guards remain the security controls.

## Tourism content and internal links

Existing `/tourism` was retained rather than creating near-duplicate pages. It already contains bilingual editorial destination descriptions, cited source links, one-/two-day itinerary ideas, public stay/dining listings and enquiry CTAs. Operational details are explicitly directed to official sources for confirmation. Separate temple/Pichavaram/cab itinerary URLs remain unpublished because they need additional independently reviewed material and verified transport inventory.

The generated service index adds crawlable links to indexable categories with eligible published/verified inventory. Leaf category pages render their public listing directory; parent category pages keep crawlable subcategory cards. Breadcrumbs and listing-detail/related links remain in place. Category and service-detail pages use the generated indexability registry to emit `noindex,follow` when content does not meet the build policy.

## Mobile asset optimization and bundle baseline

Nine referenced large PNG assets were converted to WebP at quality 82 and the app references updated. The selected source image set decreased from **23.13 MiB to 2.64 MiB (89% smaller)**. Original PNGs remain in `public/assets/images` to avoid destructive asset removal and for compatibility with any un-audited references. `scripts/optimize-public-images.mjs` regenerates the WebP files when their source changes.

The final local production build's initial bundle is **980.99 kB raw / 198.33 kB estimated transfer**, compared with the **922.38 kB / 180.97 kB** pre-SSR baseline. It remains over the 550 kB configured warning budget. This increment changed the initial raw bundle by about 0.3 kB from immediately before the SEO work. The tourism-guide code is lazy-loaded (about 33.5 kB raw / 5.8 kB estimated transfer); LCP/INP/CLS and CrUX field data were not measured.

## Analytics and conversions

GTM/GA4 is configured in the app using owner-supplied IDs and an explicit consent banner. The app loads only the GTM container (`GTM-5FG93SJC`) after consent on the production origin; GA4 is configured through GTM with `G-WWQX1NRF3W`. There is no direct `gtag.js` installation. Angular navigation produces sanitized, non-duplicated page views; contact/enquiry/registration events send only allowlisted values. The owner reports a published GTM v2 and GA4 Realtime activity; this repository cannot independently inspect those accounts. See [the GTM/GA4 implementation guide](../analytics/GA4_IMPLEMENTATION.md).

Existing service contacts, lodging enquiry, job contact, tourism and promoted marketplace workflows emit allowlisted events where wired. Cab enquiry and confirmed booking remain unwired because no matching workflow exists. Registration conversion is tracked only after the backend accepts a new service submission. No customer details are included.

## Changes in this SEO increment

- Added a build-time dynamic sitemap from the existing read-only public inventory. The six established sitemap URLs remain included.
- Added canonical route selection for nested category pages, a configurable minimum inventory threshold, a narrow placeholder/thin-content filter for listing indexability, `lastmod` from actual record timestamps, XML/path validation, atomic sitemap replacement, and tests.
- Business-directory cards now prefer the canonical service slug rather than the UUID detail alias when available.
- Landing/category/tourism/business/job SEO titles and descriptions now reflect the active Tamil or English UI language where suitable.
- No database migration, external API, npm package, RLS/auth change, Supabase write, Google-account edit, or Cloudflare configuration change was made.

## Partial scope and remaining features

- Two source-linked, bilingual destination guides were added (`/tourism/nataraja-temple-guide`, `/tourism/pichavaram-mangrove-forest`) from existing tourism content and official district sources. They avoid unverified visitor hours, fees, transport fares, availability, and booking claims. Other proposed hotel/cab/itinerary pages remain unpublished until useful original content and verified service inventory are available.
- No `/ta/` or `/en/` route tree or hreflang links were added. The existing language switcher changes page language on the same URL; empty language clones would not be valid alternatives.
- No provider-specific `/businesses/:slug` profile, job detail/expiry route, SEO override schema, SEO admin dashboard, or database migration was added. Existing business cards link to their public service listing. The jobs table currently lacks expiry/detail-route support.
- No publication-triggered sitemap deployment, Cloudflare Build Hook, or CI workflow was added because no secured build/deploy credential or configured CI pipeline exists. The sitemap refreshes on a successful static build.
- Cloudflare's SPA fallback still cannot provide a true HTTP 404 for unknown routes. Staging/preview `X-Robots-Tag` or equivalent host-level indexing protection must be configured at Cloudflare; no host header configuration is in this repository.
- No live Search Console, GA4/GTM, Rich Results, Lighthouse, AXE, or production HTTP verification was run.

## Modified files

- Angular SSR/prerender: `angular.json`, `package.json`, `package-lock.json`, `src/main.server.ts`, `src/app/app.config.server.ts`, `src/app/app.routes.server.ts`, `src/app/app.config.ts`, `tsconfig.app.json`, `src/prerender-routes.txt`.
- SEO services and pages: `src/app/core/services/seo.service.ts`, `service-category.service.ts`, `service-directory.service.ts`, `essential-service.service.ts`, `local-brand.service.ts`, `job.service.ts`, `lodge-reviews.service.ts`, `supabase.service.ts`, `src/app/core/auth/auth.service.ts`, `src/app/app.ts`, public category/service/tourism/jobs/business components and SEO specs.
- Analytics: `src/app/core/services/analytics.service.ts`, its spec, `src/environments/environment.ts`, contact and successful hotel-enquiry components.
- Generated assets/artifacts: `scripts/generate-seo-artifacts.mjs`, `scripts/optimize-public-images.mjs`, `public/sitemap.xml`, `public/assets/images/*.webp`, and generated service links.
- Default HTML metadata: `src/index.html`.

### Files changed in the 2026-11-28 SEO increment

- Sitemap generation and policy: `scripts/generate-seo-artifacts.mjs`, `scripts/generate-sitemap.mjs`, `scripts/sitemap-builder.mjs`, `scripts/seo-indexability.mjs`, `scripts/generate-sitemap.test.mjs`, `scripts/sitemap-builder.test.mjs`, `scripts/seo-indexability.test.mjs`, `scripts/sitemap-urls.mjs`, and the `test:sitemap` npm script.
- Generated public snapshots: `public/sitemap.xml`, `src/prerender-routes.txt`, `src/app/core/services/seo-directory-links.generated.ts`, and `src/app/core/services/seo-indexable-paths.generated.ts`.
- Category/detail canonicals and robots: `src/app/services/service-category-page.component.ts`, `src/app/services/service-listings-page.component.ts`, and `src/app/services/provider-detail/provider-detail.component.ts`.
- Tourism guides and localized landing metadata: `src/app/app.routes.ts`, `src/app/tourism/tourism-guide-content.ts`, `src/app/tourism/tourism-guide.component.ts`, its spec, `src/app/community-hub/community-hub.component.ts`, `src/app/services/services.component.ts`, `src/app/services/essential-services.component.ts`, `src/app/tourism/tourism.component.ts`, and `src/app/jobs/jobs-page.component.ts`.
- Local business links: `src/app/core/models/local-brand.ts`, `src/app/core/services/local-brand.service.ts` and its spec, and `src/app/services/business-directory.component.ts`.
- Structured-data script safety: `src/app/core/services/seo.service.ts` and its spec.
- Locale metadata: `src/index.html`, `src/app/core/services/language.service.ts` and its spec, `src/app/core/services/analytics.service.ts`, and `src/app/home/home.component.spec.ts`.
- Audit/operations: `docs/seo/SEO_AUDIT.md`, `docs/seo/SEO_IMPLEMENTATION.md`, `docs/seo/SEO_TEST_RESULTS.md`, `docs/seo/SEO_SITEMAP_AUTOMATION.md`, and `docs/seo/SEO_DEPLOYMENT_AND_ROLLBACK.md`.

## Deployment checklist

1. Run `npm run test:sitemap` and `npm ci`, then `npm run build`; the sitemap task is offline, while the separate prerender artifact step needs public Supabase read access.
2. Deploy only the normal static asset output at `dist/community-app/browser`; do not deploy or start a Node server.
3. Confirm the platform serves a prerendered deep route, serves the six established canonical landing paths without a trailing-slash redirect, returns `/robots.txt` as `text/plain` and `/sitemap.xml` as XML, and preserves authentication/admin route behavior.
4. Inspect rendered HTML for a current service, category, `/tourism/nataraja-temple-guide`, and `/tourism/pichavaram-mangrove-forest`. Confirm RLS/public projections, canonical, `lang`, robots and JSON-LD before release.
5. Verify unknown-path HTTP status separately; current SPA fallback returns an HTML shell with 200.
6. Re-run the generation/build/deployment after publication, moderation, category, or content changes to refresh the prerender and sitemap snapshot. The six core URLs are held in the static allowlist; eligible category/listing URLs are derived from public inventory. No publication webhook currently triggers a build.
7. Treat Search Console, GA4, indexing, and ranking status as owner-reported until checked in the corresponding Google property.

No production deployment was performed.
