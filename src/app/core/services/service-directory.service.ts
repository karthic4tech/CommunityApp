import { Injectable, inject } from '@angular/core';
import {
  DirectoryListingRow,
  DirectoryLocation,
  DirectoryPage,
  ServiceListing,
  publicListing,
} from '../models/service-listing';
import { SupabaseService } from './supabase.service';

/**
 * Only public columns are selected. The relation filters below are database
 * filters, not a replacement for RLS: they also prevent an authenticated
 * owner/admin session from hydrating private contacts or media in this public
 * browsing flow.
 */
const LISTING_COLUMNS = `id,category_id,title,description,status,published_at,
  service_categories!inner(id,is_active),
  service_providers!inner(id,display_name,description,verification_status,public_email,website_url),
  listing_locations(coverage_type,locations!inner(id,parent_id,name_ta,name_en,location_type,is_active)),
  listing_contacts(contact_type,contact_value,is_public,sort_order),
  listing_media(sort_order,media_assets!inner(storage_path,media_type,visibility))`;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DIRECTORY_PAGE_SIZE = 12;

@Injectable({ providedIn: 'root' })
export class ServiceDirectoryService {
  private readonly supabase = inject(SupabaseService);

  /**
   * Option A from the directory design: the existing RPC supplies the
   * correctly filtered, ordered page of listing ids, then a second public
   * projection hydrates those ids. The RPC order is restored explicitly after
   * the enrichment query because an `in` query has no guaranteed order.
   */
  async search(
    categoryId: string | null,
    locationId: string | null,
    keyword: string,
    page = 0,
  ): Promise<DirectoryPage> {
    const start = page * DIRECTORY_PAGE_SIZE;
    const { data, error } = await this.supabase.client.rpc(
      'directory_listings',
      {
        category: categoryId,
        location: locationId,
        keyword: keyword.trim(),
      },
    )
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .range(start, start + DIRECTORY_PAGE_SIZE)
      .returns<DirectoryListingRow[]>();

    if (error) {
      console.error('Directory search failed:', { code: error.code });
      throw new Error('Unable to load service listings.');
    }

    if (data !== null && (!Array.isArray(data) || data.some(row => !row || typeof row.id !== 'string'))) {
      throw new Error('Invalid directory response.');
    }

    const rpcRows = data ?? [];
    const ids = [...new Set(rpcRows.map(row => row.id))];
    if (!ids.length) return { listings: [], hasMore: false };

    const { data: enriched, error: enrichmentError } = await this.publicListingQuery()
      .in('id', ids)
      .eq('status', 'published')
      .eq('service_providers.verification_status', 'verified')
      .eq('service_categories.is_active', true)
      .eq('listing_contacts.is_public', true)
      .eq('listing_locations.locations.is_active', true)
      .eq('listing_media.media_assets.visibility', 'public')
      .eq('listing_media.media_assets.media_type', 'image')
      .returns<ServiceListing[]>();

    if (enrichmentError) {
      console.error('Directory listing enrichment failed:', { code: enrichmentError.code });
      throw new Error('Unable to load service listings.');
    }

    const byId = new Map((enriched ?? []).map(listing => [listing.id, listing]));
    const listings = ids
      .slice(0, DIRECTORY_PAGE_SIZE)
      .map(id => byId.get(id))
      .filter((listing): listing is ServiceListing => Boolean(listing && publicListing(listing)));

    return {
      listings,
      hasMore: rpcRows.length > DIRECTORY_PAGE_SIZE,
    };
  }

  async detail(id: string): Promise<ServiceListing | null> {
    if (!UUID_PATTERN.test(id)) return null;
    const { data, error } = await this.publicListingQuery()
      .eq('id', id)
      .eq('status', 'published')
      .eq('service_providers.verification_status', 'verified')
      .eq('service_categories.is_active', true)
      .eq('listing_contacts.is_public', true)
      .eq('listing_locations.locations.is_active', true)
      .eq('listing_media.media_assets.visibility', 'public')
      .eq('listing_media.media_assets.media_type', 'image')
      .maybeSingle<ServiceListing>();
    if (error) throw new Error('Unable to load this service listing.');
    return data && publicListing(data) ? data : null;
  }

  async related(providerId: string, excludedListingId: string): Promise<ServiceListing[]> {
    if (!UUID_PATTERN.test(providerId) || !UUID_PATTERN.test(excludedListingId)) return [];
    const { data, error } = await this.publicListingQuery()
      .eq('provider_id', providerId)
      .neq('id', excludedListingId)
      .eq('status', 'published')
      .eq('service_providers.verification_status', 'verified')
      .eq('service_categories.is_active', true)
      .eq('listing_contacts.is_public', true)
      .eq('listing_locations.locations.is_active', true)
      .eq('listing_media.media_assets.visibility', 'public')
      .eq('listing_media.media_assets.media_type', 'image')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .range(0, 5)
      .returns<ServiceListing[]>();
    if (error) throw new Error('Unable to load related service listings.');
    return (data ?? []).filter(publicListing);
  }

  async locations(): Promise<DirectoryLocation[]> {
    const locations: DirectoryLocation[] = [];
    // Do not silently truncate a growing hierarchy at PostgREST's default row limit.
    for (let start = 0; ; start += 500) {
      const { data, error } = await this.supabase.client.from('locations')
        .select('id,parent_id,name_ta,name_en,location_type')
        .eq('is_active', true).order('id').range(start, start + 499)
        .returns<DirectoryLocation[]>();
      if (error) throw new Error('Unable to load locations.');
      locations.push(...(data ?? []));
      if (!data || data.length < 500) return locations;
    }
  }

  imageUrl(path: string): string | null {
    // Core schema does not specify a bucket. Support explicit public URLs or
    // bucket/object paths, never guess a bucket or sign private assets.
    try {
      const url = new URL(path);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch {
      const [bucket, ...parts] = path.split('/');
      if (!bucket || !parts.length || parts.some(part => !part || part === '..' || part === '.')) return null;
      return this.supabase.client.storage.from(bucket).getPublicUrl(parts.join('/')).data.publicUrl;
    }
  }

  private publicListingQuery() {
    return this.supabase.client.from('service_listings').select(LISTING_COLUMNS);
  }
}
