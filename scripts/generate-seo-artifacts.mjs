import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { ADDITIONAL_SEO_PATHS, SITEMAP_URLS } from './sitemap-urls.mjs';
import { buildSitemapXml } from './sitemap-builder.mjs';
import { canonicalServiceCategoryPath, isIndexablePublicListing } from './seo-indexability.mjs';

const pageSize = 500;
const maxPublicRoutes = 50_000;
const staticRoutes = [
  ...SITEMAP_URLS.map((url) => new URL(url).pathname),
  ...ADDITIONAL_SEO_PATHS,
];
const publicRoutePath = /^\/(?:tourism|services|providers|businesses|essential-services|jobs)(?:\/[a-z0-9-]+)*$/;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const listingSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*-[a-f0-9]{8}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const minimumCategoryListings = Number(process.env['SEO_MIN_PUBLIC_LISTINGS_PER_CATEGORY'] ?? '1');

if (!Number.isInteger(minimumCategoryListings) || minimumCategoryListings < 1 || minimumCategoryListings > 1000) {
  throw new Error('SEO_MIN_PUBLIC_LISTINGS_PER_CATEGORY must be a whole number between 1 and 1000.');
}

function latestTimestamp(current, candidate) {
  const validCurrent = typeof current === 'string' && Number.isFinite(Date.parse(current)) ? current : null;
  if (typeof candidate !== 'string' || !Number.isFinite(Date.parse(candidate))) return validCurrent;
  if (!validCurrent || Date.parse(candidate) > Date.parse(validCurrent)) return candidate;
  return validCurrent;
}

function readPublicSupabaseConfig(source) {
  const read = (name) => source.match(new RegExp(`${name}:\\s*'([^']*)'`))?.[1]?.trim() ?? '';
  return { url: read('supabaseUrl'), key: read('supabasePublishableKey') };
}

async function fetchAll(queryFactory) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryFactory().range(from, from + pageSize - 1);
    if (error) throw new Error(`Public SEO data query failed (${error.code ?? 'unknown'}).`);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
    if (rows.length >= maxPublicRoutes) throw new Error('Prerender generation exceeded the 50,000 public route limit.');
  }
}

