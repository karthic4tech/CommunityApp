import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SITEMAP_URLS } from './sitemap-urls.mjs';

const entries = SITEMAP_URLS.map((url) => `  <url>\n    <loc>${url}</loc>\n  </url>`);
const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...entries,
  '</urlset>',
  '',
].join('\n');

await writeFile(resolve('public/sitemap.xml'), sitemap, 'utf8');
console.log(`Wrote static sitemap with ${SITEMAP_URLS.length} approved landing pages.`);
