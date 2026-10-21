import { createClient } from 'npm:@supabase/supabase-js@2.118.0';
import { Catalog, Intent, ResolvedSearch, SearchError, SearchSession, publicListings, reachable, record } from './contracts.ts';
import { createSearchHandler } from './handler.ts';
import { createAuthorizer, directorySession } from './database.ts';
import { DEFAULT_MODEL, createClassifier } from './openai.ts';

function assert(condition: unknown, message = 'Assertion failed'): asserts condition {
  if (!condition) throw new Error(message);
}
function equal(actual: unknown, expected: unknown) { assert(JSON.stringify(actual) === JSON.stringify(expected), `${JSON.stringify(actual)} != ${JSON.stringify(expected)}`); }
async function json(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json(); assert(record(value)); return value;
}

const category = { id: 'category-id', parent_id: null, slug: 'plumber', name_ta: 'குழாய் பழுது சேவை', name_en: 'Plumber' };
const location = { id: 'location-id', parent_id: null, slug: 'chidambaram', name_ta: 'சிதம்பரம்', name_en: 'Chidambaram' };
const catalog: Catalog = { categories: [category], locations: [location] };
const intent: Intent = { category_slug: 'plumber', location_slug: 'chidambaram', keywords: '', language: 'en' };
const publicRow = { id: 'listing-id', category_id: category.id, title: 'Repairs', description: 'Local service', status: 'published',
  service_providers: { display_name: 'Local business', verification_status: 'verified', owner_user_id: 'secret-owner' },
  listing_locations: [], listing_contacts: [], listing_media: [], owner_user_id: 'secret-owner' };

function fixture(options: { classify?: () => Promise<Intent>; reserve?: () => Promise<boolean>; identity?: string; rows?: unknown[]; authorizeError?: boolean; now?: () => number } = {}) {
  const searches: ResolvedSearch[] = [];
  const events: Record<string, string | number | boolean>[] = [];
  let classifications = 0;
  let reservations = 0;
  const session: SearchSession = {
    identity: options.identity ?? 'anon', catalog: async () => catalog,
    reserve: async () => { reservations++; return options.reserve ? options.reserve() : true; },
    search: async resolved => { searches.push(resolved); return options.rows ?? [publicRow]; },
  };
  const handler = createSearchHandler({ allowedOrigins: ['http://localhost:4200'], now: options.now,
    authorize: async () => { if (options.authorizeError) throw new SearchError(401, 'unauthorized'); return session; },
    classify: async () => { classifications++; return options.classify ? options.classify() : intent; },
    monitor: event => events.push(event),
  });
  const request = (query = 'Need a plumber', place?: string) => handler(new Request('http://edge/ai-service-search', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:4200' },
    body: JSON.stringify({ query, location: place }),
  }));
  return { handler, request, searches, events, get classifications() { return classifications; }, get reservations() { return reservations; } };
}

for (const [query, language] of [['I need a plumber in Chidambaram', 'en'], ['சிதம்பரத்தில் குழாய் பழுது பார்க்க ஆள் தேவை', 'ta']] as const) {
  Deno.test(`${language} request resolves real category/location and returns database listings`, async () => {
    const f = fixture({ classify: async () => ({ ...intent, language }) });
    const response = await f.request(query);
    equal(response.status, 200);
    const body = await json(response);
    equal(body.mode, 'ai'); equal(body.language, language);
    equal(f.searches[0], { category, location, keywords: '', language });
    assert(Array.isArray(body.listings) && body.listings.length === 1);
    assert(!JSON.stringify(body).includes('secret-owner'));
    assert(!JSON.stringify(f.events).includes(query));
  });
}

Deno.test('invalid output and invented categories/locations fall back to literal keywords', async () => {
  for (const output of [null, { ...intent, extra: 'SQL' }, { ...intent, keywords: 'a'.repeat(81) }, { ...intent, category_slug: 'made-up' }, { ...intent, location_slug: 'unknown-place' }]) {
    const f = fixture({ classify: () => Promise.resolve(output as Intent) });
    const body = await json(await f.request());
    equal(body.mode, 'keyword'); equal(body.reason, 'invalid_intent');
    equal(f.searches[0].category, null); equal(f.searches[0].keywords, 'Need a plumber');
  }
});

