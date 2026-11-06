# CDM 360 CORS audit

## Inventory

The repository contains one browser-facing Supabase Edge Function:

- `ai-service-search`: service search and `suggest_category`, implemented with
  `Deno.serve` and a caller-scoped Supabase client.

The Angular application has no `HttpClient` or hand-written `/functions/v1/`
requests. It uses the existing Supabase JS client for Functions, PostgREST,
Auth, Storage and database RPC calls. Supabase-managed Auth, Storage and
PostgREST CORS configuration was not changed.

## Resolution

`supabase/functions/_shared/cors.ts` is the shared exact-origin utility. It:

- allows only localhost:4200, 127.0.0.1:4200, cdm360.in and www.cdm360.in by default;
- supports additional exact origins through `CORS_ALLOWED_ORIGINS`;
- handles OPTIONS before request parsing or authentication;
- returns `Vary: Origin` and approved request headers;
- never returns `Access-Control-Allow-Origin: *`;
- returns 403 for disallowed preflight and actual browser origins;
- leaves requests without an Origin header available for server-to-server callers.

The AI search handler still enforces its existing API-key, JWT, RLS, quota,
category validation and OpenAI controls. CORS does not grant authorization.

## Verification

```text
27 Deno tests passed
Angular production build passed
OPTIONS localhost:4200 -> 204 with matching ACAO
OPTIONS https://cdm360.in -> 204 with matching ACAO
OPTIONS https://evil.example -> 403 without ACAO
```

Deploy only the changed function with:

```bash
npx supabase@latest functions deploy ai-service-search \
  --project-ref avgvkymmzclckazxglli --yes
```
