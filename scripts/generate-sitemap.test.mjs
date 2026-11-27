import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { SITEMAP_URLS } from './sitemap-urls.mjs';

test('sitemap has exactly the approved landing-page allowlist', async () => {
  const xml = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

  assert.deepEqual(locations, SITEMAP_URLS);
  assert.equal((xml.match(/<url>/g) ?? []).length, 6);
  assert.doesNotMatch(xml, /<lastmod>|<priority>|<changefreq>/);
});