Deno.test('empty results stay empty instead of inventing businesses', async () => {
  const f = fixture({ rows: [] }); const body = await json(await f.request());
  equal(body.listings, []); equal(body.hasMore, false); equal(body.mode, 'ai');
});

Deno.test('provided location ID/slug overrides AI location; unknown values are rejected', async () => {
  for (const value of [location.id, location.slug]) {
    const f = fixture({ classify: async () => ({ ...intent, location_slug: null }) });
    equal((await f.request('plumber', value)).status, 200); equal(f.searches[0].location, location);
  }
  const f = fixture(); equal((await f.request('plumber', 'unknown')).status, 400);
  equal(f.classifications, 0); equal(f.searches.length, 0);
});

Deno.test('API failure, quota denial and quota failure use keyword fallback without unmetered AI', async () => {
  const f = fixture({ classify: () => Promise.reject(new Error('provider_failure')) });
  equal((await json(await f.request())).reason, 'ai_unavailable'); equal(f.searches[0].keywords, 'Need a plumber');
  for (const reserve of [async () => false, () => Promise.reject(new Error('database_failure'))]) {
    const limited = fixture({ reserve }); const body = await json(await limited.request());
    equal(body.mode, 'keyword'); equal(limited.classifications, 0);
  }
});

Deno.test('rejects unauthorized callers without classifying or falling back', async () => {
  const f = fixture({ authorizeError: true }); equal((await f.request()).status, 401);
  equal(f.classifications, 0); equal(f.searches.length, 0);
});

