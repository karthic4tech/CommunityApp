# Google Search Console setup

Search Console is not configured or verified by this repository change. No verification token has been created.

## Domain property and DNS TXT verification

1. Sign in to [Google Search Console](https://search.google.com/search-console/) with the account that should own CDM 360.
2. Select **Add property** → **Domain**, then enter `cdm360.in` without a protocol, path or `www`.
3. Copy the TXT record value Google provides. Do not invent or reuse a placeholder verification code.
4. Identify the authoritative DNS provider for `cdm360.in` (check the domain's nameservers). Add the TXT record at the root (`@` or the DNS provider's equivalent). Preserve existing TXT records.
5. Allow DNS propagation, then select **Verify** in Search Console. If verification fails, confirm the nameservers and exact value with the DNS operator; do not delete unrelated records.
6. Treat the property as verified only when Search Console displays verified ownership.

## Submit and validate the sitemap

1. Deploy the current generated static build before submission.
2. In Search Console open **Sitemaps** and submit `https://cdm360.in/sitemap.xml`.
3. Confirm the status is **Success** and the discovered URL count is plausible. “Submitted” does not mean “indexed.”
4. The sitemap is a static six-URL allowlist and does not depend on listing data. If the approved landing-page set changes, update `scripts/sitemap-urls.mjs`, run `npm run seo:sitemap`, and deploy the new static file.

## Inspect important URLs

Use **URL inspection** → **Test live URL** for:

- `https://cdm360.in/`
- `https://cdm360.in/tourism`
- `https://cdm360.in/services`
- `https://cdm360.in/services/category/hotels` and one current published/verified service URL can also be inspected for crawlability, canonical and rendered content, but neither is intentionally included in the six-URL sitemap.

Review the rendered HTML, canonical selection, robots state, crawlability and any resources Google could not load. Use this only after the new build is deployed; production currently returns the old empty SPA shell for public deep links.

## Monitoring

- Review **Indexing → Pages** for blocked URLs, duplicates, canonical conflicts, soft 404s, crawled-not-indexed and redirect issues. Remember that current Cloudflare SPA fallback can make unknown paths return HTTP 200.
- Review **Performance → Search results** by query/page/country/device. Record clicks, impressions, CTR and average position over comparable date windows; do not claim ranking guarantees.
- Review **Experience → Core Web Vitals** after sufficient field data accumulates. Use a Lighthouse/PageSpeed lab run for interim diagnostics and label it lab data, not field data.
- Request indexing only after verifying the page is useful, canonical and crawlable. Sitemap submission is not an indexing guarantee.

No DNS change, property creation, verification or indexing request was made by this implementation.
