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
  contact_type: 'phone' | 'whatsapp' | 'email' | 'website' | 'facebook' | 'instagram' | 'youtube' | 'other';
  contact_value: string;
  is_public: boolean;
  sort_order: number;
}

type ContactType = ListingContact['contact_type'];

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
    address?: string | null;
    postal_code?: string | null;
    latitude?: number | null;
    longitude?: number | null;
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

const EMAIL_PATTERN = /^[a-z\d.!#$%&'*+/=?^_`{|}~-]+@[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?)+$/i;
const SOCIAL_HOSTS: Partial<Record<ContactType, readonly string[]>> = {
  facebook: ['facebook.com', 'www.facebook.com'],
  instagram: ['instagram.com', 'www.instagram.com'],
  youtube: ['youtube.com', 'www.youtube.com', 'youtu.be'],
};

export function normalizeContactValue(type: ContactType, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (type === 'phone' || type === 'whatsapp') {
    if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;
    const phone = trimmed.replace(/[\s().-]/g, '');
    return /^\+?\d{7,15}$/.test(phone) ? phone : null;
  }

  if (type === 'email') {
    const [localPart, domain] = trimmed.split('@');
    if (!localPart || !domain || trimmed.length > 254 || localPart.length > 64 || localPart.startsWith('.') || localPart.endsWith('.') || localPart.includes('..') || !EMAIL_PATTERN.test(trimmed)) return null;
    return trimmed;
  }

  if (type === 'website' || type === 'facebook' || type === 'instagram' || type === 'youtube') {
    const hasHttpScheme = /^https?:\/\//i.test(trimmed);
    const hasOtherScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed);
    if (hasOtherScheme && !hasHttpScheme) return null;

    const candidate = trimmed.startsWith('//') ? `https:${trimmed}` : hasHttpScheme ? trimmed : `https://${trimmed}`;
    try {
      const url = new URL(candidate);
      const hostname = url.hostname.toLowerCase();
      const domainLabels = hostname.split('.');
      const validDomain = domainLabels.length > 1 && domainLabels.every(label => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label));
      if (!['https:', 'http:'].includes(url.protocol) || !validDomain || url.username || url.password) return null;

      if (type !== 'website') {
        if (!SOCIAL_HOSTS[type]?.includes(hostname)) return null;
        url.protocol = 'https:';
      }
      return url.href;
    } catch {
      return null;
    }
  }

  return null;
}

export function contactValidationMessage(type: ContactType, value: string): string | null {
  if (!value.trim() || normalizeContactValue(type, value)) return null;

  const messages: Record<ContactType, string> = {
    phone: 'Please enter a valid phone number.',
    whatsapp: 'Please enter a valid WhatsApp number.',
    email: 'Please enter a valid email address.',
    website: 'Please enter a valid website URL.',
    facebook: 'Please enter a valid Facebook URL.',
    instagram: 'Please enter a valid Instagram URL.',
    youtube: 'Please enter a valid YouTube URL.',
    other: 'Please enter valid contact details.',
  };
  return messages[type];
}

export function contactHref(type: ListingContact['contact_type'], value: string): string | null {
  const normalized = normalizeContactValue(type, value);
  if (!normalized) return null;
  if (type === 'phone') return `tel:${normalized}`;
  if (type === 'whatsapp') return `https://wa.me/${normalized.replace(/^\+/, '')}`;
  if (type === 'email') return `mailto:${normalized}`;
  return normalized;
}
