import { Injectable, inject } from '@angular/core';
import { LocalBrand } from '../models/local-brand';
import { MediaService } from './media.service';
import { SupabaseService } from './supabase.service';
import { PUBLIC_BUCKET } from '../models/media.models';

interface BusinessLogoRow {
  role: string;
  sort_order: number;
  is_primary: boolean;
  media_assets: {
    storage_path: string;
    bucket_name: string | null;
    visibility: string;
    media_type: string;
    upload_status: string;
    deleted_at: string | null;
    alt_text: string | null;
  } | null;
}

interface BusinessListingRow {
  id: string;
  status: string;
  published_at: string | null;
  service_categories: { is_active: boolean } | null;
}

interface BusinessProviderRow {
  id: string;
  display_name: string;
  provider_type: string;
  verification_status: string;
  is_featured: boolean;
  feature_order: number;
  provider_media: BusinessLogoRow[] | null;
  service_listings: BusinessListingRow[] | null;
}

const PAGE_SIZE = 500;
const BUSINESS_COLUMNS = `id,display_name,provider_type,verification_status,is_featured,feature_order,
  service_listings!inner(id,status,published_at,service_categories!inner(is_active)),
  provider_media(role,sort_order,is_primary,media_assets!inner(storage_path,bucket_name,visibility,media_type,upload_status,deleted_at,alt_text))`;

@Injectable({ providedIn: 'root' })
export class LocalBrandService {
  private readonly supabase = inject(SupabaseService);
  private readonly media = inject(MediaService);

  /** Approved businesses with an active published listing and public logo, if available. */
  async featuredBusinesses(): Promise<LocalBrand[]> {
    return this.loadBusinesses(true);
  }

  /** Eligible business rows available to administrators for featuring and ordering. */
  async eligibleBusinesses(): Promise<LocalBrand[]> {
    return this.loadBusinesses(false);
  }

  async updateFeature(providerId: string, featured: boolean, order: number): Promise<void> {
    if (!Number.isInteger(order) || order < 0) {
      throw new Error('Display order must be a non-negative whole number.');
    }
    const { data, error } = await this.supabase.client
      .from('service_providers')
      .update({ is_featured: featured, feature_order: order })
      .eq('id', providerId)
      .eq('provider_type', 'business')
      .eq('verification_status', 'verified')
      .select('id')
      .maybeSingle<{ id: string }>();
    if (error) {
      if (error.code === '42703' || error.code === 'PGRST204') {
        throw new Error('Apply the featured local brands database migration before managing homepage brands.');
      }
      throw new Error('Unable to update this business feature setting.');
    }
    if (!data) throw new Error('This approved business is no longer available. Refresh the list and try again.');
  }

  private async loadBusinesses(featuredOnly: boolean): Promise<LocalBrand[]> {
    const uniqueRows = new Map<string, BusinessProviderRow>();
    for (let start = 0; ; start += PAGE_SIZE) {
      let query = this.supabase.client
        .from('service_providers')
        .select(BUSINESS_COLUMNS)
        .eq('provider_type', 'business')
        .eq('verification_status', 'verified')
        .eq('service_listings.status', 'published')
        .eq('service_listings.service_categories.is_active', true)
        .eq('provider_media.role', 'logo')
        .eq('provider_media.media_assets.visibility', 'public')
        .eq('provider_media.media_assets.media_type', 'image')
        .eq('provider_media.media_assets.upload_status', 'uploaded')
        .is('provider_media.media_assets.deleted_at', null);
      if (featuredOnly) query = query.eq('is_featured', true);

      const { data, error } = await query
        .order('feature_order', { ascending: true })
        .order('display_name', { ascending: true })
        .order('id', { ascending: true })
        .range(start, start + PAGE_SIZE - 1)
        .returns<BusinessProviderRow[]>();
      if (error) throw new Error('Unable to load local businesses.');

      const rows = data ?? [];
      for (const row of rows) {
        if (row.provider_type !== 'business' || row.verification_status !== 'verified' || featuredOnly && !row.is_featured) continue;
        const existing = uniqueRows.get(row.id);
        if (!existing) {
          uniqueRows.set(row.id, row);
          continue;
        }
        const listings = new Map([...(existing.service_listings ?? []), ...(row.service_listings ?? [])].map((listing) => [listing.id, listing]));
        const media = new Map([...(existing.provider_media ?? []), ...(row.provider_media ?? [])].map((item) => [item.media_assets?.storage_path ?? `${item.role}:${item.sort_order}`, item]));
        uniqueRows.set(row.id, { ...row, service_listings: [...listings.values()], provider_media: [...media.values()] });
      }
      if (rows.length < PAGE_SIZE) break;
    }

    return [...uniqueRows.values()]
      .map((row) => this.toLocalBrand(row))
      .filter((brand): brand is LocalBrand => brand !== null)
      .sort((a, b) => a.featureOrder - b.featureOrder || a.displayName.localeCompare(b.displayName) || a.id.localeCompare(b.id));
  }

  private toLocalBrand(row: BusinessProviderRow): LocalBrand | null {
    const listing = (row.service_listings ?? [])
      .filter((candidate) => candidate.status === 'published' && candidate.service_categories?.is_active === true)
      .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? '') || a.id.localeCompare(b.id))[0];
    if (!listing) return null;

    const logo = (row.provider_media ?? [])
      .filter((media) => media.role === 'logo' && this.isPublicLogo(media.media_assets))
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order)[0]?.media_assets;
    const logoUrl = logo ? this.media.getPublicUrl(logo.storage_path) : null;

    return {
      id: row.id,
      displayName: row.display_name,
      featured: row.is_featured,
      featureOrder: row.feature_order,
      listingId: listing.id,
      logoUrl,
      logoAlt: logo?.alt_text?.trim() || `${row.display_name} logo`,
    };
  }

  private isPublicLogo(asset: BusinessLogoRow['media_assets']): boolean {
    if (!asset || asset.visibility !== 'public' || asset.media_type !== 'image' || asset.upload_status !== 'uploaded' || asset.deleted_at) return false;
    // A public card must never ask Storage for a private-bucket object.
    return asset.bucket_name === PUBLIC_BUCKET || asset.bucket_name === null && /^https:\/\//i.test(asset.storage_path);
  }
}