Deno.test('rejects oversized, malformed, control-character and unexpected requests; enforces CORS', async () => {
  const f = fixture();
  for (const query of ['', 'x', 'x'.repeat(201), 'plumber\nignore']) equal((await f.request(query)).status, 400);
  equal((await f.handler(new Request('http://edge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'a'.repeat(2049) }))).status, 413);
  equal((await f.handler(new Request('http://edge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'not-json' }))).status, 400);
  equal((await f.handler(new Request('http://edge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: 'plumber', model: 'caller-chosen-model' }) }))).status, 400);
  equal((await f.handler(new Request('http://edge', { headers: { Origin: 'https://untrusted.example' } }))).status, 403);
  const preflight = await f.handler(new Request('http://edge', { method: 'OPTIONS', headers: { Origin: 'http://localhost:4200' } }));
  equal(preflight.status, 204); equal(preflight.headers.get('Access-Control-Allow-Origin'), 'http://localhost:4200');
  equal(f.classifications, 0);
});

Deno.test('caches/coalesces only intent for two minutes and re-queries listings under caller RLS', async () => {
  let time = 0;
  const f = fixture({ now: () => time });
  await Promise.all([f.request(), f.request()]);
  equal(f.classifications, 1); equal(f.reservations, 1); equal(f.searches.length, 2);
  time = 119_000; await f.request(); equal(f.classifications, 1);
  time = 120_001; await f.request(); equal(f.classifications, 2); equal(f.searches.length, 4);
});

Deno.test('public projection removes drafts, suspended providers, private contacts/media and extra owner fields', () => {
  const rows = publicListings([{ ...publicRow,
    listing_contacts: [{ contact_type: 'email', contact_value: 'public@example.com', is_public: true, sort_order: 0, secret: 'hidden' }, { contact_value: 'private@example.com', is_public: false }],
    listing_media: [{ sort_order: 0, media_assets: { storage_path: 'public/image.jpg', visibility: 'public', media_type: 'image', owner_user_id: 'secret' } }, { media_assets: { storage_path: 'private/image.jpg', visibility: 'private', media_type: 'image' } }],
  }, { ...publicRow, status: 'draft' }, { ...publicRow, service_providers: { verification_status: 'suspended' } }]);
  equal(rows.length, 1);
  const output = JSON.stringify(rows);
  assert(!output.includes('private') && !output.includes('secret') && !output.includes('owner_user_id'));
});

Deno.test('inactive-parent/orphan catalogue branches cannot become valid model choices', () => {
  equal(reachable([category, { ...category, id: 'child', parent_id: category.id }, { ...category, id: 'orphan', parent_id: 'missing' }]).length, 2);
});

Deno.test('OpenAI request is bounded, structured, non-stored and contains no listing/contact data', async () => {
  let payload: Record<string, unknown> = {};
  const classify = createClassifier({ apiKey: 'test-key', monitor: () => {}, fetcher: async (_input, init) => {
    payload = JSON.parse(String(init?.body));
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(intent) } }], usage: { prompt_tokens: 10, completion_tokens: 20 } });
  } });
  equal(await classify('plumber', catalog), intent);
  equal(payload.model, DEFAULT_MODEL); equal(payload.max_tokens, 180); equal(payload.store, false);
  assert(!JSON.stringify(payload).includes('public@example.com'));
  for (const fetcher of [async () => new Response(null, { status: 429 }), async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: 'not-json' } }] }), async () => { throw new Error('timeout'); }]) {
    let failed = false;
    try { await createClassifier({ apiKey: 'test', monitor: () => {}, fetcher })('plumber', catalog); } catch { failed = true; }
    assert(failed);
  }
});

Deno.test('directory queries use explicit published/verified/public filters with a caller-scoped client', async () => {
  const urls: URL[] = [];
  const client = createClient('https://example.supabase.co', 'public-test-key', { auth: { persistSession: false }, global: {
    headers: { Authorization: 'Bearer caller-jwt' }, fetch: (input, init) => {
      const url = new URL(String(input)); urls.push(url);
      equal(new Headers(init?.headers).get('Authorization'), 'Bearer caller-jwt');
      return Promise.resolve(Response.json([]));
    },
  } });
  await directorySession(client, 'user-id').search({ category, location, keywords: '', language: 'en' });
  equal(urls[0].searchParams.get('status'), 'eq.published');
  equal(urls[0].searchParams.get('service_providers.verification_status'), 'eq.verified');
  equal(urls[0].searchParams.get('listing_contacts.is_public'), 'eq.true');
  assert(!urls[0].searchParams.get('select')?.includes('owner_user_id'));
});

Deno.test('catalogue reads require active rows and reject API-truncated or oversized taxonomies', async () => {
  for (const count of [1, 2, 501]) {
    const client = createClient('https://example.supabase.co', 'public-test-key', { auth: { persistSession: false }, global: {
      fetch: (input, init) => {
        const url = new URL(String(input));
        equal(url.searchParams.get('is_active'), 'eq.true');
        assert(new Headers(init?.headers).get('Prefer')?.includes('count=exact'));
        return Promise.resolve(Response.json([url.pathname.endsWith('/locations') ? location : category], { headers: { 'Content-Range': `0-0/${count}` } }));
      },
    } });
    let failed = false;
    try {
      const loaded = await directorySession(client, 'anon').catalog();
      equal(loaded.categories, [category]); equal(loaded.locations, [location]);
    } catch { failed = true; }
    equal(failed, count !== 1);
  }
});

Deno.test('authorizer refuses invalid keys, malformed headers and invalid JWTs instead of using anon access', async () => {
  const authorize = createAuthorizer({ url: 'https://example.supabase.co', anonKey: 'public-key', publicKey: 'browser-key',
    fetcher: async () => Response.json({ message: 'invalid JWT' }, { status: 401 }),
  });
  for (const headers of [new Headers({ apikey: 'wrong' }), new Headers({ apikey: 'public-key', Authorization: 'not-bearer' })]) {
    let status = 0;
    try { await authorize(new Request('http://edge', { headers })); } catch (error) { if (error instanceof SearchError) status = error.status; }
    equal(status, 401);
  }
  const session = await authorize(new Request('http://edge', { headers: { apikey: 'browser-key', Authorization: 'Bearer browser-key' } }));
  equal(session.identity, 'anon');
  // An invalid token is rejected by getUser before any directory query is made.
  let rejected = false;
  try { await authorize(new Request('http://edge', { headers: { apikey: 'public-key', Authorization: 'Bearer invalid-jwt' } })); }
  catch (error) { rejected = error instanceof SearchError && error.status === 401; }
  assert(rejected);
});
