import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';
import { DirectoryLocation } from '../core/models/service-listing';
import { ServiceDirectoryService } from '../core/services/service-directory.service';
import { SupabaseService } from '../core/services/supabase.service';
import {
  MarketplaceCategory,
  MarketplaceCategoryRow,
  MarketplaceDraftInput,
  MarketplaceEnquiry,
  MarketplaceListing,
  MarketplaceListingAttribute,
  MarketplaceListingImage,
  MarketplacePage,
  MarketplaceReport,
  MarketplaceSearchFilters,
  marketplaceCategoryTree,
} from './marketplace.models';

const IMAGE_BUCKET = 'cdm360-marketplace-images';
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const CATEGORY_COLUMNS = 'id,parent_id,name,name_ta,slug,description,icon,sort_order,attributes_schema,is_active';
const LISTING_SELECT = `*,category:marketplace_categories!marketplace_listings_category_id_fkey(id,name,name_ta,slug,icon),subcategory:marketplace_categories!marketplace_listings_subcategory_id_fkey(id,name,name_ta,slug),location:locations!marketplace_listings_location_id_fkey(id,name_en,name_ta),images:marketplace_listing_images(id,listing_id,storage_path,alt_text,display_order,is_primary),attributes:marketplace_listing_attributes(id,listing_id,attribute_name,attribute_value)`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface MarketplaceCategoryMutation {
  id?: string;
  parent_id: string | null;
  name: string;
  name_ta: string;
  slug: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  attributes_schema: MarketplaceCategoryRow['attributes_schema'];
  is_active: boolean;
}

export interface MarketplaceAdminStats {
  total: number;
  pending: number;
  published: number;
  rejected: number;
  reported: number;
  sold: number;
}

