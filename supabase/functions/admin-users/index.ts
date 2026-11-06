import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.118.0';
import { getCorsHeaders, handlePreflight, isAllowedOrigin } from '../_shared/cors.ts';

const ADMIN_ROLES = ['super_admin', 'district_admin', 'moderator'] as const;
const headersFor = (request: Request): Headers => {
  const headers = getCorsHeaders(request, { methods: 'POST, OPTIONS' });
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'no-store');
  return headers;
};
const reply = (request: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: headersFor(request) });
const value = (input: unknown): string => typeof input === 'string' ? input.trim() : '';

async function authorize(request: Request): Promise<{ adminId: string; client: SupabaseClient }> {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const token = /^Bearer\s+([^\s]+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
  if (!url || !anonKey || !serviceKey || !token) throw new Error('unauthorized');
  const caller = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await caller.auth.getUser(token);
  if (error || !data.user) throw new Error('unauthorized');
  const roles = await caller.from('user_roles').select('role_code').eq('user_id', data.user.id).in('role_code', [...ADMIN_ROLES]);
  if (roles.error || !roles.data?.length) throw new Error('forbidden');
  return { adminId: data.user.id, client: createClient(url, serviceKey, { auth: { persistSession: false } }) };
}

async function getAllUsers(client: SupabaseClient): Promise<User[]> {
  const users: User[] = [];
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error('users_unavailable');
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return users;
}

async function getProfiles(client: SupabaseClient, ids: string[]) {
  if (!ids.length) return new Map<string, Record<string, unknown>>();
  const { data, error } = await client.from('profiles').select('id,full_name,avatar_path,preferred_language,preferred_locality_id,phone,phone_verified_at').in('id', ids);
  if (error) throw new Error('profiles_unavailable');
  return new Map((data ?? []).map(row => [String(row.id), row as Record<string, unknown>]));
}

function present(user: User, profile: Record<string, unknown> | null) {
  const providers = [...new Set((user.identities ?? []).map(identity => identity.provider).filter(Boolean))];
  return {
    id: user.id,
    full_name: typeof user.user_metadata?.['full_name'] === 'string' ? user.user_metadata['full_name'] : profile?.['full_name'] ?? null,
    email: user.email ?? null, phone: user.phone ?? null,
    phone_confirmed_at: user.phone_confirmed_at ?? null, email_confirmed_at: user.email_confirmed_at ?? null,
    providers, avatar_path: profile?.['avatar_path'] ?? null,
    preferred_language: profile?.['preferred_language'] ?? null,
    preferred_locality_id: profile?.['preferred_locality_id'] ?? null,
    created_at: user.created_at, last_sign_in_at: user.last_sign_in_at ?? null,
    banned_until: user.banned_until ?? null,
  };
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return handlePreflight(request, { methods: 'POST, OPTIONS' });
  const origin = request.headers.get('origin');
  if (!isAllowedOrigin(origin)) return new Response(null, { status: 403, headers: new Headers({ Vary: 'Origin' }) });
  if (request.method !== 'POST') return reply(request, { error: 'method_not_allowed' }, 405);
  try {
    const { adminId, client } = await authorize(request);
    const body = await request.json() as Record<string, unknown>;
    const operation = value(body.operation) || 'list';
    const users = await getAllUsers(client);
    const profiles = await getProfiles(client, users.map(user => user.id));
    if (operation === 'statistics') {
      const month = new Date(); month.setUTCDate(1); month.setUTCHours(0, 0, 0, 0);
      const verified = users.filter(user => Boolean(user.phone && user.phone_confirmed_at)).length;
      return reply(request, { total: users.length, new_this_month: users.filter(user => Date.parse(user.created_at) >= month.getTime()).length, mobile_verified: verified, mobile_missing: users.filter(user => !user.phone).length, mobile_unverified: users.filter(user => Boolean(user.phone) && !user.phone_confirmed_at).length });
    }
    if (operation === 'detail') {
      const user = users.find(item => item.id === value(body.id));
      if (!user) return reply(request, { error: 'not_found' }, 404);
      const profile = profiles.get(user.id) ?? null;
      const marketplace = await client.from('marketplace_listings').select('id,title,status,created_at').eq('seller_id', user.id).order('created_at', { ascending: false }).limit(20);
      return reply(request, { user: present(user, profile), activity: { marketplace_listings: marketplace.error ? [] : marketplace.data ?? [] } });
    }
    const search = value(body.search).toLocaleLowerCase();
    const provider = value(body.provider);
    const mobile = value(body.mobile);
    const from = Date.parse(value(body.created_from)); const to = Date.parse(value(body.created_to));
    const filtered = users.filter(user => {
      const item = present(user, profiles.get(user.id) ?? null);
      const haystack = [item.id, item.full_name, item.email, item.phone].filter(Boolean).join(' ').toLocaleLowerCase();
      const state = user.phone ? (user.phone_confirmed_at ? 'verified' : 'unverified') : 'missing';
      return (!search || haystack.includes(search)) && (!provider || item.providers.includes(provider)) && (!mobile || state === mobile)
        && (!Number.isFinite(from) || Date.parse(user.created_at) >= from) && (!Number.isFinite(to) || Date.parse(user.created_at) <= to);
    });
    const sort = value(body.sort) || 'created_at';
    filtered.sort((a, b) => sort === 'name' ? String(a.user_metadata?.['full_name'] ?? '').localeCompare(String(b.user_metadata?.['full_name'] ?? '')) : sort === 'last_sign_in_at' ? Date.parse(b.last_sign_in_at ?? '') - Date.parse(a.last_sign_in_at ?? '') : Date.parse(b.created_at) - Date.parse(a.created_at));
    const page = Math.max(1, Number(body.page) || 1); const perPage = [20, 50, 100].includes(Number(body.per_page)) ? Number(body.per_page) : 20;
    const rows = filtered.slice((page - 1) * perPage, page * perPage).map(user => present(user, profiles.get(user.id) ?? null));
    await client.from('audit_logs').insert({ actor_user_id: adminId, action: 'admin_users.list', entity_type: 'auth_user', entity_id: null, metadata: { count: rows.length } });
    return reply(request, { users: rows, page, per_page: perPage, total: filtered.length });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'server_error';
    return reply(request, { error: code === 'forbidden' ? 'forbidden' : code === 'unauthorized' ? 'unauthorized' : 'users_unavailable' }, code === 'forbidden' ? 403 : code === 'unauthorized' ? 401 : 503);
  }
});
