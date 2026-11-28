# SEO deployment and rollback

## Deployment

1. Confirm the public publishable Supabase key can read the RLS-filtered public category/listing projections. Never configure a service-role key in Angular or build output.
2. Run `npm run test:sitemap`, `npm test -- --watch=false`, and `npm run build`. Do not deploy if the dynamic public inventory query fails.
3. Inspect `public/sitemap.xml`, `src/prerender-routes.txt`, and representative output under `dist/community-app/browser/` for private records, placeholder listing pages, duplicate category canonicals, and correct robots metadata.
4. Release `dist/community-app/browser` through the existing Cloudflare static-assets pipeline. This code does not deploy or change Cloudflare account settings.
5. Verify `/robots.txt`, `/sitemap.xml`, the six priority landing pages, one eligible category, one service listing, one `noindex` listing, and an unknown URL over HTTP. Wrangler's current SPA fallback still returns HTTP 200 for unknown paths; this is a known hosting limitation, not solved by Angular's 404 component.
6. In Search Console, inspect representative URLs, test live rendering/canonical/indexing eligibility, and resubmit the existing sitemap only when appropriate. Submission and live inspection do not guarantee indexing or rankings.

The build currently prerenders a Tamil initial language tree and restores the user's saved English preference after hydration. Since the app has no independent locale URLs, do not add hreflang alternates or claim independently indexable English/Tamil URL pairs.

**Takedown release gate:** static prerender output can retain a listing's former public HTML until a new artifact deploy and CDN invalidation. Do not treat database unpublishing alone as immediate removal from Cloudflare assets. A private, authenticated publication-triggered build/purge or request-time RLS-backed rendering is still required for immediate revocation.

## Search Console checklist

1. Open the domain property for `cdm360.in` and inspect `https://cdm360.in/robots.txt` and `https://cdm360.in/sitemap.xml` after release.
2. Use URL Inspection → **Test Live URL** for `/`, `/tourism`, `/tourism/nataraja-temple-guide`, `/tourism/pichavaram-mangrove-forest`, `/services`, `/businesses`, `/essential-services`, `/jobs`, one generated nested category, and one currently published/verified service detail.
3. Inspect rendered HTML for the visible H1/content, matching canonical, `index,follow` only on eligible pages, and accurate JSON-LD. Confirm placeholder/thin details return `noindex,follow`.
4. Request indexing once for important new or materially changed eligible pages. Do not request it repeatedly for unchanged pages.
5. Monitor Pages/Indexing for discovered-not-indexed, crawled-not-indexed, duplicate canonical, and soft-404 reports. Watch Search performance impressions, clicks, CTR and average position over time; sitemap acceptance and a passing live test do not guarantee indexing or rank.
6. Use Schema.org Validator and Google Rich Results Test only for relevant schema/page types. Their output is validation, not a promise of enhanced search results.

## Remaining manual work

- Configure any production-host `X-Robots-Tag`/preview-host indexing protection in Cloudflare so preview deployments cannot be indexed.
- Review the currently published GTM/GA4 settings and consent behavior in the owner’s Google workspace; see [`GA4_IMPLEMENTATION.md`](../analytics/GA4_IMPLEMENTATION.md).
- If immediate sitemap refresh after moderation is required, configure a private CI/Cloudflare build hook with an owner-managed secret. Do not expose that hook publicly or invoke it synchronously inside Supabase publication transactions.
- There is no `/admin/seo` editor in this increment. Continue to use existing moderation/admin screens; new editorial overrides need an approved schema, migration, RLS review and admin UX design.

## Rollback

- Roll back by redeploying the previous known-good `dist/community-app/browser` artifact using the existing Cloudflare release process. Preserve the six static URLs in `scripts/sitemap-urls.mjs`.
- No database migration or Google-account change is part of this implementation, so no database or GTM rollback is required.
- If the public Supabase inventory is unavailable, fix the read/RLS/connectivity issue and rerun the build. The dynamic generator fails closed; do not manually publish an empty sitemap or deploy a partially generated build.
- If canonical routing or indexability appears incorrect, disable deployment, restore the prior static artifact, and review `scripts/seo-indexability.mjs`, generated `SEO_INDEXABLE_PATHS`, and page-level canonical/robots output before retrying.
- A future publication-triggered refresh requires an authenticated CI/Cloudflare build hook and rotation/secret-management plan; no such secret is stored in this repository.
