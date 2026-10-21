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
