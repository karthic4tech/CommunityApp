import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private readonly platformId = inject(PLATFORM_ID);
  private clientInstance?: SupabaseClient;

  get client(): SupabaseClient {
    if (!environment.supabaseUrl || !environment.supabasePublishableKey) {
      throw new Error('Supabase public configuration is missing.');
    }
    const isBrowser = isPlatformBrowser(this.platformId);
    return this.clientInstance ??= createClient(
      environment.supabaseUrl,
      environment.supabasePublishableKey,
      {
        auth: {
          persistSession: isBrowser,
          autoRefreshToken: isBrowser,
          detectSessionInUrl: isBrowser,
        },
      },
    );
  }
}
