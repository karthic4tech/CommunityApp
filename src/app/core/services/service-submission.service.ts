import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { contactHref } from '../models/service-listing';
import { SubmissionFormInput, SubmissionHistoryRow, SubmissionLocationInput, SubmissionRow } from '../models/service-submission';
import { SupabaseService } from './supabase.service';

const SUBMISSION_COLUMNS = `id,provider_id,category_id,title,description,status,submitted_at,published_at,updated_at,
  service_providers!inner(id,owner_user_id,provider_type,display_name,description,verification_status,public_email,website_url,address,postal_code,latitude,longitude),
  service_categories(id,parent_id,name_ta,name_en,slug),
  listing_contacts(contact_type,contact_value,is_public,sort_order),
  listing_locations(coverage_type,locations(id,name_ta,name_en)),
  listing_verification_history(id,decision,notes,created_at,reviewer_user_id),
  listing_media(sort_order,media_assets(id)),
  service_listing_revisions(id,version_number,status,review_notes,updated_at)`;

@Injectable({ providedIn: 'root' })
export class ServiceSubmissionService {
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService);

  async listMine(): Promise<SubmissionRow[]> {
    const user = this.requireUser();
    const { data, error } = await this.supabase.client
      .from('service_listings')
      .select(SUBMISSION_COLUMNS)
      .eq('service_providers.owner_user_id', user.id)
      .order('updated_at', { ascending: false })
      .returns<SubmissionRow[]>();
    if (error) throw new Error('Unable to load your submissions.');
    return data ?? [];
  }

  async getMine(id: string): Promise<SubmissionRow | null> {
    const user = this.requireUser();
    const { data, error } = await this.supabase.client
      .from('service_listings')
      .select(SUBMISSION_COLUMNS)
      .eq('id', id)
      .eq('service_providers.owner_user_id', user.id)
      .maybeSingle<SubmissionRow>();
    if (error) throw new Error('Unable to load this submission.');
    return data;
  }

  async history(id: string): Promise<SubmissionHistoryRow[]> {
    this.requireUser();
    const { data, error } = await this.supabase.client
      .from('listing_verification_history')
      .select('id,decision,notes,created_at,reviewer_user_id')
      .eq('listing_id', id)
      .order('created_at', { ascending: false })
      .returns<SubmissionHistoryRow[]>();
    if (error) throw new Error('Unable to load submission feedback.');
    return data ?? [];
  }

  async save(input: SubmissionFormInput): Promise<string> {
    const user = this.requireUser();
    this.validateInput(input);
    let providerId = input.providerId;
    if (providerId) {
      const { error } = await this.supabase.client.from('service_providers').update({
        provider_type: input.provider.provider_type,
        display_name: input.provider.display_name,
        description: input.provider.description,
        public_email: input.provider.public_email,
        website_url: input.provider.website_url,
        address: input.provider.address,
        postal_code: input.provider.postal_code,
        latitude: input.provider.latitude,
        longitude: input.provider.longitude,
      }).eq('id', providerId).eq('owner_user_id', user.id);
      if (error) throw new Error('Unable to save provider details.');
    } else {
      const { data, error } = await this.supabase.client.from('service_providers').insert({
        owner_user_id: user.id,
        provider_type: input.provider.provider_type,
        display_name: input.provider.display_name,
        description: input.provider.description,
        verification_status: 'pending',
        public_email: input.provider.public_email,
        website_url: input.provider.website_url,
        address: input.provider.address,
        postal_code: input.provider.postal_code,
        latitude: input.provider.latitude,
        longitude: input.provider.longitude,
      }).select('id').single<{ id: string }>();
      if (error || !data) throw new Error('Unable to create provider details.');
      providerId = data.id;
    }

    let listingId = input.listingId;
    if (listingId) {
      const existing = await this.getMine(listingId);
      if (!existing || !['draft', 'pending_review'].includes(existing.status)) {
        throw new Error('Only draft or pending submissions can be edited.');
      }
      const { error } = await this.supabase.client.from('service_listings').update({
        provider_id: providerId,
        category_id: input.listing.category_id,
        title: input.listing.title,
        description: input.listing.description,
        status: input.submitForReview ? 'pending_review' : 'draft',
        submitted_at: input.submitForReview ? new Date().toISOString() : null,
      }).eq('id', listingId);
      if (error) throw new Error('Unable to save the service listing.');
    } else {
      const { data, error } = await this.supabase.client.from('service_listings').insert({
        provider_id: providerId,
        category_id: input.listing.category_id,
        title: input.listing.title,
        description: input.listing.description,
        status: input.submitForReview ? 'pending_review' : 'draft',
        submitted_at: input.submitForReview ? new Date().toISOString() : null,
      }).select('id').single<{ id: string }>();
      if (error || !data) throw new Error('Unable to create the service listing.');
      listingId = data.id;
    }

    await this.replaceContacts(listingId, input.contacts);
    await this.replaceLocations(listingId, input.locations);
    return listingId;
  }

  async saveRevision(input: SubmissionFormInput): Promise<string> {
    const user = this.requireUser();
    if (!input.listingId) throw new Error('The published listing could not be identified.');
    const existing = await this.getMine(input.listingId);
    if (!existing || existing.status !== 'published') throw new Error('Only a published listing can create an approved update.');
    this.validateInput(input);
    const { data: versions, error: versionError } = await this.supabase.client
      .from('service_listing_revisions')
      .select('version_number')
      .eq('listing_id', input.listingId)
      .order('version_number', { ascending: false })
      .range(0, 0)
      .returns<{ version_number: number; status: string }[]>();
    if (versionError) throw new Error('Unable to prepare the listing update.');
    if (versions?.[0]?.status === 'pending_review') throw new Error('An update for this published listing is already awaiting review.');
    const versionNumber = (versions?.[0]?.version_number ?? 0) + 1;
    const { error } = await this.supabase.client.from('service_listing_revisions').insert({
      listing_id: input.listingId,
      version_number: versionNumber,
      submitted_by: user.id,
      status: 'pending_review',
      snapshot: { provider: input.provider, listing: input.listing, contacts: input.contacts, locations: input.locations },
      submitted_at: new Date().toISOString(),
    });
    if (error) throw new Error('Unable to submit this listing update for review.');
    return input.listingId;
  }

  private async replaceContacts(listingId: string, contacts: SubmissionFormInput['contacts']): Promise<void> {
    const { error: deleteError } = await this.supabase.client.from('listing_contacts').delete().eq('listing_id', listingId);
    if (deleteError) throw new Error('Unable to update contact details.');
    if (!contacts.length) return;
    const { error } = await this.supabase.client.from('listing_contacts').insert(contacts.map(contact => ({ ...contact, listing_id: listingId })));
    if (error) throw new Error('Unable to save contact details.');
  }

  private async replaceLocations(listingId: string, locations: SubmissionLocationInput[]): Promise<void> {
    const { error: deleteError } = await this.supabase.client.from('listing_locations').delete().eq('listing_id', listingId);
    if (deleteError) throw new Error('Unable to update service coverage.');
    if (!locations.length) return;
    const { error } = await this.supabase.client.from('listing_locations').insert(locations.map(location => ({ ...location, listing_id: listingId })));
    if (error) throw new Error('Unable to save service coverage.');
  }

  private validateInput(input: SubmissionFormInput): void {
    if (!input.listing.title.trim() || !input.listing.description.trim() || !input.listing.category_id) throw new Error('Complete the service details before saving.');
    if (!input.provider.display_name.trim()) throw new Error('Enter a provider or business name.');
    for (const contact of input.contacts) {
      if (!contactHref(contact.contact_type, contact.contact_value)) throw new Error('One of the contact details is invalid.');
    }
  }

  private requireUser() {
    const user = this.auth.user();
    if (!user) throw new Error('Please sign in to manage submissions.');
    return user;
  }
}
