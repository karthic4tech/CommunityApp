import { Injectable, inject } from '@angular/core';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { AiServiceSearchResult } from '../models/ai-service-search';
import { publicListing } from '../models/service-listing';
import { ServiceDirectoryService } from './service-directory.service';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class AiServiceSearchService {
  private readonly supabase = inject(SupabaseService);
  private readonly directory = inject(ServiceDirectoryService);

  async search(query: string, location: string | null, keywordOnly = false): Promise<AiServiceSearchResult> {
    const term = query.trim();
    if (term.length < 2 || term.length > 200 || /[\u0000-\u001f\u007f]/u.test(term)) throw new Error('Invalid search query.');
    if (keywordOnly) return this.keywordSearch(term, location);
    try {
      const { data, error } = await this.supabase.client.functions.invoke<AiServiceSearchResult>('ai-service-search', {
        body: { query: term, location }, timeout: 20_000,
      });
      // Never turn an authorization/validation failure into a weaker anonymous request.
      if (error instanceof FunctionsHttpError && [400, 401, 403].includes(error.context.status)) {
        throw new SearchRejectedError();
      }
      if (error || !data || !Array.isArray(data.listings) || !['ai', 'keyword'].includes(data.mode)
        || !['ta', 'en'].includes(data.language) || !data.intent) throw new Error('Search unavailable.');
      return { ...data, listings: data.listings.filter(publicListing) };
    } catch (error) {
      if (error instanceof SearchRejectedError) throw new Error('Search rejected. Check your session and selected location.');
      // The direct RPC still uses the existing caller-scoped client and RLS.
      return this.keywordSearch(term, location);
    }
  }

  private async keywordSearch(query: string, location: string | null): Promise<AiServiceSearchResult> {
    // The Angular selector uses UUIDs. Slug resolution is supported server-side;
    // do not broaden a slug/invalid client fallback into an unfiltered search.
    if (location && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(location)) {
      throw new Error('Select a location from the list.');
    }
    const page = await this.directory.search(null, location, query);
    return { ...page, mode: 'keyword', reason: 'keyword_fallback', language: /[\u0b80-\u0bff]/u.test(query) ? 'ta' : 'en',
      intent: { category: null, location: null, keywords: query } };
  }
}

class SearchRejectedError extends Error {}
