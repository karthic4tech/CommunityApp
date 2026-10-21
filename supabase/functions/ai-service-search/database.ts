import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0';
import { CatalogRow, ResolvedSearch, SearchError, SearchSession, reachable } from './contracts.ts';

const COLUMNS = `id,category_id,title,description,status,
  service_providers!inner(display_name,description,verification_status,public_email,website_url),
  listing_locations(coverage_type,locations(id,parent_id,name_ta,name_en,location_type,is_active)),
  listing_contacts(contact_type,contact_value,is_public,sort_order),
  listing_media(sort_order,media_assets(storage_path,media_type,visibility))`;

export function directorySession(client: SupabaseClient, identity: string): SearchSession {
  async function catalogRows(table: 'service_categories' | 'locations'): Promise<CatalogRow[]> {
    const { data, count, error } = await client.from(table).select('id,parent_id,slug,name_ta,name_en', { count: 'exact' })
      .eq('is_active', true).order('id').limit(501).abortSignal(AbortSignal.timeout(6000)).returns<CatalogRow[]>();
    // Refuse to classify a silently truncated or excessively expensive catalogue.
    if (error || !data || count === null || count > 500 || data.length !== count) throw new Error('catalog_unavailable');
    return reachable(data);
  }
  return {
    identity,
    async catalog() {
      const [categories, locations] = await Promise.all([catalogRows('service_categories'), catalogRows('locations')]);
      return { categories, locations };
    },
    async reserve() {
      const { data, error } = await client.rpc('reserve_ai_search').abortSignal(AbortSignal.timeout(6000));
      if (error) throw new Error('quota_unavailable');
      return data === true;
    },
    async search(intent: ResolvedSearch) {
      const { data, error } = await client.rpc('directory_listings', {
        category: intent.category?.id ?? null, location: intent.location?.id ?? null, keyword: intent.keywords,
      }).select(COLUMNS)
        .eq('status', 'published').eq('service_providers.verification_status', 'verified')
        .eq('listing_contacts.is_public', true)
        .order('published_at', { ascending: false, nullsFirst: false }).order('id', { ascending: true })
        .limit(13).abortSignal(AbortSignal.timeout(6000));
      if (error || !Array.isArray(data)) throw new Error('directory_unavailable');
      return data;
    },
  };
}

export function createAuthorizer(config: { url: string; anonKey: string; publicKey: string; fetcher?: typeof fetch }) {
  return async (request: Request): Promise<SearchSession> => {
    if (!config.url || !config.anonKey) throw new SearchError(503, 'configuration_unavailable');
    const allowedKeys = [config.anonKey, config.publicKey].filter(Boolean);
    if (!allowedKeys.includes(request.headers.get('apikey') ?? '')) throw new SearchError(401, 'unauthorized');
    const authorization = request.headers.get('authorization');
    if (authorization && !/^Bearer [^\s]+$/i.test(authorization)) throw new SearchError(401, 'unauthorized');
    const token = authorization?.slice(7);
    const userToken = token && !allowedKeys.includes(token) ? token : null;
    // Only a public/anon key constructs the client; never read a service-role secret.
    const client = createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: (input, init) => (config.fetcher ?? fetch)(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(6000) }),
        ...(userToken ? { headers: { Authorization: `Bearer ${userToken}` } } : {}),
      },
    });
    let identity = 'anon';
    if (userToken) {
      const { data, error } = await client.auth.getUser(userToken);
      if (error || !data.user) throw new SearchError(401, 'unauthorized');
      identity = data.user.id;
    }
    return directorySession(client, identity);
  };
}
