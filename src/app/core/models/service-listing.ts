import { ServiceCategory } from './service-category';

export interface DirectoryLocation {
  id: string;
  parent_id: string | null;
  name_ta: string;
  name_en: string | null;
  location_type: string;
}

export interface DirectoryListingRow {
  id: string;
  category_id: string;
  published_at?: string | null;
}

export interface ListingContact {
  contact_type: 'phone' | 'whatsapp' | 'email' | 'website' | 'other';
  contact_value: string;
  is_public: boolean;
  sort_order: number;
}

export interface ServiceListing {
  id: string;
  category_id: string;
  title: string;
  description: string;
  status: string;
  published_at?: string | null;
  service_providers: {
    id: string;
    display_name: string;
    description: string | null;
    verification_status: string;
    public_email: string | null;
    website_url: string | null;
  };
  listing_locations: {
    coverage_type: 'based_here' | 'serves_here';
    locations: DirectoryLocation | null;
  }[];
  listing_contacts: ListingContact[];
  listing_media: {
    sort_order: number;
    media_assets: { storage_path: string; media_type: string; visibility: string } | null;
  }[];
}

export interface DirectoryPage {
  listings: ServiceListing[];
  hasMore: boolean;
}

export function findCategory(categories: readonly ServiceCategory[], slug: string): ServiceCategory | undefined {
  for (const category of categories) {
    if (category.slug === slug) return category;
    const child = findCategory(category.subcategories, slug);
    if (child) return child;
  }
  return undefined;
}

export function findCategoryById(categories: readonly ServiceCategory[], id: string): ServiceCategory | undefined {
  for (const category of categories) {
    if (category.id === id) return category;
    const child = findCategoryById(category.subcategories, id);
    if (child) return child;
  }
  return undefined;
}

export function locationOptions(locations: readonly DirectoryLocation[], language: 'ta' | 'en') {
  const byParent = new Map<string | null, DirectoryLocation[]>();
  for (const place of locations) byParent.set(place.parent_id, [...(byParent.get(place.parent_id) ?? []), place]);
  const result: { id: string; label: string }[] = [];
  const seen = new Set<string>();
  function visit(parent: string | null, prefix: string): void {
    for (const place of byParent.get(parent) ?? []) {
      if (seen.has(place.id)) continue;
      seen.add(place.id);
      const name = language === 'ta' ? place.name_ta : place.name_en ?? place.name_ta;
      const label = prefix ? `${prefix} / ${name}` : name;
      result.push({ id: place.id, label });
      visit(place.id, label);
    }
  }
  visit(null, '');
  return result;
}

export function publicListing(listing: ServiceListing): boolean {
  return listing.status === 'published' && listing.service_providers?.verification_status === 'verified';
}

export function contactHref(type: ListingContact['contact_type'], value: string): string | null {
  const trimmed = value.trim();
  if (type === 'phone' || type === 'whatsapp') {
    if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;
    const phone = trimmed.replace(/[\s().-]/g, '');
    if (!/^\+?\d{7,15}$/.test(phone)) return null;
    return type === 'phone' ? `tel:${phone}` : `https://wa.me/${phone.replace(/^\+/, '')}`;
  }
  if (type === 'email') {
    return /^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(trimmed) ? `mailto:${trimmed}` : null;
  }
  if (type === 'website') {
    try {
      const url = new URL(trimmed);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }
  return null;
}
