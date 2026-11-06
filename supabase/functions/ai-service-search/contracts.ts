export interface CatalogRow {
  id: string;
  parent_id: string | null;
  slug: string;
  name_ta: string;
  name_en: string | null;
}

export interface Catalog {
  categories: CatalogRow[];
  locations: CatalogRow[];
}

export interface Intent {
  category_slug: string | null;
  location_slug: string | null;
  keywords: string;
  language: 'ta' | 'en';
}

export interface CategoryIntent {
  parent_category_slug: string | null;
  subcategory_slug: string | null;
  language: 'ta' | 'en';
}

function normalized(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase().replace(/\s+/gu, ' ').trim();
}

const COMMON_ALIASES: Readonly<Record<string, readonly string[]>> = {
  restaurants: ['batter', 'idly', 'idli', 'dosa', 'dosai', 'food shop', 'சமையல்', 'இட்லி', 'தோசை', 'மாவு'],
  plumber: ['plumber', 'plumbing', 'பிளம்பர்', 'குழாய் பழுது', 'pipe repair'],
  electrician: ['electrician', 'electrical service', 'எலக்ட்ரீஷியன்', 'மின்சார வேலை'],
  ambulance: ['ambulance', 'ஆம்புலன்ஸ்', 'அவசர ஊர்தி'],
  'ac-service': ['ac service', 'air conditioner repair', 'ஏசி சர்வீஸ்'],
};

/** Resolve only unambiguous catalog names/aliases. AI is used when this is inconclusive. */
export function directIntent(query: string, catalog: Catalog, explicitLocation: CatalogRow | null): Intent | null {
  const text = normalized(query);
  const categoryMatches = catalog.categories.flatMap(row => {
    const terms = [row.slug.replace(/-/gu, ' '), row.name_en ?? '', row.name_ta, ...(COMMON_ALIASES[row.slug] ?? [])]
      .map(normalized).filter(term => term.length >= 2);
    const matches = terms.filter(term => text.includes(term));
    return matches.length ? [{ row, score: Math.max(...matches.map(term => term.length)) }] : [];
  }).sort((a, b) => b.score - a.score);
  if (!categoryMatches.length || (categoryMatches[1] && categoryMatches[0].score === categoryMatches[1].score
    && categoryMatches[0].row.id !== categoryMatches[1].row.id)) return null;

  const locationMatches = explicitLocation ? [] : catalog.locations.flatMap(row => {
    const terms = [row.slug.replace(/-/gu, ' '), row.name_en ?? '', row.name_ta].map(normalized).filter(term => term.length >= 2);
    const matches = terms.filter(term => text.includes(term));
    return matches.length ? [{ row, score: Math.max(...matches.map(term => term.length)) }] : [];
  }).sort((a, b) => b.score - a.score);
  const location = explicitLocation ?? (locationMatches.length && (!locationMatches[1] || locationMatches[0].score > locationMatches[1].score) ? locationMatches[0].row : null);
  return {
    category_slug: categoryMatches[0].row.slug,
    location_slug: location?.slug ?? null,
    keywords: '',
    language: /[\u0b80-\u0bff]/u.test(query) ? 'ta' : 'en',
  };
}

export interface ResolvedSearch {
  category: CatalogRow | null;
  location: CatalogRow | null;
  keywords: string;
  language: 'ta' | 'en';
}

export interface SearchSession {
  identity: string;
  catalog(): Promise<Catalog>;
  reserve(): Promise<boolean>;
  search(intent: ResolvedSearch): Promise<unknown[]>;
}

export class SearchError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code); }
}

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseIntent(value: unknown): Intent {
  if (!record(value) || Object.keys(value).sort().join(',') !== 'category_slug,keywords,language,location_slug'
    || !(value.category_slug === null || typeof value.category_slug === 'string' && value.category_slug.length <= 100)
    || !(value.location_slug === null || typeof value.location_slug === 'string' && value.location_slug.length <= 100)
    || typeof value.keywords !== 'string' || value.keywords.length > 80 || /[\u0000-\u001f]/u.test(value.keywords)
    || !['ta', 'en'].includes(String(value.language))) throw new Error('invalid_intent');
  return value as unknown as Intent;
}

export function parseCategoryIntent(value: unknown): CategoryIntent {
  if (!record(value) || Object.keys(value).sort().join(',') !== 'language,parent_category_slug,subcategory_slug'
    || !(value.parent_category_slug === null || typeof value.parent_category_slug === 'string' && value.parent_category_slug.length <= 100)
    || !(value.subcategory_slug === null || typeof value.subcategory_slug === 'string' && value.subcategory_slug.length <= 100)
    || !['ta', 'en'].includes(String(value.language))) throw new Error('invalid_category_intent');
  return value as unknown as CategoryIntent;
}

// Filter against the complete reachable active hierarchy, excluding orphans/cycles.
export function reachable(rows: CatalogRow[]): CatalogRow[] {
  const ids = new Set(rows.filter(row => row.parent_id === null).map(row => row.id));
  let size = -1;
  while (ids.size !== size) {
    size = ids.size;
    for (const row of rows) if (row.parent_id && ids.has(row.parent_id)) ids.add(row.id);
  }
  return rows.filter(row => ids.has(row.id));
}

export function resolveLocation(rows: CatalogRow[], value: string): CatalogRow | null {
  // Location slugs are only unique per parent. Ambiguous slugs must not pick a town at random.
  const matches = rows.filter(row => row.id === value || row.slug === value);
  return matches.length === 1 ? matches[0] : null;
}

// Explicit field projection also protects signed-in owners/admins: their broader
// RLS visibility must never leak private contacts/assets via this public endpoint.
export function publicListings(rows: unknown[]): unknown[] {
  return rows.flatMap(row => {
    if (!record(row) || row.status !== 'published' || !record(row.service_providers)
      || row.service_providers.verification_status !== 'verified') return [];
    const provider = row.service_providers;
    return [{
      id: row.id, category_id: row.category_id, title: row.title, description: row.description, status: row.status,
      service_providers: {
        display_name: provider.display_name, description: provider.description,
        verification_status: provider.verification_status, public_email: provider.public_email, website_url: provider.website_url,
      },
      listing_contacts: (Array.isArray(row.listing_contacts) ? row.listing_contacts : []).flatMap(contact =>
        record(contact) && contact.is_public === true ? [{ contact_type: contact.contact_type, contact_value: contact.contact_value, is_public: true, sort_order: contact.sort_order }] : []),
      listing_locations: (Array.isArray(row.listing_locations) ? row.listing_locations : []).flatMap(link => {
        if (!record(link) || !record(link.locations) || link.locations.is_active !== true) return [];
        const place = link.locations;
        return [{ coverage_type: link.coverage_type, locations: { id: place.id, parent_id: place.parent_id, name_ta: place.name_ta, name_en: place.name_en, location_type: place.location_type } }];
      }),
      listing_media: (Array.isArray(row.listing_media) ? row.listing_media : []).flatMap(link => {
        if (!record(link) || !record(link.media_assets) || link.media_assets.visibility !== 'public' || link.media_assets.media_type !== 'image') return [];
        return [{ sort_order: link.sort_order, media_assets: { storage_path: link.media_assets.storage_path, media_type: 'image', visibility: 'public' } }];
      }),
    }];
  });
}
