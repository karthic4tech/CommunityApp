import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private clientInstance?: SupabaseClient;

  get client(): SupabaseClient {
    if (!environment.supabaseUrl || !environment.supabasePublishableKey) {
      throw new Error('Supabase public configuration is missing.');
    }
    return this.clientInstance ??= createClient(
      environment.supabaseUrl, environment.supabasePublishableKey,
    );
  }
}
