# Service bulk import API

`POST /functions/v1/service-bulk-import` supports two actions. Requests must carry a valid Supabase user JWT. The handler verifies that the user is an administrator with the existing `public.is_admin()` function; the service-role key is only used inside the Edge Function.

```json
{
  "action": "validate",
  "rows": [{
    "provider_name": "Example provider",
    "service_name": "Example service",
    "category": "Home Services",
    "service_type": "Electrician",
    "location": "Chidambaram",
    "phone": "9876543210",
    "postal_code": "608001"
  }]
}
```

Validation returns one row result per input (`valid`, `warning`, or `error`) with the resolved existing category/location IDs. Import uses the same rows plus a client-generated UUID idempotency key:

```json
{ "action": "import", "idempotencyKey": "uuid", "rows": [] }
```

The server revalidates all inputs and duplicates, writes in groups of at most 100 rows using the transactional, service-role-only `admin_import_service_row` RPC, and creates listings as `pending_review`. Reusing the same key resumes failed/unprocessed rows and returns previously inserted listing IDs without duplicating them. Limits: 2,000 rows, 5 MB at the browser, 5,000 characters per cell.

## Deployment

1. Review the remote migration history, then apply `supabase/migrations/20261114120000_service_bulk_import_jobs.sql` after the project's existing service submission migrations (for example, `supabase db push` after confirming the linked project and pending migration list).
2. Deploy with `supabase functions deploy service-bulk-import --project-ref <project-ref>`. `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are supplied by the Supabase Edge runtime; never add the service-role key to Angular configuration.
3. Ensure the deployment uses the updated `supabase/config.toml` (`verify_jwt = false` because the handler performs explicit JWT verification and role checks).
4. Open `/admin/listings/review` and select **Import Services**.

The database migration and function deployment are not performed automatically by the Angular build.
