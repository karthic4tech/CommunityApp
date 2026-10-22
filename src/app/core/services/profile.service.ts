import { Injectable, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { SupabaseService } from './supabase.service';

export interface UserProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  preferred_locality_id: string | null;
  preferred_language: 'ta' | 'en';
  avatar_path: string | null;
}

export type ProfileMutation = Omit<UserProfile, 'id' | 'avatar_path'> & { avatar_path?: string | null };

const PROFILE_COLUMNS = 'id,full_name,phone,preferred_locality_id,preferred_language,avatar_path';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly auth = inject(AuthService);
  private readonly supabase = inject(SupabaseService);

  async get(): Promise<UserProfile | null> {
    const user = this.auth.user();
    if (!user) return null;
    const { data, error } = await this.supabase.client
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', user.id)
      .maybeSingle<UserProfile>();
    if (error) throw new Error('Unable to load your profile.');
    return data;
  }

  async save(input: ProfileMutation): Promise<UserProfile> {
    const user = this.auth.user();
    if (!user) throw new Error('Please sign in to update your profile.');
    const payload = { id: user.id, ...input };
    const { data, error } = await this.supabase.client
      .from('profiles')
      .upsert(payload, { onConflict: 'id' })
      .select(PROFILE_COLUMNS)
      .single<UserProfile>();
    if (error) throw new Error('Unable to save your profile.');
    return data;
  }

  async ensure(fullName: string | null): Promise<UserProfile> {
    const existing = await this.get();
    if (existing) return existing;
    return this.save({
      full_name: fullName?.trim() || null,
      phone: null,
      preferred_locality_id: null,
      preferred_language: 'ta',
      avatar_path: null,
    });
  }
}
