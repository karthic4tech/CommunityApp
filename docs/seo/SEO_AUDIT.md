# CDM 360 SEO audit

**Audit date:** 2026-11-27
**Repository:** `C:\projects\CommunityApp`
**Production:** `https://cdm360.in/`
**Production deployment:** Not changed by this work.

## Verified production baseline

Raw HTTP GETs were checked against production. These are pre-deployment results:

| URL | HTTP / content type | Evidence |
|---|---|---|
| `/` | `200 text/html` | `webfetch` returned an empty `<app-root>` shell and the same static brand title as other routes. No route H1, description, canonical, or JSON-LD appears in the source HTML. |
| `/services/category/hotels` | `200 text/html` | Same SPA shell; no category title, H1, or listings in the initial response. |
| `/robots.txt` | `200 text/plain` | File is served correctly and points to the sitemap. It excludes private route families; these rules are not security controls. |
| `/sitemap.xml` | `200 application/xml` | Production still serves the prior dynamic sitemap with category and service-detail URLs. The local build now replaces it with the requested six landing-page URLs; this has not been deployed. |
| `/no-such-seo-route-987654` | `200 text/html` | Cloudflare SPA fallback serves the app shell for unknown URLs rather than returning a real HTTP 404. |

The live source HTML, not a browser-rendered DOM, was inspected. Production still has the empty-root crawlability defect until the new build is deployed.

## Architecture and existing functionality

- `angular.json` uses the Angular application builder; routes are lazy loaded in `src/app/app.routes.ts`.
- `wrangler.jsonc` deploys `dist/community-app/browser` as Cloudflare static assets with SPA not-found handling. There is no production SSR server configured.
- `SeoService` already existed and updated client-side title, description, robots, canonical, Open Graph, Twitter card and Organization/WebSite JSON-LD. Several public route components already called it. Private route guards and Supabase public projections also existed.
- Public category reads select active categories. Public directory reads filter published listings and verified providers and select public listing contacts/media. No service-role credential is present in the browser configuration.
- Existing `/tourism` already contains destination information, official-source links, one- and two-day itinerary ideas, hotel/dining discovery and enquiry guidance. No separate language URL variants exist; English/Tamil is a client-side language choice.
- No Google verification token is stored in the repository. The owner reports Search Console verification and sitemap submission are complete. The supplied GA4/GTM IDs are configured in the app; remote container tags and live collection are not verified.

## Verified issues and risks

| Priority | Issue | Evidence / impact |
|---|---|---|
| Critical | Crawl-critical public routes are client-rendered on production. | Raw HTML contains an empty Angular root, even though route components later fetch Supabase data and update metadata. |
| High | Production's current sitemap is broader than the requested six-page allowlist. | The live XML still contains dynamic categories/listings from the previous generator; the local static sitemap is now exactly six URLs. |
| High | Unknown URLs return the SPA document with HTTP 200. | Wrangler uses `not_found_handling: "single-page-application"`. Angular can render a not-found page, but cannot change the already-sent static response status. |
| Medium | Production source has no useful default description/canonical/social metadata. | The route-specific tags were added client-side and therefore are absent from the live response source. |
| Medium | The directory has large source images. | The nine images selected for primary/tourism surfaces total 23.13 MiB as PNG. This is a byte-level observation, not an LCP measurement. |
| Medium | The initial JavaScript/CSS bundle is already over the configured budget. | Baseline `npm run build`: 922.38 kB raw / 180.97 kB estimated transfer for initial files; multiple component style warnings. |
| Medium | The app does not currently implement a cab quote flow or partner-confirmed booking state. | No matching cab enquiry/booking workflow was found in the route/services audit. Do not generate fake availability or confirmation events. |

## Rendering decision

Static prerendering was selected over a long-running SSR service. It fits the existing Cloudflare static-assets deployment, adds no paid hosting dependency, and produces regular files in the existing `dist/community-app/browser` assets directory. Only the public allowlist from `src/prerender-routes.txt` is rendered. Supabase data is read anonymously through the existing public/RLS-protected projections and serialized through Angular transfer state. Server rendering does not restore browser auth or fetch user roles.

The unknown-route HTTP 404 limitation remains: the SPA fallback is needed for non-prerendered protected routes. Do not claim the 404 status defect is fixed.

## Build-time public inventory snapshot

During the local read-only prerender generation run on 2026-11-27, public Supabase reads returned 255 active categories and 27 published listings with verified providers. They produced 86 prerender routes. The separate six-URL sitemap allowlist is static and makes no database requests. The inventory counts are a build-time snapshot, not a commitment that production data will remain unchanged.

No Supabase row, migration, booking, review or admin record was modified.

