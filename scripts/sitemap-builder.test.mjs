import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSitemapXml, escapeXmlText } from './sitemap-builder.mjs';
import { SITEMAP_URLS } from './sitemap-urls.mjs';

test('builds unique canonical HTTPS URLs and preserves verified lastmod dates', () => {
  const xml = buildSitemapXml([
    { path: '/services/category/hotels', lastmod: '2026-11-20T12:00:00.000Z' },
    { path: '/services/category/hotels/', lastmod: '2026-11-21T12:00:00.000Z' },
    ...SITEMAP_URLS.map((url) => ({ path: new URL(url).pathname })),
  ]);

  assert.equal((xml.match(/<url>/g) ?? []).length, SITEMAP_URLS.length + 1);
  assert.match(xml, /<loc>https:\/\/cdm360\.in\/services\/category\/hotels<\/loc>\n    <lastmod>2026-11-21<\/lastmod>/);
  assert.doesNotMatch(xml, /<priority>|<changefreq>/);
});

test('XML-escapes text nodes', () => {
  assert.equal(escapeXmlText(`A&B <C> "D" 'E'`), 'A&amp;B &lt;C&gt; &quot;D&quot; &apos;E&apos;');
});

test('rejects non-canonical and off-origin sitemap locations', () => {
  for (const path of [
    'https://example.com/path',
    '//example.com/path',
    '/services?q=private',
    '/services#form',
    '/admin',
    '/services/submit',
    '/auth/sign-in',
  ]) {
    assert.throws(() => buildSitemapXml([{ path }]));
  }
});

test('ignores invalid or missing modification dates instead of inventing them', () => {
  const xml = buildSitemapXml([{ path: '/tourism', lastmod: 'not-a-date' }]);
  assert.match(xml, /<loc>https:\/\/cdm360\.in\/tourism<\/loc>/);
  assert.doesNotMatch(xml, /<lastmod>/);
});
