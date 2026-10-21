# AI service search — MVP

## Behaviour and inspected schema

Home/header submits to `/service-search?q=...`. The page uses the existing
Supabase client, signals, reactive forms, language service, responsive directory
styles and `ListingSummaryComponent`. Categories at `/services` and the existing
category/detail routes keep their current behaviour. No AI calls occur while typing.

The Edge Function performs this sequence:

1. Enforce exact-origin CORS, JSON/body/query limits and public API key validation.
   If a user JWT is supplied, verify it with Supabase Auth; do not downgrade a bad
   session to anonymous access.
2. Read active, reachable categories and locations with the caller's RLS context.
3. Use a two-minute validated-intent cache or atomically reserve an AI quota slot.
4. Ask OpenAI for category/location slugs, extra literal keywords and `ta` / `en`.
5. Validate the entire output and resolve slugs to real database records.
6. Call the existing `directory_listings` RPC with resolved UUIDs and return up to
   12 real listings. No generated business descriptions or chatbot responses.

The confirmed query uses `service_listings.category_id`, `provider_id`, `title`,
`description`, `status`, `published_at` and `id`; `status` must equal `published`.
Provider joins require `verification_status = 'verified'`. Location coverage uses
`listing_locations.listing_id / location_id`; categories and locations use
`parent_id`. Contacts require `listing_contacts.is_public = true`. Images follow
`listing_media.media_asset_id -> media_assets.id`, with public image visibility.
Only selected public fields are returned; owner IDs, private contacts and private
media are stripped even when the caller is an owner/admin.

No production taxonomy is hardcoded. `service_categories.slug` is unique; location
slugs are unique only within their parent. A supplied location UUID wins over AI
interpretation. A supplied slug must resolve uniquely; unknown/ambiguous explicit
locations return HTTP 400, never an unfiltered search. Model-invented values trigger
literal fallback. Inactive/orphaned hierarchy branches are excluded.

The original supplied 001/002 Downloads files are no longer present locally.
This implementation uses the previously inspected schema plus current migrations,
typed directory queries and SQL regression fixtures. It does not claim a fresh
production schema/introspection check or hardcode illustrative category slugs.

## Deployment

### 1. Database

In a development Supabase project with original migrations 001/002 and fixes
003/004 already applied, apply:

`supabase/migrations/nam_chidambaram_migration_005_ai_search.sql`

Use the SQL editor / your existing migration process. Existing migration filenames
are not the Supabase CLI's timestamp convention; do not blindly run `db push`.

Migration 005:

- Extends `directory_listings` to allow `category = null` for literal keyword
  search across the active hierarchy. It remains **SECURITY INVOKER**, preserving
  publication, verification, hierarchy checks and caller RLS.
- Adds the purpose-specific `ai_search_usage` counter table, with RLS enabled and
  all direct public/anonymous/authenticated privileges revoked. It stores no
  query text, IPs, AI output or JWTs. Caller buckets use verified Auth UUIDs.
- Adds `reserve_ai_search()`, a parameterless **SECURITY DEFINER** function limited
  to quota bookkeeping. It uses a transaction advisory lock for atomic cross-isolate
  reservations. It never reads directory/private user data. No privileged database
  client or service-role key is used anywhere in the Edge Function.
- Does not alter any existing table columns or disable/change existing RLS policies.

Run `supabase/tests/public_directory.sql` and `supabase/tests/ai_service_search.sql`
as postgres in **development**. Both use transactions and roll back their changes.

### 2. Edge Function secrets

Copy `supabase/functions/.env.example` to `supabase/functions/.env.local` and fill
in your values locally. `.env.local` is ignored by Git.

| Secret | Value |
| --- | --- |
| `OPENAI_API_KEY` | A restricted, project-scoped OpenAI key |
| `AI_SEARCH_MODEL` | Default `gpt-4.1-nano-2025-04-14` |
| `AI_SEARCH_ALLOWED_ORIGINS` | Comma-separated exact origins, e.g. localhost, your Cloudflare Pages/custom domain; no trailing slash/wildcards |
| `AI_SEARCH_PUBLIC_KEY` | The publishable key used by Angular |

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided by the Supabase Edge runtime.
For local execution use the corresponding local project public values, never a
service-role key. No OpenAI key belongs in Angular environments, Cloudflare client
variables, source control, screenshots or browser requests.

