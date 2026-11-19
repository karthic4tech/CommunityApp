import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { LodgingInquiry, LodgingInquiryInput, LodgingInquiryStatus } from '../models/lodging-inquiry';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class LodgingInquiryService {
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService);

  async submit(input: LodgingInquiryInput): Promise<void> {
    const { error } = await this.supabase.client.from('lodging_inquiries').insert({
      ...input,
      guest_name: input.guest_name.trim(),
      guest_phone: input.guest_phone.trim(),
      guest_email: input.guest_email?.trim() || null,
      message: input.message?.trim() || null,
    });
    if (error) throw new Error(this.getErrorMessage(error, 'send'));
  }

  async listMine(): Promise<LodgingInquiry[]> {
    const user = this.auth.user();
    if (!user) throw new Error('Please sign in to manage lodging enquiries.');
    const { data, error } = await this.supabase.client.from('lodging_inquiries')
      .select('id,listing_id,guest_name,guest_phone,guest_email,question_type,check_in,check_out,guest_count,message,status,created_at,updated_at,service_listings!inner(title,service_providers!inner(display_name,owner_user_id))')
      .eq('service_listings.service_providers.owner_user_id', user.id)
      .order('created_at', { ascending: false })
      .returns<LodgingInquiry[]>();
    if (error) throw new Error(this.getErrorMessage(error, 'load'));
    return data ?? [];
  }

  async listForAdmin(): Promise<LodgingInquiry[]> {
    if (!this.auth.isAuthenticated() || !this.auth.isAdmin()) throw new Error('Administrator access is required.');
    const { data, error } = await this.supabase.client.from('lodging_inquiries')
      .select('id,listing_id,guest_name,guest_phone,guest_email,question_type,check_in,check_out,guest_count,message,status,created_at,updated_at,service_listings!inner(title,service_providers!inner(display_name))')
      .order('created_at', { ascending: false })
      .returns<LodgingInquiry[]>();
    if (error) throw new Error(this.getErrorMessage(error, 'load'));
    return data ?? [];
  }

  async updateStatus(id: string, status: LodgingInquiryStatus): Promise<void> {
    if (!this.auth.user()) throw new Error('Please sign in to manage lodging enquiries.');
    const { error } = await this.supabase.client.from('lodging_inquiries').update({ status }).eq('id', id);
    if (error) throw new Error(this.getErrorMessage(error, 'update'));
  }

  private getErrorMessage(error: { code?: string; message: string }, action: 'send' | 'load' | 'update'): string {
    if (error.code === 'PGRST205' || (error.message.includes('lodging_inquiries') && error.message.toLowerCase().includes('schema cache'))) {
      return 'Lodging enquiries are not enabled on this server yet. Please try again later or contact support.';
    }
    if (action === 'send') return 'Unable to send your lodging enquiry right now. Please try again.';
    if (action === 'load') return 'Unable to load hotel enquiries. Please retry.';
    return 'Unable to update the enquiry status. Please retry.';
  }
}
