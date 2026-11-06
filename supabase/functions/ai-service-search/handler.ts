import { Catalog, CategoryIntent, Intent, ResolvedSearch, SearchError, SearchSession, directIntent, parseCategoryIntent, parseIntent, publicListings, record, resolveLocation } from './contracts.ts';
import { getCorsHeaders, handlePreflight, isAllowedOrigin } from '../_shared/cors.ts';

interface Dependencies {
  allowedOrigins?: string[];
  authorize(request: Request): Promise<SearchSession>;
  classify(query: string, catalog: Catalog): Promise<Intent>;
  classifyCategory?(query: string, catalog: Catalog): Promise<CategoryIntent>;
  monitor(event: Record<string, string | number | boolean>): void;
  cacheVersion?: string;
  now?: () => number;
}

export function createSearchHandler(deps: Dependencies) {
  // Cache only validated intent, never listings, contacts, JWTs or authorizations.
  const cache = new Map<string, { intent: Intent; expires: number }>();
  const inFlight = new Map<string, Promise<Intent>>();
  const now = deps.now ?? Date.now;
  return async (request: Request): Promise<Response> => {
    const start = now();
    const origin = request.headers.get('origin');
    const corsOptions = { methods: 'POST, OPTIONS', additionalOrigins: deps.allowedOrigins ?? [] };
    const corsHeaders = getCorsHeaders(request, corsOptions);
    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', 'application/json');
    headers.set('Cache-Control', 'no-store');
    const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (request.method === 'OPTIONS') return handlePreflight(request, corsOptions);
    if (!isAllowedOrigin(origin, deps.allowedOrigins ?? [])) return new Response(null, { status: 403, headers: corsHeaders });
    if (request.method !== 'POST') return respond({ error: 'method_not_allowed' }, 405);
    try {
      if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new SearchError(415, 'json_required');
      // Read a bounded stream, not request.text() on an attacker-controlled body.
      const reader = request.body?.getReader();
      if (!reader) throw new SearchError(400, 'invalid_request');
      let bytes = new Uint8Array();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (bytes.length + value.length > 2048) { await reader.cancel(); throw new SearchError(413, 'query_too_large'); }
        const next = new Uint8Array(bytes.length + value.length);
        next.set(bytes); next.set(value, bytes.length); bytes = next;
      }
      let body: unknown;
      try { body = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new SearchError(400, 'invalid_json'); }
      const operation = record(body) && body.operation === 'suggest_category' ? 'suggest_category' : 'search';
      if (!record(body) || Object.keys(body).some(key => !['query', 'location', 'operation'].includes(key))
        || (body.operation !== undefined && body.operation !== 'suggest_category')
        || typeof body.query !== 'string' || body.query.trim().length < 2 || body.query.length > 200
        || /[\u0000-\u001f\u007f]/u.test(body.query)
        || !(body.location === undefined || body.location === null || typeof body.location === 'string' && /^[\p{L}\p{N}-]{1,100}$/u.test(body.location))) {
        throw new SearchError(400, 'invalid_request');
      }
      const query = body.query.trim().normalize('NFC').replace(/\s+/gu, ' ');
      // Invalid/expired supplied JWTs are rejected, never silently downgraded to anon.
      const session = await deps.authorize(request);
      const catalog = await session.catalog();
      if (operation === 'suggest_category') {
        let intent: CategoryIntent | null = null;
        const direct = directCategoryIntent(query, catalog);
        if (direct) intent = direct;
        else if (deps.classifyCategory) {
          if (!await session.reserve()) throw new SearchError(429, 'rate_limited');
          intent = parseCategoryIntent(await deps.classifyCategory(query, catalog));
        }
        const parent = intent?.parent_category_slug ? catalog.categories.find(row => row.parent_id === null && row.slug === intent?.parent_category_slug) : null;
        const subcategory = parent && intent?.subcategory_slug ? catalog.categories.find(row => row.parent_id === parent.id && row.slug === intent?.subcategory_slug) : null;
        if (!parent || !subcategory) return respond({ success: false, suggestion: null, reason: 'no_match' });
        return respond({ success: true, suggestion: { parent, subcategory }, reason: direct ? 'direct_match' : 'ai_match' });
      }
      const explicitLocation = body.location ? resolveLocation(catalog.locations, String(body.location)) : null;
      if (body.location && !explicitLocation) throw new SearchError(400, 'unknown_location');
      const language = /[\u0b80-\u0bff]/u.test(query) ? 'ta' : 'en';
      let resolved: ResolvedSearch = { category: null, location: explicitLocation, keywords: query, language };
      let mode = 'keyword';
      let reason: string | null = null;
      let cached = false;
      const direct = directIntent(query, catalog, explicitLocation);
      if (direct) {
        const category = catalog.categories.find(row => row.slug === direct.category_slug) ?? null;
        const location = explicitLocation ?? (direct.location_slug ? resolveLocation(catalog.locations, direct.location_slug) : null);
        if (category) {
          resolved = { category, location, keywords: direct.keywords, language: direct.language };
          reason = 'direct_match';
        }
      }
      if (!direct || !resolved.category) try {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([deps.cacheVersion ?? 'v1', query, language, explicitLocation?.id ?? null])));
        const key = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
        let intent: Intent;
        const entry = cache.get(key);
        if (entry && entry.expires > now()) { intent = entry.intent; cached = true; }
        else {
          let pending = inFlight.get(key);
          if (!pending) {
            pending = (async () => {
              // Fail closed on a quota database outage: no unmetered AI calls.
              if (!await session.reserve()) throw new Error('rate_limited');
              return parseIntent(await deps.classify(query, catalog));
            })();
            inFlight.set(key, pending);
          }
          try { intent = await pending; } finally { if (inFlight.get(key) === pending) inFlight.delete(key); }
        }
        const category = catalog.categories.find(row => row.slug === intent.category_slug);
        const location = explicitLocation ?? (intent.location_slug ? resolveLocation(catalog.locations, intent.location_slug) : null);
        if (!category || (!explicitLocation && intent.location_slug && !location)) throw new Error('invalid_intent');
        resolved = { category, location, keywords: intent.keywords.trim(), language: intent.language };
        if (!cached) {
          if (cache.size >= 128) cache.delete(cache.keys().next().value!);
           cache.set(key, { intent, expires: now() + 86_400_000 });
        }
       mode = 'ai';
      } catch (error) {
        reason = error instanceof Error && ['rate_limited', 'invalid_intent'].includes(error.message) ? error.message : 'ai_unavailable';
      }
      const rows = publicListings(await session.search(resolved));
       deps.monitor({ event: 'service_search', mode, reason: reason ?? 'none', cached, results: Math.min(rows.length, 12), elapsed_ms: now() - start });
      return respond({ mode, reason, language: resolved.language, intent: resolved, listings: rows.slice(0, 12), hasMore: rows.length > 12 });
    } catch (error) {
      const status = error instanceof SearchError ? error.status : 503;
      const code = error instanceof SearchError ? error.code : 'search_unavailable';
      deps.monitor({ event: 'service_search_error', status, code, elapsed_ms: now() - start });
      return respond({ error: code }, status);
    }
  };
}

