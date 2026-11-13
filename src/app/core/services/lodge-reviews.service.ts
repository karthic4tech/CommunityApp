import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { SupabaseService } from './supabase.service';

export type LodgeReviewSort = 'newest' | 'highest' | 'lowest';
export type LodgeReviewDecision = 'approve' | 'hide' | 'dismiss';

export interface LodgeReviewSummary {
  readonly listing_id: string;
  readonly average_rating: number;
  readonly review_count: number;
}

export interface LodgeReview {
  readonly id: string;
  readonly listing_id: string;
  readonly rating: number;
  readonly title: string | null;
  readonly review_text: string;
  readonly status: 'pending_review' | 'published' | 'hidden';
  readonly created_at: string;
  readonly lodge_review_owner_responses?: readonly { response_text: string; updated_at: string }[] | { response_text: string; updated_at: string } | null;
}

export interface LodgeReviewPage {
  readonly reviews: readonly LodgeReview[];
  readonly total: number;
}

export interface LodgeReviewAdminRow extends LodgeReview {
  readonly service_listings: {
    readonly title: string;
    readonly service_providers: { readonly display_name: string };
  };
}

export interface LodgeReviewReportRow {
  readonly id: string;
  readonly review_id: string;
  readonly reason: string;
  readonly details: string | null;
  readonly created_at: string;
  readonly lodge_reviews: LodgeReviewAdminRow;
}

@Injectable({ providedIn: 'root' })
export class LodgeReviewsService {
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService);

  async summary(listingId: string): Promise<LodgeReviewSummary | null> {
    const { data, error } = await this.supabase.client.from('lodge_review_summaries')
      .select('listing_id,average_rating,review_count').eq('listing_id', listingId)
      .maybeSingle<LodgeReviewSummary>();
    if (error) throw new Error('Unable to load lodge ratings.');
    return data;
  }

  async reviews(listingId: string, sort: LodgeReviewSort, page: number, pageSize = 5): Promise<LodgeReviewPage> {
    let query = this.supabase.client.from('lodge_reviews')
      .select('id,listing_id,rating,title,review_text,status,created_at,lodge_review_owner_responses(response_text,updated_at)', { count: 'exact' })
      .eq('listing_id', listingId).eq('status', 'published');
    if (sort === 'newest') query = query.order('created_at', { ascending: false });
    else query = query.order('rating', { ascending: sort === 'lowest' }).order('created_at', { ascending: false });
    const { data, error, count } = await query.range(page * pageSize, page * pageSize + pageSize - 1).returns<LodgeReview[]>();
    if (error) throw new Error('Unable to load lodge reviews.');
    return { reviews: data ?? [], total: count ?? 0 };
  }

  async myReview(listingId: string): Promise<LodgeReview | null> {
    const user = this.requireUser();
    const { data, error } = await this.supabase.client.from('lodge_reviews')
      .select('id,listing_id,rating,title,review_text,status,created_at')
      .eq('listing_id', listingId).eq('author_user_id', user.id).maybeSingle<LodgeReview>();
    if (error) throw new Error('Unable to load your review.');
    return data;
  }

  async saveReview(listingId: string, rating: number, title: string, reviewText: string, existingId: string | null): Promise<LodgeReview> {
    this.requireUser();
    const cleanTitle = title.trim() || null;
    const cleanText = reviewText.trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Choose a rating from 1 to 5 stars.');
    if (cleanTitle && cleanTitle.length > 120) throw new Error('Review titles must be 120 characters or fewer.');
    if (cleanText.length < 10 || cleanText.length > 3000) throw new Error('Reviews must be 10 to 3000 characters.');

    const values = { rating, title: cleanTitle, review_text: cleanText };
    const result = existingId
      ? await this.supabase.client.from('lodge_reviews').update({ ...values, status: 'pending_review' }).eq('id', existingId).eq('listing_id', listingId)
        .select('id,listing_id,rating,title,review_text,status,created_at').single<LodgeReview>()
      : await this.supabase.client.from('lodge_reviews').insert({ listing_id: listingId, ...values })
        .select('id,listing_id,rating,title,review_text,status,created_at').single<LodgeReview>();
    if (result.error) {
      if (result.error.code === '23505') throw new Error('You already have an active review for this lodge. Edit your review instead.');
      throw new Error('Unable to save your review. Please try again.');
    }
    if (!result.data) throw new Error('The review could not be confirmed. Please try again.');
    return result.data;
  }

  async report(reviewId: string, reason: string, details: string): Promise<void> {
    this.requireUser();
    const { error } = await this.supabase.client.from('lodge_review_reports').insert({
      review_id: reviewId, reason, details: details.trim() || null,
    });
    if (error?.code === '23505') throw new Error('You have already reported this review.');
    if (error) throw new Error('Unable to send this report. Please try again.');
  }

  async respond(reviewId: string, responseText: string): Promise<void> {
    this.requireUser();
    const text = responseText.trim();
    if (!text || text.length > 2000) throw new Error('Responses must be 1 to 2000 characters.');
    const { error } = await this.supabase.client.from('lodge_review_owner_responses')
      .upsert({ review_id: reviewId, response_text: text }, { onConflict: 'review_id' });
    if (error) throw new Error('Unable to save the lodge response.');
  }

  async ownsListing(listingId: string): Promise<boolean> {
    const user = this.auth.user();
    if (!user) return false;
    const { data, error } = await this.supabase.client.rpc('is_lodge_listing_owner', { _listing_id: listingId });
    if (error) throw new Error('Unable to check lodge ownership.');
    return data === true;
  }

  async pendingReviews(): Promise<LodgeReviewAdminRow[]> {
    const { data, error } = await this.supabase.client.from('lodge_reviews')
      .select('id,listing_id,rating,title,review_text,status,created_at,service_listings!inner(title,service_providers!inner(display_name))')
      .eq('status', 'pending_review').order('created_at', { ascending: true }).returns<LodgeReviewAdminRow[]>();
    if (error) throw new Error('Unable to load reviews awaiting moderation.');
    return data ?? [];
  }

  async openReports(): Promise<LodgeReviewReportRow[]> {
    const { data, error } = await this.supabase.client.from('lodge_review_reports')
      .select('id,review_id,reason,details,created_at,lodge_reviews!inner(id,listing_id,rating,title,review_text,status,created_at,service_listings!inner(title,service_providers!inner(display_name)))')
      .eq('status', 'open').order('created_at', { ascending: true }).returns<LodgeReviewReportRow[]>();
    if (error) throw new Error('Unable to load reported lodge reviews.');
    return data ?? [];
  }

  async moderate(reviewId: string, decision: LodgeReviewDecision, notes: string, reportId: string | null = null): Promise<void> {
    this.requireUser();
    const { error } = await this.supabase.client.rpc('moderate_lodge_review', {
      _review_id: reviewId, _decision: decision, _notes: notes.trim() || null, _report_id: reportId,
    });
    if (error) throw new Error('Unable to moderate this lodge review.');
  }

  private requireUser() {
    const user = this.auth.user();
    if (!user) throw new Error('Please sign in to continue.');
    return user;
  }
}
