import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { AdminUser, AdminUserPage, AdminUserQuery, AdminUserStats } from '../models/admin-user';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService);

  async list(query: AdminUserQuery = {}): Promise<AdminUserPage> {
    this.requireAdmin();
    const { data, error } = await this.supabase.client.functions.invoke<AdminUserPage>('admin-users', { body: { operation: 'list', ...query } });
    if (error || !data) throw new Error('Unable to load users.');
    return data;
  }

  async statistics(): Promise<AdminUserStats> {
    this.requireAdmin();
    const { data, error } = await this.supabase.client.functions.invoke<AdminUserStats>('admin-users', { body: { operation: 'statistics' } });
    if (error || !data) throw new Error('Unable to load user statistics.');
    return data;
  }

  async detail(id: string): Promise<{ user: AdminUser; activity: { marketplace_listings: Array<Record<string, unknown>> } }> {
    this.requireAdmin();
    const { data, error } = await this.supabase.client.functions.invoke<{ user: AdminUser; activity: { marketplace_listings: Array<Record<string, unknown>> } }>('admin-users', { body: { operation: 'detail', id } });
    if (error || !data) throw new Error('Unable to load user details.');
    return data;
  }

  private requireAdmin(): void { if (!this.auth.isAdmin()) throw new Error('Administrator access is required.'); }
}
