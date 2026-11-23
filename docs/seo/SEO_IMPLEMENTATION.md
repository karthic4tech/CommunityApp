# SEO implementation and deployment notes

## Implemented

- `SeoService` updates title, description, robots, canonical, Open Graph, Twitter card and document language without duplicating tags. Canonicals use `https://cdm360.in`, drop query/fragment values and use a no-trailing-slash path convention (except `/`).
- The same service inserts one global JSON-LD graph containing Organization and WebSite entities, with only the verified project brand, canonical origin, existing logo asset and English/Tamil languages. It does not assert local business address, phone, reviews, rating, opening hours or price.
- Home, tourism, service directory, category, subcategory, verified service detail and not-found routes use actual application/category/listing values for metadata. Listing descriptions use stored public descriptions when available; otherwise they use a short factual directory description.
- Detail lookup/loading and missing-listing states are noindex until a published, verified result is returned.
- Private application route families are noindex after Angular navigation. Existing authentication guards and database RLS remain the access controls.
- `public/robots.txt` references the sitemap and excludes non-search route families. Robots exclusions are not security controls.
- `public/sitemap.xml` contains only current stable public routes that exist in the router. It intentionally has no `lastmod` because a trusted modification timestamp was not verified.
- A keyboard-accessible Angular wildcard 404 view was added. It is noindex.
- No Supabase schema or migration was changed.

## Important limitations

Production Cloudflare config uses static assets with `not_found_handling: "single-page-application"`. `SeoService` runs only after JavaScript executes. It cannot add route titles, content, canonical tags or a true HTTP status to the initial server response. The live response audit confirms this is still a critical search-rendering blocker.

The safe next architecture decision is a Cloudflare-supported Angular SSR worker or controlled prerender pipeline:

1. Prerender stable public editorial pages (home and tourism) without user/session data.
2. Decide whether categories/listings are generated from a public, RLS-enforced export at build/revalidation time or served by edge SSR using only anonymous public projections.
3. Do not prerender every UUID/slug or every Supabase row by default. Bound output and paginate sitemap indexes if they grow.
4. Exclude account/admin/auth/submission pages from prerender and apply noindex. Keep Supabase auth browser-only; no service-role key may enter browser or prerender output.
5. Configure edge route fallback so supported Angular deep routes still work while unknown paths return HTTP 404.
6. Compare initial HTML, auth, duplicate Supabase requests, cold/warm latency and Cloudflare usage before promoting.

No SSR adapter, worker, schema change or deployment configuration was introduced without confirming owner approval and a test deployment target.

## Sitemap maintenance

The current sitemap is deliberately small and static. Add a generated URL only after its route and public content exist. A dynamic sitemap generator must filter `service_listings.status = published`, verified providers, active categories and public availability using the existing public access policy; use only real `updated_at`/published timestamps if present. Do not export contact details or private data.

## Deployment checklist

1. Install dependencies and run `npm test -- --watch=false` and `npm run build`.
2. Preview the exact Cloudflare asset deployment; confirm `/robots.txt` is plain text and `/sitemap.xml` is XML, not SPA HTML.
3. Confirm Angular deep links continue to load, and inspect the response status for an unknown URL.
4. Check raw (not browser-rendered) HTML for titles, descriptions, canonical URL and main headings on homepage, tourism, category and a public listing.
5. Check private routes retain guards and noindex.
6. Deploy only through the project owner’s normal release procedure. No production deployment was performed.
