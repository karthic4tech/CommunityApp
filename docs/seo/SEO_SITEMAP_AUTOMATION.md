# Sitemap automation and indexability

## Architecture

CDM 360 deploys Angular prerendered static assets to Cloudflare (`wrangler.jsonc` points at `dist/community-app/browser`). There is no running server or authenticated sitemap endpoint. Sitemap generation therefore happens during `npm run build`, using the same read-only anonymous Supabase access already used to build public prerender routes. No service-role key or new database object is used.

The inventory query selects only the fields needed to determine public route eligibility:

- Active service categories, parent relationship, slug, names and `updated_at`.
- Published service listing ID/slug/category, title/description and publication/update timestamps, joined to active categories and verified providers.

It does not query customer enquiries, authentication, private profiles, booking data, or contact values. Supabase RLS remains the security boundary.

## Indexability and canonical policy

- The six established landing routes remain in the sitemap: `/`, `/services`, `/businesses`, `/tourism`, `/essential-services`, and `/jobs`.
- Two source-backed tourism guides are explicitly included: `/tourism/nataraja-temple-guide` and `/tourism/pichavaram-mangrove-forest`. They carry official Cuddalore District source links, source update dates and local verification dates; other proposed editorial routes are not generated from a name list.
- Eligible root categories use `/services/category/{slug}`.
- Eligible nested categories use `/services/{parent-slug}/{subcategory-slug}`. Existing `/services/category/{child-slug}` paths remain prerendered for compatibility but canonicalize to the nested URL and are omitted from the sitemap.
- Published listing details with a routable slug use `/services/{listing-slug}`. UUID provider-detail URLs remain supported as a compatibility fallback where an existing slug is invalid.
- A service detail is included in the sitemap only if the listing has a valid route, non-placeholder title/provider name, and a description of at least 20 characters. Short/placeholder listing pages may remain available to users but receive `noindex,follow`.
- A category is indexable when its eligible published listing count meets `SEO_MIN_PUBLIC_LISTINGS_PER_CATEGORY` (default `1`, configurable from 1 to 1000 at build time). The generated `SEO_INDEXABLE_PATHS` registry is consumed by category and detail page metadata; sitemap generation and page robots use the same generated snapshot.
- Only real DB timestamps (`updated_at`, with `published_at` fallback) populate `lastmod`. Static landing/editorial pages have no synthetic timestamp.

No standalone business profile route exists: the current business directory points to an eligible service listing. No individual job-detail route, job expiration field, tourism editorial database, or locale-prefixed URLs exist, so the sitemap does not invent them.

## Failure and size behavior

- `scripts/generate-sitemap.mjs` provides an offline fallback containing the six core landing pages and two locally authored, source-backed tourism guides.
- `scripts/generate-seo-artifacts.mjs` writes the dynamic sitemap only after all public inventory queries and XML validation succeed, then atomically renames the completed file.
- A transient Supabase query error fails the build; it does not emit an empty or partial dynamic sitemap. Do not deploy artifacts from a failed build.
- Sitemap URLs are deduplicated and restricted to canonical HTTPS paths on `cdm360.in`; queries and fragments are rejected. XML text is escaped.
- The builder enforces sitemap limits of 50,000 URLs and 50 MB uncompressed. The current inventory fits one sitemap; no index is needed.

## Refresh behavior and remaining automation

Every successful production build refreshes `public/sitemap.xml`, prerender routes, generated category links, and the indexability registry from the current public database snapshot. This is a static-hosting strategy, not a live sitemap endpoint. It does **not** regenerate immediately on each moderation action because this repository has no configured deployment workflow, Cloudflare build hook, or safe webhook credential. Until those are provisioned, run the ordinary build/release pipeline after material publication or unpublishing changes. Never invoke a build hook from a public business transaction.

**Takedown limitation:** an unpublish/delete after deployment does not rewrite already-deployed prerendered HTML by itself. The old static asset can remain accessible until the next successful build/deploy and any CDN invalidation completes. Therefore this static snapshot does not meet an immediate-revocation guarantee on its own. Before relying on unpublishing for urgent privacy/security takedowns, configure a protected publication-triggered build plus cache purge, or move those pages to request-time public/RLS rendering on supported hosting.

The additional recurring service cost introduced here is **$0**: no dependency, new Supabase table, Edge Function, paid server, or analytics product is added. Builds perform the existing anonymous public category/listing reads plus one metadata projection; Cloudflare static asset storage and request/bandwidth use remain under the existing account/plan.

## Operator checks

```sh
npm run test:sitemap
npm run seo:sitemap
npm run seo:generate
npm run build
```

Inspect the generated XML and ensure the six core landing URLs and two tourism guides are present, all listing URLs are still published/verified, nested categories have one sitemap URL, and no private route or query string appears. Validate representative routes with URL Inspection after deployment. The repository cannot submit or verify Google Search Console changes.
