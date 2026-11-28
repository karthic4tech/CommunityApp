import { rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ADDITIONAL_SEO_PATHS, SITEMAP_URLS } from './sitemap-urls.mjs';
import { buildSitemapXml } from './sitemap-builder.mjs';

const sitemap = buildSitemapXml([
  ...SITEMAP_URLS.map((url) => ({ path: new URL(url).pathname })),
  ...ADDITIONAL_SEO_PATHS.map((path) => ({ path })),
]);
const outputPath = resolve('public/sitemap.xml');
const temporaryPath = resolve(`.cdm360-static-sitemap-${process.pid}.tmp`);
try {
  await writeFile(temporaryPath, sitemap, 'utf8');
  await rename(temporaryPath, outputPath);
} finally {
  await rm(temporaryPath, { force: true });
}
console.log(`Wrote static sitemap with ${SITEMAP_URLS.length} core pages and ${ADDITIONAL_SEO_PATHS.length} approved tourism guides.`);