function directCategoryIntent(query: string, catalog: Catalog): CategoryIntent | null {
  const text = query.normalize('NFC').toLocaleLowerCase();
  const aliases: Readonly<Record<string, readonly string[]>> = {
    restaurants: ['batter', 'idly', 'idli', 'dosa', 'dosai', 'food shop', 'சமையல்', 'இட்லி', 'தோசை', 'மாவு'],
    plumber: ['plumber', 'plumbing', 'pipe repair', 'பிளம்பர்', 'குழாய்'],
    electrician: ['electrician', 'electrical', 'எலக்ட்ரீஷியன்', 'மின்சார'],
    'ac-service': ['ac service', 'air conditioner', 'ஏசி சர்வீஸ்'],
  };
  const matches = catalog.categories.filter(row => row.parent_id !== null).flatMap(row => {
    const namedTerms = [row.slug, row.name_en ?? '', row.name_ta, ...(aliases[row.slug] ?? [])];
    // Match meaningful words in bilingual category names as well as exact
    // phrases; never use one-character tokens or parent-only names.
    const terms = namedTerms.flatMap(term => [term, ...term.split(/[\s-]+/u)])
      .filter(term => term.length >= 2 && !['service', 'services', 'shop', 'work'].includes(term.toLocaleLowerCase()));
    const scores = terms.filter(term => text.includes(term.toLocaleLowerCase())).map(term => term.length);
    return scores.length ? [{ row, score: Math.max(...scores) }] : [];
  }).sort((a, b) => b.score - a.score);
  if (!matches.length || (matches[1] && matches[0].score === matches[1].score && matches[0].row.id !== matches[1].row.id)) return null;
  const child = matches[0].row;
  const parent = catalog.categories.find(row => row.id === child.parent_id);
  return parent ? { parent_category_slug: parent.slug, subcategory_slug: child.slug, language: /[\u0b80-\u0bff]/u.test(query) ? 'ta' : 'en' } : null;
}