## Follow-up repository audit (2026-11-28)

This follow-up inspected `package.json`/`package-lock.json`, Angular build and SSR configuration, client and server bootstrap, route guards, SEO/analytics services, tourism content, sitemap/robots generators, Cloudflare configuration, Supabase migration history, public data projections, admin routes, localization, images, and existing automated tests. The repository supplied to this session was `C:\projects\CommunityApp`; the requested `C:\tmp\community-app` directory does not exist here. The starting Git worktree was clean.

### Baseline captured before changes

- `npm test -- --watch=false`: **PASS**, 143 tests across 26 files.
- `npm run build`: **PASS**, 86 prerendered routes; initial bundle 980.69 kB raw / 198.22 kB estimated transfer.
- Existing Angular bundle/style budget warnings and Node `module.register()` deprecation warnings were present.
- No production request, GTM workspace change, Supabase write, deployment, or Google account operation was performed in this follow-up.

### Reusable architecture and actual schema

- The app is Angular 21 standalone, lazy-routed, hydrated, and prerenders paths from `src/prerender-routes.txt`. `SeoService` already centralizes title, description, robots, canonical, Open Graph/Twitter, and singleton Organization/WebSite plus replaceable route JSON-LD.
- `scripts/generate-seo-artifacts.mjs` already reads `service_categories` and `service_listings` with the public Supabase publishable key and anonymous RLS access; it builds prerender paths and category links. Published listings are constrained by active category and verified provider.
- Existing relevant records have category `slug/is_active/updated_at`, listing `status/published_at/updated_at/slug`, provider `provider_type/verification_status/display_name`, and job `status/published_at/updated_at`. There is no job expiry column, individual job-detail route, or SEO editorial/tourism table in the inspected migrations.
- Business cards currently resolve to an existing public service listing. There is no unique provider-profile slug or distinct `/businesses/:slug` profile route. Service listing slugs are database-generated with an ID suffix; existing database generation is ASCII-based and is not a Tamil transliteration system.
- `/tourism` is an existing bilingual client-side page backed by `tourism-content.ts` and cited external sources. Two standalone source-checked tourism guide routes were added in this increment; there are no separately addressable `/ta/`/`/en/` equivalents.
- The language switcher is client-side (`LanguageService`); there are no reciprocal hreflang URL pairs. Empty locale-prefixed pages would be misleading, so none are introduced.
- Supabase RLS and existing admin guards/functions are in place. No SEO admin screen exists. No SEO-specific webhook, Cloudflare build hook, or checked-in CI workflow was found. `wrangler.jsonc` deploys static assets and SPA fallback; there is no production SSR server or dynamic sitemap endpoint.
- `public/robots.txt` already names the canonical sitemap and disallows several private route families. It is not treated as an access-control mechanism.
- The root/category/service page routes already have SSR/prerender-friendly content and TransferState-backed public reads. Raw production status observed in the earlier audit is separate from this local build; this follow-up does not refresh live HTTP evidence.

### Gaps and risks confirmed

1. Before this follow-up, `public/sitemap.xml` contained only the six static landing pages, while the generator had a separate eligible category/listing inventory. Listing updates appeared in prerender output only on a later build.
2. Category children had both `/services/category/:slug` and `/services/:parent/:child` shapes. Runtime canonical metadata and generated internal links could disagree, risking duplicate indexable URLs.
3. Published-but-thin/placeholder service rows could enter the sitemap merely because they had a routable slug.
4. There is no business-provider profile URL, standalone job detail/expiry workflow, localized URL scheme, or editorial source-management UI. Additional tourism articles still require reviewed content, not route-name fabrication.
5. Static hosting still serves SPA fallback HTML with HTTP 200 for unknown URLs. Fixing status codes without breaking direct loading of existing authenticated routes requires a hosting/edge routing design and deployment validation.
6. Sitemap refresh is build-time. Automatic publication-triggered Cloudflare builds require a secured build hook/CI credential that is not configured in this repository.

### Chosen implementation sequence

1. Keep Angular prerendering and static Cloudflare assets; do not add a paid server or service-role key.
2. Use one build-time public inventory to generate canonical category links, indexability paths, prerender paths, and a dynamic XML sitemap. Preserve the six established static URLs.
3. Apply the generated indexability registry to category and service-detail robots metadata, retain legacy category routes as canonical aliases, and keep placeholder content out of indexable inventory.
4. Add pure XML, route-policy, and generated-artifact tests.
5. Document that publication-triggered regeneration, tourism article publishing, separate language URLs, business-profile schema, admin editing, and true HTTP 404 routing remain infrastructure/content follow-ups.
