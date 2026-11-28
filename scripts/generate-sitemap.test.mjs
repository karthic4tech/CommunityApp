import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ADDITIONAL_SEO_PATHS, SITEMAP_URLS } from './sitemap-urls.mjs';

test('sitemap preserves every approved landing URL and contains unique canonical locations', async () => {
  const xml = await readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8');
  const locations = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

  for (const url of SITEMAP_URLS) assert.ok(locations.includes(url), `${url} must remain in the sitemap`);
  for (const path of ADDITIONAL_SEO_PATHS) assert.ok(locations.includes(`https://cdm360.in${path}`), `${path} must remain in the sitemap`);
  assert.equal(new Set(locations).size, locations.length);
  assert.ok(locations.every((url) => /^https:\/\/cdm360\.in\/(?:[a-z0-9-]+(?:\/[a-z0-9-]+)*)?$/i.test(url)));
  assert.doesNotMatch(xml, /<priority>|<changefreq>/);
});