@Injectable({ providedIn: 'root' })
export class MarketplaceService {
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService);
  private readonly directory = inject(ServiceDirectoryService);
  private readonly document = inject(DOCUMENT);

  rememberViewed(id: string): void {
    if (!UUID.test(id)) return;
    try {
      const storage = this.document.defaultView?.localStorage;
      if (!storage) return;
      const previous = JSON.parse(storage.getItem('cdm360-marketplace-recent') ?? '[]') as unknown;
      const ids = Array.isArray(previous) ? previous.filter((value): value is string => typeof value === 'string' && UUID.test(value)) : [];
      storage.setItem('cdm360-marketplace-recent', JSON.stringify([id, ...ids.filter(value => value !== id)].slice(0, 8)));
    } catch { /* Recently viewed is an optional convenience. */ }
  }

  async recentlyViewed(): Promise<MarketplaceListing[]> {
    let ids: string[] = [];
    try {
      const stored: unknown = JSON.parse(this.document.defaultView?.localStorage.getItem('cdm360-marketplace-recent') ?? '[]');
      if (Array.isArray(stored)) ids = stored.filter((value): value is string => typeof value === 'string' && UUID.test(value)).slice(0, 8);
    } catch { return []; }
    if (!ids.length) return [];
    const { data, error } = await this.supabase.client.from('marketplace_listings').select(LISTING_SELECT)
      .in('id', ids).eq('status', 'published').returns<MarketplaceListing[]>();
    if (error) return [];
    const ordered = new Map((data ?? []).map(item => [item.id, item]));
    return this.signImages(ids.flatMap(id => ordered.has(id) ? [ordered.get(id)!] : []));
  }

  currentUserId(): string | null { return this.auth.user()?.id ?? null; }
  hasAdminAccess(): boolean { return this.auth.isAdmin(); }

  async categories(includeInactive = false): Promise<MarketplaceCategory[]> {
    let query = this.supabase.client.from('marketplace_categories').select(CATEGORY_COLUMNS).order('sort_order').order('name');
    if (!includeInactive) query = query.eq('is_active', true);
    const { data, error } = await query.returns<MarketplaceCategoryRow[]>();
    if (error) throw new Error('Unable to load marketplace categories.');
    return marketplaceCategoryTree(data ?? [], includeInactive);
  }

  async flatCategories(includeInactive = false): Promise<MarketplaceCategoryRow[]> {
    let query = this.supabase.client.from('marketplace_categories').select(CATEGORY_COLUMNS).order('sort_order').order('name');
    if (!includeInactive) query = query.eq('is_active', true);
    const { data, error } = await query.returns<MarketplaceCategoryRow[]>();
    if (error) throw new Error('Unable to load marketplace categories.');
    return data ?? [];
  }

  async locations(): Promise<DirectoryLocation[]> { return this.directory.locations(); }

  async settings(): Promise<{ allow_free_listings: boolean; default_expiry_days: number; max_images_per_listing: number }> {
    const { data, error } = await this.supabase.client.from('marketplace_settings')
      .select('allow_free_listings,default_expiry_days,max_images_per_listing').eq('id', true)
      .maybeSingle<{ allow_free_listings: boolean; default_expiry_days: number; max_images_per_listing: number }>();
    if (error || !data) throw new Error('Unable to load marketplace settings.');
    return data;
  }

  async imageUrl(storagePath: string): Promise<string | null> {
    if (!storagePath || storagePath.startsWith('/') || storagePath.split('/').some(part => part === '..')) return null;
    const { data, error } = await this.supabase.client.storage.from(IMAGE_BUCKET).createSignedUrl(storagePath, 3600);
    return error ? null : data.signedUrl;
  }

  async search(filters: MarketplaceSearchFilters = {}): Promise<MarketplacePage> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(48, Math.max(1, filters.pageSize ?? 12));
    const from = (page - 1) * pageSize;
    const userId = filters.includeMine ? this.requireUser().id : null;
    let query = this.supabase.client.from('marketplace_listings')
      .select(LISTING_SELECT, { count: 'exact' });
    if (userId) {
      query = query.eq('seller_id', userId);
      if (filters.status === 'expired') query = query.or(`status.eq.expired,and(status.eq.published,expires_at.lte.${new Date().toISOString()})`);
      else if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
      if (filters.activeOnly) query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    } else {
      query = query.eq('status', 'published').or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);
    }
    if (filters.featuredOnly) query = query.eq('is_featured', true);
    if (filters.sellerId && UUID.test(filters.sellerId)) query = query.eq('seller_id', filters.sellerId);
    if (filters.categoryId && UUID.test(filters.categoryId)) query = query.eq('category_id', filters.categoryId);
    if (filters.subcategoryId && UUID.test(filters.subcategoryId)) query = query.eq('subcategory_id', filters.subcategoryId);
    if (filters.locationId && UUID.test(filters.locationId)) query = query.eq('location_id', filters.locationId);
    if (filters.condition) query = query.eq('condition', filters.condition);
    if (filters.minPrice !== null && filters.minPrice !== undefined && Number.isFinite(filters.minPrice)) query = query.gte('price', filters.minPrice);
    if (filters.maxPrice !== null && filters.maxPrice !== undefined && Number.isFinite(filters.maxPrice)) query = query.lte('price', filters.maxPrice);
    const term = filters.query?.trim().slice(0, 100).replace(/[%,()]/g, ' ');
    if (term) query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%,brand.ilike.%${term}%,model.ilike.%${term}%,seller_display_name.ilike.%${term}%`);
    if (filters.sort === 'featured') query = query.order('is_featured', { ascending: false }).order('published_at', { ascending: false, nullsFirst: false });
    else if (filters.sort === 'price_low') query = query.order('price', { ascending: true });
    else if (filters.sort === 'price_high') query = query.order('price', { ascending: false });
    else if (filters.sort === 'newest') query = query.order('published_at', { ascending: false, nullsFirst: false });
    else query = query.order('is_featured', { ascending: false }).order('published_at', { ascending: false, nullsFirst: false });
    const { data, error, count } = await query.order('id', { ascending: true }).range(from, from + pageSize - 1).returns<MarketplaceListing[]>();
    if (error) throw new Error('Unable to search marketplace listings.');
    return { items: await this.signImages(data ?? []), total: count ?? 0, page, pageSize };
  }

  async detail(id: string): Promise<MarketplaceListing | null> {
    if (!UUID.test(id)) return null;
    const { data, error } = await this.supabase.client.from('marketplace_listings').select(LISTING_SELECT)
      .eq('id', id).maybeSingle<MarketplaceListing>();
    if (error) throw new Error('Unable to load this marketplace listing.');
    if (!data) return null;
    return (await this.signImages([data]))[0] ?? null;
  }

  async detailByRoute(id: string, slug: string): Promise<MarketplaceListing | null> {
    const listing = await this.detail(id);
    return listing && listing.slug === slug ? listing : null;
  }

  async ownListing(id: string): Promise<MarketplaceListing | null> {
    const user = this.requireUser();
    if (!UUID.test(id)) return null;
    const { data, error } = await this.supabase.client.from('marketplace_listings').select(LISTING_SELECT)
      .eq('id', id).eq('seller_id', user.id).maybeSingle<MarketplaceListing>();
    if (error) throw new Error('Unable to load your marketplace listing.');
    return data ? (await this.signImages([data]))[0] ?? null : null;
  }

  async createDraft(input: MarketplaceDraftInput): Promise<MarketplaceListing> {
    const user = this.requireUser();
    this.validateDraft(input);
    const { data, error } = await this.supabase.client.from('marketplace_listings').insert({
      ...input, seller_id: user.id, status: 'draft',
    }).select('id,slug').single<{ id: string; slug: string }>();
    if (error || !data) throw this.errorFrom(error, 'Unable to save this marketplace draft.');
    return { id: data.id, slug: data.slug } as MarketplaceListing;
  }

  async updateDraft(id: string, input: MarketplaceDraftInput): Promise<void> {
    this.requireUser();
    this.validateDraft(input);
    const { data, error } = await this.supabase.client.from('marketplace_listings').update(input)
      .eq('id', id).select('id').maybeSingle<{ id: string }>();
    if (error || !data) throw this.errorFrom(error, 'Only your draft or rejected marketplace listings can be edited.');
  }

  async saveAttributes(listingId: string, attributes: readonly MarketplaceListingAttribute[]): Promise<void> {
    const { error: deleteError } = await this.supabase.client.from('marketplace_listing_attributes').delete().eq('listing_id', listingId);
    if (deleteError) throw new Error('Unable to update product details.');
    const rows = attributes.filter(row => row.attribute_value.trim()).map(row => ({
      listing_id: listingId, attribute_name: row.attribute_name, attribute_value: row.attribute_value.trim().slice(0, 500),
    }));
    if (!rows.length) return;
    const { error } = await this.supabase.client.from('marketplace_listing_attributes').insert(rows);
    if (error) throw new Error('Unable to save product-specific details.');
  }

  async uploadImage(listingId: string, file: File, altText: string, order: number, primary: boolean): Promise<MarketplaceListingImage> {
    const user = this.requireUser();
    if (!UUID.test(listingId)) throw new Error('Save the listing draft before adding photos.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Use a JPG, PNG or WebP product photo.');
    if (file.size > IMAGE_MAX_BYTES) throw new Error('Each product image must be 5 MB or smaller.');
    const fileName = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`) + this.extension(file.type);
    const path = `${user.id}/${listingId}/${fileName}`;
    const { error: uploadError } = await this.supabase.client.storage.from(IMAGE_BUCKET).upload(path, file, { upsert: false, contentType: file.type });
    if (uploadError) throw new Error('Unable to upload this image. Check the file and try again.');
    if (primary) await this.supabase.client.from('marketplace_listing_images').update({ is_primary: false }).eq('listing_id', listingId);
    const { data, error } = await this.supabase.client.from('marketplace_listing_images').insert({
      listing_id: listingId, storage_path: path, alt_text: altText.trim().slice(0, 200), display_order: order, is_primary: primary,
    }).select('id,listing_id,storage_path,alt_text,display_order,is_primary').single<MarketplaceListingImage>();
    if (error || !data) {
      await this.supabase.client.storage.from(IMAGE_BUCKET).remove([path]);
      throw new Error('The image uploaded, but its listing record could not be saved.');
    }
    return data;
  }

  async removeImage(image: MarketplaceListingImage): Promise<void> {
    const { error } = await this.supabase.client.from('marketplace_listing_images').delete().eq('id', image.id);
    if (error) throw new Error('Unable to remove the image from this draft.');
    const { error: storageError } = await this.supabase.client.storage.from(IMAGE_BUCKET).remove([image.storage_path]);
    if (storageError) console.warn('Marketplace image cleanup is pending.', { code: storageError.name });
  }

  async reorderImages(listingId: string, images: readonly MarketplaceListingImage[]): Promise<void> {
    await Promise.all(images.map((image, index) => this.supabase.client.from('marketplace_listing_images')
      .update({ display_order: index }).eq('id', image.id).eq('listing_id', listingId)));
  }

  async setPrimaryImage(listingId: string, imageId: string): Promise<void> {
    const { error: clearError } = await this.supabase.client.from('marketplace_listing_images')
      .update({ is_primary: false }).eq('listing_id', listingId);
    if (clearError) throw new Error('Unable to set the primary image.');
    const { error } = await this.supabase.client.from('marketplace_listing_images')
      .update({ is_primary: true }).eq('id', imageId).eq('listing_id', listingId);
    if (error) throw new Error('Unable to set the primary image.');
  }

  async submitForApproval(id: string, acceptRules: boolean): Promise<void> {
    const { error } = await this.supabase.client.rpc('submit_marketplace_listing', { _listing_id: id, _accept_rules: acceptRules });
    if (error) throw new Error(error.message.includes('image') ? 'Add at least one product photo before submitting.' : 'Unable to submit this listing for approval.');
  }

  async markSold(id: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('mark_marketplace_listing_sold', { _listing_id: id });
    if (error) throw new Error('Unable to mark this item as sold.');
  }

  async renew(id: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('renew_marketplace_listing', { _listing_id: id });
    if (error) throw new Error(error.message.includes('image') ? 'Add at least one product photo before renewing.' : 'Unable to renew this listing.');
  }

  async archive(id: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('archive_marketplace_listing', { _listing_id: id });
    if (error) throw new Error('Unable to archive this listing.');
  }

  async favoriteIds(): Promise<Set<string>> {
    const user = this.requireUser();
    const { data, error } = await this.supabase.client.from('marketplace_favourites').select('listing_id').eq('user_id', user.id);
    if (error) throw new Error('Unable to load favourites.');
    return new Set((data ?? []).map(row => row.listing_id as string));
  }

  async toggleFavourite(listingId: string, saved: boolean): Promise<void> {
    const user = this.requireUser();
    if (saved) {
      const { error } = await this.supabase.client.from('marketplace_favourites').delete().eq('user_id', user.id).eq('listing_id', listingId);
      if (error) throw new Error('Unable to remove this favourite.');
    } else {
      const { error } = await this.supabase.client.from('marketplace_favourites').upsert({ user_id: user.id, listing_id: listingId }, { onConflict: 'user_id,listing_id', ignoreDuplicates: true });
      if (error) throw new Error('Unable to save this favourite.');
    }
  }

  async favourites(page = 1): Promise<MarketplacePage> {
    const user = this.requireUser();
    const pageSize = 12;
    const { data, error, count } = await this.supabase.client.from('marketplace_favourites')
      .select(`created_at,listing:marketplace_listings!inner(${LISTING_SELECT})`, { count: 'exact' })
      .eq('user_id', user.id).eq('listing.status', 'published').order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw new Error('Unable to load saved listings.');
    const rows = (data ?? []).flatMap(row => row.listing ? [row.listing as unknown as MarketplaceListing] : []);
    return { items: await this.signImages(rows), total: count ?? rows.length, page, pageSize };
  }

  async createEnquiry(listing: MarketplaceListing, message: string): Promise<void> {
    const buyer = this.requireUser();
    const trimmed = message.trim();
    if (trimmed.length < 2 || trimmed.length > 2000) throw new Error('Write a message between 2 and 2,000 characters.');
    const { error } = await this.supabase.client.from('marketplace_enquiries').insert({
      listing_id: listing.id, buyer_id: buyer.id, seller_id: listing.seller_id, message: trimmed,
    });
    if (error?.code === '23505') throw new Error('You have already sent an enquiry for this listing. You can follow up from My Enquiries.');
    if (error) throw new Error('Unable to send your enquiry. Please try again.');
  }

  async reportListing(listingId: string, reason: string, description: string): Promise<void> {
    const user = this.requireUser();
    const { error } = await this.supabase.client.from('marketplace_reports').insert({
      listing_id: listingId, reporter_id: user.id, reason, description: description.trim() || null,
    });
    if (error?.code === '23505') throw new Error('You have already reported this listing.');
    if (error) throw new Error('Unable to submit your report.');
  }

  async enquiries(asSeller: boolean): Promise<MarketplaceEnquiry[]> {
    const user = this.requireUser();
    const ownerColumn = asSeller ? 'seller_id' : 'buyer_id';
    const { data, error } = await this.supabase.client.from('marketplace_enquiries')
      .select('*,listing:marketplace_listings!marketplace_enquiries_listing_id_fkey(id,title,slug,status,price)')
      .eq(ownerColumn, user.id).order('created_at', { ascending: false }).returns<MarketplaceEnquiry[]>();
    if (error) throw new Error('Unable to load marketplace enquiries.');
    return data ?? [];
  }

  async respondToEnquiry(enquiryId: string, response: string, status: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('respond_to_marketplace_enquiry', {
      _enquiry_id: enquiryId, _response: response.trim(), _status: status,
    });
    if (error) throw new Error('Unable to update this enquiry.');
  }

  async adminStats(): Promise<{ total: number; pending: number; published: number; rejected: number; reported: number; sold: number }> {
    this.requireAdmin();
    const countListings = async (status?: string) => {
      let query = this.supabase.client.from('marketplace_listings').select('id', { count: 'exact', head: true });
      if (status) query = query.eq('status', status);
      const { count, error } = await query;
      if (error) throw new Error('Unable to load marketplace statistics.');
      return count ?? 0;
    };
    const [total, pending, published, rejected, sold, reports] = await Promise.all([
      countListings(), countListings('pending_approval'), countListings('published'), countListings('rejected'), countListings('sold'),
      this.supabase.client.from('marketplace_reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    ]);
    if (reports.error) throw new Error('Unable to load marketplace statistics.');
    return { total, pending, published, rejected, sold, reported: reports.count ?? 0 };
  }

  async myListingStats(): Promise<{ total: number; active: number; pending: number; sold: number; drafts: number; rejected: number; expired: number }> {
    const user = this.requireUser();
    const countStatus = async (status?: string) => {
      let query = this.supabase.client.from('marketplace_listings').select('id', { count: 'exact', head: true }).eq('seller_id', user.id);
      if (status) query = query.eq('status', status);
      const { count, error } = await query;
      if (error) throw new Error('Unable to load your marketplace summary.');
      return count ?? 0;
    };
    const [total, active, pending, sold, drafts, rejected, expiredQuery] = await Promise.all([
      countStatus(), countStatus('published'), countStatus('pending_approval'), countStatus('sold'), countStatus('draft'), countStatus('rejected'),
      this.supabase.client.from('marketplace_listings').select('id',{count:'exact',head:true}).eq('seller_id',user.id).eq('status','published').not('expires_at','is',null).lte('expires_at',new Date().toISOString()),
    ]);
    if (expiredQuery.error) throw new Error('Unable to load your marketplace summary.');
    return { total, active: Math.max(0, active - (expiredQuery.count ?? 0)), pending, sold, drafts, rejected, expired: expiredQuery.count ?? 0 };
  }

  async saveSettings(input: { allow_free_listings: boolean; default_expiry_days: number; max_images_per_listing: number }): Promise<void> {
    this.requireAdmin();
    const { error } = await this.supabase.client.from('marketplace_settings').update(input).eq('id', true);
    if (error) throw new Error('Unable to save marketplace settings.');
  }

  async moderationLogs(listingId?: string): Promise<Array<{ id: string; listing_id: string | null; action: string; remarks: string | null; created_at: string }>> {
    this.requireAdmin();
    let query = this.supabase.client.from('marketplace_moderation_logs').select('id,listing_id,action,remarks,created_at').order('created_at', { ascending: false }).limit(100);
    if (listingId && UUID.test(listingId)) query = query.eq('listing_id', listingId);
    const { data, error } = await query;
    if (error) throw new Error('Unable to load marketplace moderation history.');
    return data ?? [];
  }

  async adminListings(status?: string, queryTerm?: string, page = 1): Promise<MarketplacePage> {
    this.requireAdmin();
    const pageSize = 20;
    let query = this.supabase.client.from('marketplace_listings').select(LISTING_SELECT, { count: 'exact' });
    if (status && status !== 'all') query = query.eq('status', status);
    const term = queryTerm?.trim().slice(0, 100).replace(/[%,()]/g, ' ');
    if (term) query = query.or(`title.ilike.%${term}%,seller_display_name.ilike.%${term}%,slug.ilike.%${term}%`);
    const { data, error, count } = await query.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1).returns<MarketplaceListing[]>();
    if (error) throw new Error('Unable to load marketplace moderation.');
    const items = await this.signImages(data ?? []);
    return { items, total: count ?? 0, page, pageSize };
  }

  async moderateListing(id: string, decision: 'approve' | 'reject' | 'suspend' | 'restore', remarks: string, featured: boolean | null): Promise<void> {
    this.requireAdmin();
    const { error } = await this.supabase.client.rpc('admin_moderate_marketplace_listing', {
      _listing_id: id, _decision: decision, _remarks: remarks.trim() || null, _feature: featured,
    });
    if (error) throw new Error('Unable to save the moderation decision.');
  }

  async reports(): Promise<MarketplaceReport[]> {
    this.requireAdmin();
    const { data, error } = await this.supabase.client.from('marketplace_reports')
      .select('*,listing:marketplace_listings!marketplace_reports_listing_id_fkey(id,title,slug,status)')
      .order('created_at', { ascending: false }).returns<MarketplaceReport[]>();
    if (error) throw new Error('Unable to load marketplace reports.');
    return data ?? [];
  }

  async resolveReport(reportId: string, status: 'reviewing' | 'action_taken' | 'dismissed'): Promise<void> {
    this.requireAdmin();
    const { error } = await this.supabase.client.rpc('admin_resolve_marketplace_report', { _report_id: reportId, _status: status, _remarks: null });
    if (error) throw new Error('Unable to update this report.');
  }

  async saveCategory(input: MarketplaceCategoryMutation): Promise<void> {
    this.requireAdmin();
    const { id, ...values } = input;
    const query = id
      ? this.supabase.client.from('marketplace_categories').update(values).eq('id', id)
      : this.supabase.client.from('marketplace_categories').insert(values);
    const { error } = await query;
    if (error) throw new Error('Unable to save marketplace category.');
  }

  private async signImages(rows: readonly MarketplaceListing[]): Promise<MarketplaceListing[]> {
    const paths = [...new Set(rows.flatMap(row => row.images?.map(image => image.storage_path) ?? []))];
    if (!paths.length) return rows.map(row => ({ ...row, images: row.images ?? [] }));
    const { data, error } = await this.supabase.client.storage.from(IMAGE_BUCKET).createSignedUrls(paths, 3600);
    const urls = new Map((error ? [] : data ?? []).map(row => [row.path, row.signedUrl]));
    return rows.map(row => ({ ...row, images: (row.images ?? []).map(image => ({ ...image, url: urls.get(image.storage_path) ?? null })) }));
  }

  private validateDraft(input: MarketplaceDraftInput): void {
    if (!input.title.trim() || input.title.trim().length < 3) throw new Error('Enter a title with at least 3 characters.');
    if (!UUID.test(input.category_id) || !UUID.test(input.location_id)) throw new Error('Choose a valid category and location.');
    if (!Number.isFinite(input.price) || input.price < 0) throw new Error('Enter a valid product price.');
    if (input.contact_method !== 'enquiry' && (!input.seller_contact_phone?.trim() || !input.seller_contact_consent)) throw new Error('Add a phone number and confirm its public display consent.');
  }

  private requireUser() {
    const user = this.auth.user();
    if (!user) throw new Error('Please sign in to use the marketplace.');
    return user;
  }

  private requireAdmin(): void {
    this.requireUser();
    if (!this.auth.isAdmin()) throw new Error('Administrator access is required.');
  }

  private errorFrom(error: { message?: string } | null, fallback: string): Error {
    if (error?.message?.includes('Free listings')) return new Error('Free listings are not currently available.');
    return new Error(fallback);
  }

  private extension(mime: string): string {
    if (mime === 'image/jpeg') return '.jpg';
    if (mime === 'image/png') return '.png';
    return '.webp';
  }
}