With the Supabase CLI installed/authenticated:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set --env-file supabase/functions/.env.local
supabase functions deploy ai-service-search
```

The checked-in function configuration sets `verify_jwt = false` because public
publishable-key discovery must work signed out. This is **not** an authorization
bypass: the handler validates `apikey`, explicitly verifies supplied user tokens
using `auth.getUser`, and constructs only an anon-key client with that caller's
Authorization header. Never replace it with a service-role client. Requests with
invalid user credentials return 401 rather than falling back anonymously.

For a configured local Supabase stack (Docker required):

```bash
supabase start
supabase functions serve ai-service-search --env-file supabase/functions/.env.local
npm start
```

Use a disposable development project and ensure migrations 001–005 are applied.
For Angular to target that stack, update only its existing **public** URL/key;
also set the matching `AI_SEARCH_PUBLIC_KEY`. Restore the deployment's public
configuration before building for production.

### 3. Cloudflare

Build with `npm run build` and deploy `dist/community-app/browser`. Ensure the
existing SPA fallback also serves `/service-search` deep links. Include each
approved deployed origin in `AI_SEARCH_ALLOWED_ORIGINS`; arbitrary preview origins
are deliberately not wildcard-allowed. The browser calls Supabase, not OpenAI.
There is no new Cloudflare Worker, paid service or client-side AI SDK.

## API and fallback

POST `/functions/v1/ai-service-search` with the project's public `apikey`, JSON
content type, and optionally the current user's `Authorization: Bearer <JWT>`:

```json
{ "query": "சிதம்பரத்தில் குழாய் பழுது பார்க்க ஆள் தேவை", "location": null }
```

`location` may be a real location UUID or an unambiguous database slug. Only
`query` and `location` are accepted. The query must be 2–200 characters without
control characters; the entire request is limited to 2 KiB.

The response contains `mode`, `reason`, `language`, validated `intent`, `listings`
and `hasMore`. Intent carries real category/location records, not generated IDs.

- Provider error, timeout, invalid model output or exhausted quota: return literal
  keyword results with `mode: 'keyword'`. Empty results are not broadened silently.
- Function/network failure: Angular uses the same caller-scoped directory RPC
  directly, with the original query and selected location UUID. A non-UUID location
  is not silently discarded in direct fallback.
- Validation/auth failures (400/401/403): show an error, not an automatic weaker
  request. Both AI retry and explicit **Keyword search** controls are available.
- Explicit Keyword search never contacts the AI provider or consumes an AI slot.
- A directory failure shows a retryable error. Empty results remain empty.

## Cost controls and monitoring

OpenAI GPT-4.1 nano supports strict JSON output without reasoning/tool calls. The
model is pinned for reproducibility and configurable in one secret. The adapter
is isolated in `openai.ts`; another provider would need a compatible adapter,
not an arbitrary caller-supplied URL/model.

- One AI call per uncached submitted query; no retries or AI calls per keystroke.
- At most 180 output tokens, an eight-second provider timeout and bounded query.
- Send only category slugs and compact location labels, not listings/contacts or
  category descriptions. A 16,000-character taxonomy cap and 500-row per-table
  catalogue cap refuse excessive/truncated catalogues instead of inflating cost.
- Cache validated intents only, for a fixed two minutes, at most 128 per isolate;
  caller identity partitions entries. Concurrent identical requests are coalesced.
  Every request revalidates the catalogue and re-queries results under current RLS.
  Responses use `Cache-Control: no-store`; there is no shared listing-result cache.
- Database-backed limits: **300 reservations/day globally**, **20/minute globally**,
  **10/minute shared across anonymous users**, **6/minute per authenticated UUID**.
  Failed model calls also consume reservations. Quota database errors fail closed
  for AI and use keyword fallback. Counters older than two days are cleaned on
  successful reservation. Change reviewed SQL constants to tune the MVP budget.
- Structured Edge logs record mode, fallback reason, cache hits, result count,
  elapsed time and numeric provider token usage. They never log query text,
  Authorization headers, API keys, contacts or full model responses.

At the documented model pricing ($0.10/M input, $0.40/M output), a 3,000-input /
100-output-token call is about **$0.00034**, or approximately **$0.10 for 300 such
calls**. This is an illustration, not a measured bill or guaranteed spend ceiling;
tokenization, model/pricing changes, Supabase and hosting costs still apply. Set
provider-side project spend alerts/limits as a second control.

Trusted SQL-editor monitoring:

```sql
select bucket, window_start, requests
from public.ai_search_usage
where bucket in ('global:day', 'global:minute')
order by window_start desc;
```

Anonymous sharing deliberately favours a hard cost cap over fairness. Public
clients can call the parameterless reservation RPC to consume slots (denial of AI
availability), but cannot reset counters, choose identities or exceed AI caps.
This MVP does not implement a CAPTCHA, abuse identity, or general DDoS protection;
use platform WAF controls for broader abuse. CORS is not a substitute for auth.

## Verification

The request explicitly authorized tests/builds. Commands:

```bash
npm test -- --watch=false
npm run build
npx --yes deno check --no-lock supabase/functions/ai-service-search/index.ts
npx --yes deno test --no-lock supabase/functions/ai-service-search/handler_test.ts
```

Actual results: **46 Angular tests passed in 10 files**, **15 Deno tests passed**,
Edge entrypoint type-check passed and production build passed. Tests use mocked
model/Auth/PostgREST responses; no hosted AI call or spend occurred. Coverage
includes Tamil/English requests, malformed/invented intents, unknown locations,
empty results, private data exclusion, invalid credentials, API/quota failures,
fallback, caching, no AI on typing, retry and stale-response protection.

Both SQL regression scripts passed in temporary embedded PostgreSQL (PGlite),
using a focused fixture of the previously inspected core tables/policies and
an `auth.uid()` stub. This validates SQL/RLS/quota behaviour in that fixture, not
a complete deployed Supabase/Auth/PostgREST environment. Re-run in your actual
development project. Verification tools were used outside application dependencies.

Headless Edge checks against the production build passed **36 scenarios** across
Tamil/English and 1280/390/320-pixel widths, including populated AI search,
keyword-empty fallback, error screens and existing directory/detail pages. The
default AXE audit found zero violations; no horizontal overflow or page JavaScript
errors occurred. Supabase responses were mocked for these browser checks.

Before release, verify signed-out and signed-in searches, a Tamil query, an
English query, category/location interpretation, direct detail links, forced
OpenAI failure, quota denial, private/draft rows and browser mobile/keyboard use.
Live Supabase/model connectivity and Tamil classification quality remain unverified.

## Limitations

This is single-category intent extraction, not semantic ranking or a chatbot.
Typographical errors and mixed-language specifics may still yield no matches.
Fallback is a literal substring search over title/description/business name, so
long Tamil sentences may not match English-only listings; simplify keywords or
browse categories. Only the first 12 results are shown, with a refine-search hint.
There are no embeddings, vector database, automatic translations or extra paid
services. Provider requests set `store: false`, which does not replace reviewing
the provider's retention/privacy terms. Queries remain in browser URL/history.

## Change manifest

Modified: `.gitignore`, `README.md`, `src/app/app.routes.ts`,
`src/app/home/home.component.ts`, `src/app/home/home.component.spec.ts`,
`src/app/core/services/service-directory.service.ts` (nullable category argument).

Added:

- `docs/ai-service-search.md`
- `src/app/core/models/ai-service-search.ts`
- `src/app/core/services/ai-service-search.service.ts`
- `src/app/core/services/ai-service-search.service.spec.ts`
- `src/app/services/ai-service-search/ai-service-search.component.ts`
- `src/app/services/ai-service-search/ai-service-search.component.spec.ts`
- `supabase/config.toml`
- `supabase/functions/.env.example`
- `supabase/functions/ai-service-search/contracts.ts`
- `supabase/functions/ai-service-search/database.ts`
- `supabase/functions/ai-service-search/handler.ts`
- `supabase/functions/ai-service-search/handler_test.ts`
- `supabase/functions/ai-service-search/index.ts`
- `supabase/functions/ai-service-search/openai.ts`
- `supabase/migrations/nam_chidambaram_migration_005_ai_search.sql`
- `supabase/tests/ai_service_search.sql`

No application package/lockfile or existing environment credentials changed.
`dist/community-app` is regenerated by the production build. No migrations,
secrets or functions were applied/deployed remotely.