async function main() {
  const environmentSource = await readFile(resolve('src/environments/environment.ts'), 'utf8');
  const { url, key } = readPublicSupabaseConfig(environmentSource);
  if (!url || !key) {
    throw new Error('Public Supabase configuration is required to safely refresh the published-content sitemap and prerender snapshot.');
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const categories = await fetchAll(() => supabase.from('service_categories')
    .select('id,parent_id,slug,name_en,name_ta,updated_at')
    .eq('is_active', true)
    .order('slug'));
  const listings = await fetchAll(() => supabase.from('service_listings')
    .select('id,slug,category_id,title,description,published_at,updated_at,service_categories!inner(is_active),service_providers!inner(verification_status,display_name)')
    .eq('status', 'published')
    .eq('service_categories.is_active', true)
    .eq('service_providers.verification_status', 'verified')
    .not('slug', 'is', null)
    .order('slug'));

  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const listingCountByCategoryId = new Map();
  const lastmodByCategoryId = new Map(categories.map((category) => [category.id, category.updated_at]));
  const indexableListingIds = new Set();
  for (const listing of listings) {
    if (!isIndexablePublicListing(listing)) continue;
    indexableListingIds.add(listing.id);
    let current = categoryById.get(listing.category_id);
    const seen = new Set();
    while (current && !seen.has(current.id)) {
      listingCountByCategoryId.set(current.id, (listingCountByCategoryId.get(current.id) ?? 0) + 1);
      lastmodByCategoryId.set(current.id, latestTimestamp(lastmodByCategoryId.get(current.id), listing.updated_at ?? listing.published_at));
      seen.add(current.id);
      current = current.parent_id ? categoryById.get(current.parent_id) : undefined;
    }
  }

  const canonicalCategoryRoutes = [];
  const legacyCategoryRoutes = [];
  const canonicalCategoryLinks = [];
  const listingRoutes = [];
  const canonicalSitemapEntries = staticRoutes.map((path) => ({ path }));
  const indexableListingRoutes = [];

  for (const category of categories) {
    if ((listingCountByCategoryId.get(category.id) ?? 0) < minimumCategoryListings
      || !slugPattern.test(category.slug)) continue;
    if (category.parent_id) {
      const parent = categoryById.get(category.parent_id);
      const canonicalPath = canonicalServiceCategoryPath(category, parent);
      if (!canonicalPath) continue;
      canonicalCategoryRoutes.push(canonicalPath);
      legacyCategoryRoutes.push(`/services/category/${category.slug}`);
      canonicalCategoryLinks.push({
        path: canonicalPath,
        nameEnglish: category.name_en,
        nameTamil: category.name_ta,
      });
      canonicalSitemapEntries.push({ path: canonicalPath, lastmod: lastmodByCategoryId.get(category.id) });
      continue;
    }

    const canonicalPath = canonicalServiceCategoryPath(category, null);
    if (!canonicalPath) continue;
    canonicalCategoryRoutes.push(canonicalPath);
    canonicalCategoryLinks.push({
      path: canonicalPath,
      nameEnglish: category.name_en,
      nameTamil: category.name_ta,
    });
    canonicalSitemapEntries.push({ path: canonicalPath, lastmod: lastmodByCategoryId.get(category.id) });
  }

  for (const listing of listings) {
    const path = listingSlugPattern.test(listing.slug)
      ? `/services/${listing.slug}`
      : uuidPattern.test(listing.id) ? `/providers/${listing.id}` : null;
    if (!path) continue;
    listingRoutes.push(path);
    if (!indexableListingIds.has(listing.id)) continue;
    indexableListingRoutes.push(path);
    canonicalSitemapEntries.push({ path, lastmod: listing.updated_at ?? listing.published_at });
  }

  const routeSet = new Set([
    ...staticRoutes,
    ...canonicalCategoryRoutes,
    ...legacyCategoryRoutes,
    ...listingRoutes,
  ]);
  const routes = [...routeSet].filter((path) =>
    path === '/' || publicRoutePath.test(path),
  ).sort((a, b) => a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b));

  const generatedLinks = [
    '// Generated from indexable categories with enough published, verified listing inventory.',
    'export interface SeoDirectoryLink { readonly path: string; readonly nameEnglish: string; readonly nameTamil: string; }',
    `export const SEO_DIRECTORY_LINKS: readonly SeoDirectoryLink[] = ${JSON.stringify(canonicalCategoryLinks, null, 2)};`,
    '',
  ].join('\n');
  const generatedIndexablePaths = [
    '// Generated alongside the sitemap from the shared public SEO inventory policy.',
    `export const SEO_INDEXABLE_PATHS: readonly string[] = ${JSON.stringify([...staticRoutes, ...canonicalCategoryRoutes, ...indexableListingRoutes].sort(), null, 2)};`,
    '',
  ].join('\n');
  if (routes.length > maxPublicRoutes) {
    throw new Error('The combined public prerender route set exceeded the 50,000 route limit.');
  }
  const sitemapXml = buildSitemapXml(canonicalSitemapEntries);

  await Promise.all([
    writeFile(resolve('src/prerender-routes.txt'), `${routes.join('\n')}\n`, 'utf8'),
    writeFile(resolve('src/app/core/services/seo-directory-links.generated.ts'), generatedLinks, 'utf8'),
    writeFile(resolve('src/app/core/services/seo-indexable-paths.generated.ts'), generatedIndexablePaths, 'utf8'),
  ]);
  const sitemapTemporaryPath = resolve(`.cdm360-generated-sitemap-${process.pid}.tmp`);
  const sitemapOutputPath = resolve('public/sitemap.xml');
  try {
    await writeFile(sitemapTemporaryPath, sitemapXml, 'utf8');
    await rename(sitemapTemporaryPath, sitemapOutputPath);
  } finally {
    await rm(sitemapTemporaryPath, { force: true });
  }
  console.log(`Generated ${routes.length} public prerender routes and ${canonicalSitemapEntries.length} sitemap candidates (active categories: ${categories.length}; published verified listings: ${listingRoutes.length}; indexable listing details: ${indexableListingRoutes.length}; category inventory threshold: ${minimumCategoryListings}).`);
}

main().catch((error) => {
  console.error(`SEO artifact refresh failed; do not deploy this build. ${error instanceof Error ? error.message : 'Unknown error.'}`);
  process.exitCode = 1;
});
