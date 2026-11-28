# SEO implementation test results

**Run date:** 2026-11-28
**Repository:** `C:\projects\CommunityApp`  
**Production deployment:** Not performed

## Automated build and test results

| Check | Result | Evidence / caveat |
|---|---|---|
| Baseline `npm run build` | **PASS** | Before this SEO increment: 86 prerendered routes, using public Supabase reads at build time. |
| Final `npm run build` | **PASS** | Prerendered 74 static routes; dynamic sitemap includes 53 unique eligible canonical URLs from the current public-data snapshot. Angular emits `DEP0205` Node deprecation warnings and existing CSS/bundle budget warnings. |
| Production initial bundle | **Warning** | 980.99 kB raw / 198.33 kB estimated transfer, compared with 922.38 kB / 180.97 kB pre-SSR baseline. Initial budget remains 550 kB; existing component-style budget warnings remain. |
| `npm test -- --watch=false` | **PASS** | 27 test files, 146 tests passed on the final test run. |
| SEO service tests | **PASS** | Title/meta/canonical/JSON-LD/noindex, stale metadata cleanup, and script-closing JSON-LD input escaping. |
| GTM/GA4 tests | **PASS** | Production/consent gating, single GTM loader, sanitized six-page views, back-navigation deduplication, private-route gating, safe registration conversion and deduplicated promotion events tested. |
| Sitemap XML | **PASS locally** | `public/sitemap.xml` parses; all six established URLs remain, plus two approved tourism guides and 45 eligible category/service URLs in this data snapshot. URLs are unique, canonical, HTTPS, query-free and omit unsupported priority/changefreq values. Accurate DB timestamps are used where present. |
| Sitemap/indexability policy tests | **PASS** | `npm run test:sitemap`: 8 tests cover the core-route fallback, canonical URLs, XML escaping, invalid/private path rejection, lastmod handling, placeholder content and category route selection. |
| Dynamic generation | **PASS locally** | `npm run seo:generate` read public Supabase inventory and wrote the sitemap, prerender route snapshot, category-link registry and `SEO_INDEXABLE_PATHS`. A failed public data query fails the production build. |
| Private/draft/thin exclusion | **PASS for generated snapshot** | Sitemap excludes private paths and placeholder/thin listing details. Category pages use eligible published/verified listing inventory; private routes and filter/query URLs are absent. |
| Rendered HTML metadata | **PASS locally** | Inspected root, businesses, tourism hub and both guide pages, services, nested category canonical alias, and placeholder service detail. The alias canonical points to the nested route; placeholder detail is `noindex,follow`. |
| Image conversion | **PASS** | Nine selected PNGs total 23.13 MiB; generated WebP set totals 2.64 MiB, an 89% byte reduction. Original PNGs were retained. |
| `git diff --check` | **PASS after whitespace cleanup** | Windows may print CRLF informational notices; no patch whitespace errors remain. |

## Earlier production HTTP observations (2026-11-27; not re-checked in this follow-up)

| URL | HTTP / type | Result |
|---|---|---|
| `/` | `200 text/html` | Old production HTML remains an empty Angular root shell. |
| `/robots.txt` | `200 text/plain` | Current production robots file is readable and references the sitemap. |
| `/sitemap.xml` | `200 application/xml` | Earlier probe observed a dynamic category/listing sitemap. Current remote content was not requested in this follow-up. |
| `/services/category/hotels` | `200 text/html` | Old production route response is the SPA shell, not prerendered HTML. |
| `/no-such-seo-route-987654` | `200 text/html` | SPA fallback does not provide a real HTTP 404. |

Direct production requests to the five non-root landing routes were observed to redirect to trailing-slash URLs (final response `200 text/html`) in the earlier probe. The local Wrangler `drop-trailing-slash` setting remains undeployed; verify after release.

The status probes used `curl.exe`; the body was separately inspected with HTTP fetch. Local build artifacts do not change these live results until the owner deploys.

## Not performed / release validation still required

- No production deploy, Cloudflare preview deployment, redirect/status configuration or post-deploy raw-HTML test.
- No real browser hydration test, Angular navigation/auth/admin workflow test, AXE scan, Lighthouse run, PageSpeed report or device-lab run.
- No Core Web Vitals LCP/INP/CLS or CrUX field measurements. The image byte comparison is not a CWV result.
- No manual Supabase RLS/auth/admin, service submission, booking enquiry, advertisement, or partner-confirmation regression was performed. Existing unit tests pass, but are not substitutes for these flows.
- JSON-LD was inspected in generated HTML and unit-tested, but no Google Rich Results Test or Schema Markup Validator submission was run.
- Owner reports Search Console verification/submission and GA4 Realtime activity; these account states were not independently checked in this run. GTM Preview, current remote container settings, and live request collection were not tested.
- Unknown routes still return HTTP 200 from the existing SPA fallback. Fixing this without breaking direct navigation to protected routes requires a host/edge routing decision.

## Release gate

After deployment, verify raw source HTML on home, tourism, one category and one published service; `/robots.txt` is `text/plain`; `/sitemap.xml` is valid XML containing the six established URLs plus only eligible canonical inventory; landing pages use canonical no-trailing-slash URLs; routes hydrate without duplicate public Supabase calls; existing auth/admin/enquiry workflows still work; and unknown routes have an explicitly accepted status behavior.
