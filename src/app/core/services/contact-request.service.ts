import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { ContactRequest } from '../models/contact-request';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class ContactRequestService {
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService);

  async submit(input: Pick<ContactRequest, 'name' | 'email' | 'mobile' | 'message'>): Promise<void> {
    const { error } = await this.supabase.client.from('contact_requests').insert({
      name: input.name.trim(), email: input.email.trim(), mobile: input.mobile.trim(), message: input.message.trim(),
    });
    if (error) throw new Error('Unable to send your message right now. Please try again.');
  }

  async listForAdmin(): Promise<ContactRequest[]> {
    this.requireAdmin();
    const { data, error } = await this.supabase.client.from('contact_requests')
      .select('id,name,email,mobile,message,status,created_at').order('created_at', { ascending: false }).returns<ContactRequest[]>();
    if (error) throw new Error('Unable to load contact requests.');
    return data ?? [];
  }

  async deleteForAdmin(id: string): Promise<void> {
    this.requireAdmin();
    const { error } = await this.supabase.client.from('contact_requests').delete().eq('id', id);
    if (error) throw new Error('Unable to delete this contact request.');
  }

  private requireAdmin(): void {
    if (!this.auth.isAuthenticated() || !this.auth.isAdmin()) throw new Error('Administrator access is required.');
  }
}
