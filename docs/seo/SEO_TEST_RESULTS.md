# SEO implementation test results

**Run date:** 2026-11-27
**Repository:** `C:\projects\CommunityApp`  
**Production deployment:** Not performed

## Automated build and test results

| Check | Result | Evidence / caveat |
|---|---|---|
| `npm run build` | **PASS** | Builds 86 static routes. Uses public Supabase reads at build time. Angular emits `DEP0205` Node deprecation warnings and existing CSS/bundle budget warnings. |
| Production initial bundle | **Warning** | 979.71 kB raw / 198.02 kB estimated transfer, up from 922.38 kB / 180.97 kB baseline. Initial budget remains 550 kB; service CSS is 12.54 kB against 12 kB. |
| `npm test -- --watch=false` | **PASS** | 26 test files, 141 tests passed on the final test run. |
| SEO service tests | **PASS** | Title/meta/canonical/JSON-LD/noindex and stale metadata/keywords behavior. |
| GTM/GA4 tests | **PASS** | Production/consent gating, single GTM loader, sanitized route pageviews, sensitive-route exclusions, safe registration conversion and deduplicated promotion events tested. |
| Sitemap parse / exact allowlist | **PASS** | `public/sitemap.xml` parses as XML and contains exactly the six requested landing URLs; no query, listing, category, priority, changefreq or lastmod values. |
| Sitemap allowlist regression test | **PASS** | `npm run test:sitemap`: one test confirms the exact allowlist, six entries and no priority/changefreq/lastmod. |
| Sitemap generation isolation | **PASS** | `npm run seo:sitemap` produces the static XML without loading Supabase. Sitemap URLs have corresponding static route files in the build. |
| Private/draft exclusion | **PASS for generated snapshot** | Route list contains only stable public pages, active public categories with published/verified inventory and published/verified detail URLs. It contains no `/admin`, `/auth`, `/account`, submission, private booking or query/filter routes. |
| Rendered HTML metadata | **PASS locally** | Home, tourism, services, category, service detail, businesses and essential services have distinct titles, descriptions, canonical URLs, H1s and JSON-LD in their generated files. |
| Image conversion | **PASS** | Nine selected PNGs total 23.13 MiB; generated WebP set totals 2.64 MiB, an 89% byte reduction. Original PNGs were retained. |
| `git diff --check` | **PASS after whitespace cleanup** | Windows may print CRLF informational notices; no patch whitespace errors remain. |

## Production HTTP checks (pre-deployment)

| URL | HTTP / type | Result |
|---|---|---|
| `/` | `200 text/html` | Old production HTML remains an empty Angular root shell. |
| `/robots.txt` | `200 text/plain` | Current production robots file is readable and references the sitemap. |
| `/sitemap.xml` | `200 application/xml` | Current production still serves the previous dynamic category/listing sitemap; the local build produces the new exact six-URL sitemap. |
| `/services/category/hotels` | `200 text/html` | Old production route response is the SPA shell, not prerendered HTML. |
| `/no-such-seo-route-987654` | `200 text/html` | SPA fallback does not provide a real HTTP 404. |

Direct production requests to the five non-root landing routes currently redirect to trailing-slash URLs (final response `200 text/html`). The new Wrangler `drop-trailing-slash` setting is local-only until deployment; verify that it removes these redirects and agrees with the no-slash canonicals after release.

The status probes used `curl.exe`; the body was separately inspected with HTTP fetch. Local build artifacts do not change these live results until the owner deploys.

## Not performed / release validation still required

- No production deploy, Cloudflare preview deployment, redirect/status configuration or post-deploy raw-HTML test.
- No real browser hydration test, Angular navigation/auth/admin workflow test, AXE scan, Lighthouse run, PageSpeed report or device-lab run.
- No Core Web Vitals LCP/INP/CLS or CrUX field measurements. The image byte comparison is not a CWV result.
- No manual Supabase RLS/auth/admin, service submission, booking enquiry, advertisement, or partner-confirmation regression was performed. Existing unit tests pass, but are not substitutes for these flows.
- JSON-LD was inspected in generated HTML and unit-tested, but no Google Rich Results Test or Schema Markup Validator submission was run.
- Owner reports Search Console verification and sitemap submission are complete. Supplied GA4/GTM IDs are configured in source; GTM Preview, remote container publication, and live GA4 collection were not available to this run and are unverified.
- Unknown routes still return HTTP 200 from the existing SPA fallback. Fixing this without breaking direct navigation to protected routes requires a host/edge routing decision.

## Release gate

After deployment, verify raw source HTML on home, tourism, one category and one published service; `/robots.txt` is `text/plain`; `/sitemap.xml` is valid XML containing exactly the six allowlisted URLs; the landing pages use canonical no-trailing-slash URLs; routes hydrate without duplicate public Supabase calls; existing auth/admin/booking workflows still work; and unknown routes have an explicitly accepted status behavior.
