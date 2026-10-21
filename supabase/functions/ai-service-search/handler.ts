import { Catalog, Intent, ResolvedSearch, SearchError, SearchSession, parseIntent, publicListings, record, resolveLocation } from './contracts.ts';

interface Dependencies {
  allowedOrigins: string[];
  authorize(request: Request): Promise<SearchSession>;
  classify(query: string, catalog: Catalog): Promise<Intent>;
  monitor(event: Record<string, string | number | boolean>): void;
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
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin' };
    if (origin && !deps.allowedOrigins.includes(origin)) return new Response(null, { status: 403, headers });
    if (origin) headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
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
      if (!record(body) || Object.keys(body).some(key => !['query', 'location'].includes(key))
        || typeof body.query !== 'string' || body.query.trim().length < 2 || body.query.length > 200
        || /[\u0000-\u001f\u007f]/u.test(body.query)
        || !(body.location === undefined || body.location === null || typeof body.location === 'string' && /^[\p{L}\p{N}-]{1,100}$/u.test(body.location))) {
        throw new SearchError(400, 'invalid_request');
      }
      const query = body.query.trim();
      // Invalid/expired supplied JWTs are rejected, never silently downgraded to anon.
      const session = await deps.authorize(request);
      const catalog = await session.catalog();
      const explicitLocation = body.location ? resolveLocation(catalog.locations, String(body.location)) : null;
      if (body.location && !explicitLocation) throw new SearchError(400, 'unknown_location');
      const language = /[\u0b80-\u0bff]/u.test(query) ? 'ta' : 'en';
      let resolved: ResolvedSearch = { category: null, location: explicitLocation, keywords: query, language };
      let mode = 'keyword';
      let reason: string | null = null;
      let cached = false;
      try {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([session.identity, query, explicitLocation?.id ?? null])));
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
          cache.set(key, { intent, expires: now() + 120_000 });
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
