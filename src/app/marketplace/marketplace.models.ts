export type MarketplaceCondition = 'brand_new' | 'like_new' | 'gently_used' | 'good' | 'fair' | 'for_parts';
export type MarketplaceStatus = 'draft' | 'pending_approval' | 'published' | 'rejected' | 'sold' | 'expired' | 'suspended' | 'archived';
export type MarketplaceContactMethod = 'phone' | 'whatsapp' | 'enquiry';
export type MarketplaceEnquiryStatus = 'new' | 'contacted' | 'negotiating' | 'closed' | 'spam';

export interface MarketplaceAttributeDefinition {
  key: string;
  label: string;
  label_ta?: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

export interface MarketplaceCategoryRow {
  id: string;
  parent_id: string | null;
  name: string;
  name_ta: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  attributes_schema: MarketplaceAttributeDefinition[];
  is_active: boolean;
}

export interface MarketplaceCategory extends MarketplaceCategoryRow {
  subcategories: MarketplaceCategory[];
}

export interface MarketplaceListingImage {
  id: string;
  listing_id: string;
  storage_path: string;
  alt_text: string;
  display_order: number;
  is_primary: boolean;
  url?: string | null;
}

export interface MarketplaceListingAttribute {
  id?: string;
  listing_id?: string;
  attribute_name: string;
  attribute_value: string;
}

export interface MarketplaceListing {
  id: string;
  seller_id: string;
  category_id: string;
  subcategory_id: string | null;
  title: string;
  slug: string;
  description: string;
  price: number;
  is_negotiable: boolean;
  condition: MarketplaceCondition;
  brand: string | null;
  model: string | null;
  location_id: string;
  seller_display_name: string;
  seller_contact_phone: string | null;
  contact_method: MarketplaceContactMethod;
  seller_contact_consent: boolean;
  status: MarketplaceStatus;
  rejection_reason: string | null;
  is_featured: boolean;
  published_at: string | null;
  submitted_at: string | null;
  expires_at: string | null;
  sold_at: string | null;
  created_at: string;
  updated_at: string;
  category?: Pick<MarketplaceCategoryRow, 'id' | 'name' | 'name_ta' | 'slug' | 'icon'> | null;
  subcategory?: Pick<MarketplaceCategoryRow, 'id' | 'name' | 'name_ta' | 'slug'> | null;
  images?: MarketplaceListingImage[];
  attributes?: MarketplaceListingAttribute[];
  location?: { id: string; name_en: string | null; name_ta: string } | null;
}

export interface MarketplacePage {
  items: MarketplaceListing[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MarketplaceSearchFilters {
  query?: string;
  categoryId?: string | null;
  subcategoryId?: string | null;
  locationId?: string | null;
  condition?: MarketplaceCondition | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  sort?: 'featured' | 'newest' | 'price_low' | 'price_high';
  page?: number;
  pageSize?: number;
  includeMine?: boolean;
  activeOnly?: boolean;
  featuredOnly?: boolean;
  sellerId?: string | null;
  status?: MarketplaceStatus | 'all' | null;
}

export interface MarketplaceDraftInput {
  category_id: string;
  subcategory_id: string | null;
  title: string;
  description: string;
  price: number;
  is_negotiable: boolean;
  condition: MarketplaceCondition;
  brand: string | null;
  model: string | null;
  location_id: string;
  seller_display_name: string;
  seller_contact_phone: string | null;
  contact_method: MarketplaceContactMethod;
  seller_contact_consent: boolean;
}

export interface MarketplaceEnquiry {
  id: string;
  listing_id: string;
  buyer_id: string;
  seller_id: string;
  message: string;
  status: MarketplaceEnquiryStatus;
  seller_response: string | null;
  created_at: string;
  updated_at: string;
  listing?: Pick<MarketplaceListing, 'id' | 'title' | 'slug' | 'status' | 'price'> | null;
}

export interface MarketplaceReport {
  id: string;
  listing_id: string;
  reporter_id: string | null;
  reason: string;
  description: string | null;
  status: 'open' | 'reviewing' | 'action_taken' | 'dismissed';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  listing?: Pick<MarketplaceListing, 'id' | 'title' | 'slug' | 'status'> | null;
}

export function marketplaceCategoryTree(rows: readonly MarketplaceCategoryRow[], includeInactive = false): MarketplaceCategory[] {
  const sorted = rows.filter(row => includeInactive || row.is_active).slice().sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const map = new Map<string, MarketplaceCategory>();
  for (const row of sorted) {
    if (!map.has(row.id)) map.set(row.id, { ...row, subcategories: [] });
  }
  const roots: MarketplaceCategory[] = [];
  for (const category of map.values()) {
    if (!category.parent_id) roots.push(category);
    else map.get(category.parent_id)?.subcategories.push(category);
  }
  return roots;
}
