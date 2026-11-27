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

Filtered `/services` and `/essential-services` result URLs are `noindex,follow` with clean base canonicals. `/service-search`, authentication and private route families are noindex at runtime. Search terms, query strings and fragments are not included in canonicals or analytics page URLs. No hreflang pairs are emitted because English and Tamil do not have separate URLs.

## Sitemap and robots

- `scripts/sitemap-urls.mjs` is the centralized six-URL public sitemap allowlist. `scripts/generate-sitemap.mjs` writes only those URLs to `public/sitemap.xml`, with no Supabase request and no artificial priority/changefreq/lastmod values.
- `scripts/generate-seo-artifacts.mjs` separately queries active category names/slugs and published, verified service IDs/slugs through the existing public RLS policy to build `src/prerender-routes.txt` and `src/app/core/services/seo-directory-links.generated.ts`. These queries support prerendering and internal links, not the sitemap.
- The sitemap is exactly the six required landing pages. Category, subcategory and service-detail URLs remain prerendered and indexable but are intentionally not listed in the sitemap.
- `wrangler.jsonc` sets Cloudflare `assets.html_handling` to `drop-trailing-slash`, matching the six no-slash sitemap and canonical URLs while keeping direct static-file handling for `sitemap.xml` and `robots.txt`.
- Newly published/approved items appear after the next build and deployment. There is no production data mutation or publish webhook in this change; invoke the normal deployment build after approved listing changes.
- `public/robots.txt` references the production sitemap and excludes private route families. Robots rules are not authorization; Supabase RLS and existing route guards remain the security controls.

## Tourism content and internal links

Existing `/tourism` was retained rather than creating near-duplicate pages. It already contains editorial destination descriptions, source links, one-/two-day itinerary ideas, public stay/dining listings and enquiry CTAs. Operational details are explicitly directed to official sources for confirmation. Separate temple/Pichavaram/cab itinerary URLs were not created without independently reviewed, original material and verified cab inventory.

The generated service index adds crawlable links to active categories that currently have published/verified listings. Leaf category pages render their public listing directory; parent category pages keep their crawlable subcategory cards. Breadcrumbs and listing-detail/related links remain in place.

## Mobile asset optimization and bundle baseline

Nine referenced large PNG assets were converted to WebP at quality 82 and the app references updated. The selected source image set decreased from **23.13 MiB to 2.64 MiB (89% smaller)**. Original PNGs remain in `public/assets/images` to avoid destructive asset removal and for compatibility with any un-audited references. `scripts/optimize-public-images.mjs` regenerates the WebP files when their source changes.

The final production build's initial bundle is **980.69 kB raw / 198.22 kB estimated transfer**, compared with the **922.38 kB / 180.97 kB** baseline. The SSR/hydration/SEO and analytics integration increased the initial bundle; it remains over the 550 kB configured warning budget. The image byte reduction is measured, but LCP/INP/CLS and CrUX field data were not measured in this environment.

## Analytics and conversions

GTM/GA4 is configured in the app using owner-supplied IDs and an explicit consent banner. The app loads only the GTM container (`GTM-5FG93SJC`) after consent on the production origin; GA4 is configured through GTM with `G-WWQX1NRF3W`. There is no direct `gtag.js` installation. Angular navigation produces sanitized, non-duplicated page views; contact/enquiry/registration events send only allowlisted values. See [the GTM/GA4 implementation and manual setup guide](../analytics/GA4_IMPLEMENTATION.md). The remote container has not been configured or published by this code change.

No cab enquiry UI or advertisement impression/click component was found, so those events are not emitted. Registration conversion is tracked only after the backend accepts a new service submission. No customer details are included.

## Modified files

- Angular SSR/prerender: `angular.json`, `package.json`, `package-lock.json`, `src/main.server.ts`, `src/app/app.config.server.ts`, `src/app/app.routes.server.ts`, `src/app/app.config.ts`, `tsconfig.app.json`, `src/prerender-routes.txt`.
- SEO services and pages: `src/app/core/services/seo.service.ts`, `service-category.service.ts`, `service-directory.service.ts`, `essential-service.service.ts`, `local-brand.service.ts`, `job.service.ts`, `lodge-reviews.service.ts`, `supabase.service.ts`, `src/app/core/auth/auth.service.ts`, `src/app/app.ts`, public category/service/tourism/jobs/business components and SEO specs.
- Analytics: `src/app/core/services/analytics.service.ts`, its spec, `src/environments/environment.ts`, contact and successful hotel-enquiry components.
- Generated assets/artifacts: `scripts/generate-seo-artifacts.mjs`, `scripts/optimize-public-images.mjs`, `public/sitemap.xml`, `public/assets/images/*.webp`, and generated service links.
- Default HTML metadata: `src/index.html`.

## Deployment checklist

1. Run `npm run test:sitemap` and `npm ci`, then `npm run build`; the sitemap task is offline, while the separate prerender artifact step needs public Supabase read access.
2. Deploy only the normal static asset output at `dist/community-app/browser`; do not deploy or start a Node server.
3. Confirm the platform serves a prerendered deep route, serves the six canonical landing paths without a trailing-slash redirect, returns `/robots.txt` as `text/plain` and `/sitemap.xml` as XML, and preserves authentication/admin route behavior.
4. Inspect rendered HTML for a current service, category and tourism route. Confirm RLS/public projections, canonical, robots and JSON-LD before release.
5. Verify unknown-path HTTP status separately; current SPA fallback returns an HTML shell with 200.
6. Re-run the generation/build/deployment after service publication or verification changes to refresh the prerender snapshot. The six-page sitemap is independent of listing data; edit the centralized allowlist only when an approved landing-page URL changes.
7. Do not claim Search Console verification, GA4 activation, indexing or rankings until verified in the corresponding Google property.

No production deployment was performed.
