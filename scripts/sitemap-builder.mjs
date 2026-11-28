const SITE_ORIGIN = 'https://cdm360.in';
const MAX_SITEMAP_URLS = 50_000;
const MAX_SITEMAP_BYTES = 50 * 1024 * 1024;
const PUBLIC_ROUTE_PATTERN = /^\/(?:|tourism(?:\/[a-z0-9-]+)*|services(?:\/[a-z0-9-]+)*|providers(?:\/[a-z0-9-]+)*|businesses|essential-services|jobs)$/;
const PRIVATE_ROUTE_SEGMENTS = new Set([
  'account', 'admin', 'auth', 'login', 'register', 'submit', 'my-submissions',
  'my-lodging-inquiries', 'service-search', 'password-reset',
]);

export function escapeXmlText(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function canonicalUrl(path) {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
    throw new Error('Sitemap paths must be origin-relative paths.');
  }

  const url = new URL(path, SITE_ORIGIN);
  if (url.origin !== SITE_ORIGIN || url.search || url.hash || url.username || url.password) {
    throw new Error('Sitemap URLs must be canonical HTTPS URLs without query strings or fragments.');
  }

  const pathname = url.pathname === '/' ? '/' : url.pathname.replace(/\/+$/, '');
  const segments = pathname.split('/').filter(Boolean);
  if (!PUBLIC_ROUTE_PATTERN.test(pathname) || segments.some((segment) => PRIVATE_ROUTE_SEGMENTS.has(segment))) {
    throw new Error('Sitemap path is not in the public route family allowlist.');
  }
  return `${SITE_ORIGIN}${pathname}`;
}

function lastModifiedDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * Builds an XML sitemap from canonical, already-eligibility-filtered public
 * routes. Invalid paths fail closed; duplicate URLs are emitted only once.
 */
export function buildSitemapXml(entries) {
  if (!Array.isArray(entries)) throw new Error('Sitemap entries must be an array.');

  const byUrl = new Map();
  for (const entry of entries) {
    const loc = canonicalUrl(entry?.path);
    const lastmod = lastModifiedDate(entry?.lastmod);
    const previous = byUrl.get(loc);
    byUrl.set(loc, previous && previous.lastmod > (lastmod ?? '') ? previous : { loc, lastmod });
  }

  if (byUrl.size > MAX_SITEMAP_URLS) {
    throw new Error(`Sitemap exceeds the ${MAX_SITEMAP_URLS.toLocaleString()} URL limit.`);
  }

  const urls = [...byUrl.values()]
    .sort((left, right) => left.loc === `${SITE_ORIGIN}/`
      ? -1
      : right.loc === `${SITE_ORIGIN}/` ? 1 : left.loc.localeCompare(right.loc));
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map(({ loc, lastmod }) => [
      '  <url>',
      `    <loc>${escapeXmlText(loc)}</loc>`,
      ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
      '  </url>',
    ].join('\n')),
    '</urlset>',
    '',
  ].join('\n');

  if (Buffer.byteLength(xml, 'utf8') > MAX_SITEMAP_BYTES) {
    throw new Error('Sitemap exceeds the 50 MB uncompressed size limit.');
  }
  return xml;
}
