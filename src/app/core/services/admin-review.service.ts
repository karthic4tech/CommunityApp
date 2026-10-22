import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface ReviewListingRow {
  id: string;
  provider_id: string;
  category_id: string;
  title: string;
  description: string;
  status: string;
  submitted_at: string | null;
  service_providers: { id: string; owner_user_id: string; display_name: string; description: string | null; verification_status: string; public_email: string | null; website_url: string | null; address: string | null; postal_code: string | null; latitude: number | null; longitude: number | null };
  service_categories: { name_en: string; name_ta: string; slug: string };
  listing_contacts: { contact_type: string; contact_value: string; is_public: boolean; sort_order: number }[];
  listing_locations: { coverage_type: string; locations: { name_en: string | null; name_ta: string } | null }[];
}

export interface ReviewRevisionRow {
  id: string;
  listing_id: string;
  version_number: number;
  status: string;
  snapshot: {
    provider: { display_name: string; description: string | null; provider_type: string; address: string | null; postal_code: string | null; latitude: number | null; longitude: number | null };
    listing: { category_id: string; title: string; description: string };
    contacts: { contact_type: string; contact_value: string; is_public: boolean }[];
    locations: { location_id: string; coverage_type: string }[];
  };
  review_notes: string | null;
  submitted_at: string | null;
  service_listings: { title: string; status: string; service_providers: { display_name: string; verification_status: string } };
}

const REVIEW_COLUMNS = `id,provider_id,category_id,title,description,status,submitted_at,
  service_providers!inner(id,owner_user_id,display_name,description,verification_status,public_email,website_url,address,postal_code,latitude,longitude),
  service_categories!inner(name_en,name_ta,slug),
  listing_contacts(contact_type,contact_value,is_public,sort_order),
  listing_locations(coverage_type,locations(name_en,name_ta))`;

@Injectable({ providedIn: 'root' })
export class AdminReviewService {
  private readonly supabase = inject(SupabaseService);

  async pending(): Promise<ReviewListingRow[]> {
    const { data, error } = await this.supabase.client.from('service_listings')
      .select(REVIEW_COLUMNS)
      .eq('status', 'pending_review')
      .order('submitted_at', { ascending: true })
      .returns<ReviewListingRow[]>();
    if (error) throw new Error('Unable to load the review queue.');
    return data ?? [];
  }

  async published(): Promise<ReviewListingRow[]> {
    const { data, error } = await this.supabase.client.from('service_listings')
      .select(REVIEW_COLUMNS)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .range(0, 49)
      .returns<ReviewListingRow[]>();
    if (error) throw new Error('Unable to load published listings.');
    return data ?? [];
  }

  async pendingRevisions(): Promise<ReviewRevisionRow[]> {
    const { data, error } = await this.supabase.client.from('service_listing_revisions')
      .select('id,listing_id,version_number,status,snapshot,review_notes,submitted_at,service_listings!inner(title,status,service_providers!inner(display_name,verification_status))')
      .eq('status', 'pending_review')
      .order('submitted_at', { ascending: true })
      .returns<ReviewRevisionRow[]>();
    if (error) throw new Error('Unable to load pending listing updates.');
    return data ?? [];
  }

  async review(id: string, decision: 'approve' | 'request_changes' | 'reject' | 'unpublish', notes: string, verifyProvider: boolean): Promise<void> {
    const { error } = await this.supabase.client.rpc('admin_review_service_listing', {
      _listing_id: id,
      _decision: decision,
      _notes: notes.trim() || null,
      _verify_provider: verifyProvider,
    });
    if (error) throw new Error('Unable to complete this review decision.');
  }

  async reviewRevision(id: string, decision: 'approve' | 'request_changes' | 'reject', notes: string, verifyProvider: boolean): Promise<void> {
    const { error } = await this.supabase.client.rpc('admin_review_service_listing_revision', {
      _revision_id: id,
      _decision: decision,
      _notes: notes.trim() || null,
      _verify_provider: verifyProvider,
    });
    if (error) throw new Error('Unable to complete this revision review.');
  }
}
