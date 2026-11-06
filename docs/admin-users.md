# CDM 360 admin users and mobile verification

## Runtime architecture

- `/admin/users` and `/admin/users/:id` are protected by the existing Angular
  `adminGuard` and the existing `user_roles` role codes.
- Angular calls the `admin-users` Edge Function; it never receives or stores a
  service-role key.
- The function validates the caller JWT, checks `user_roles` server-side, uses
  the server-only `SUPABASE_SERVICE_ROLE_KEY` for Auth Admin API reads, and
  returns a restricted user projection. Passwords, tokens, identities' raw
  metadata and OTP values are never returned.
- `profiles.phone_verified_at` is updated only by `sync_verified_phone()` after
  Supabase Auth reports both a phone and `phone_confirmed_at`.

## Supabase settings

Enable **Authentication → Sign In / Providers → Phone** and configure a
production SMS provider/template. Indian production delivery requires the
provider's DLT registration, sender ID and approved template configuration.
Test an actual SMS in the production project before enabling the workflow for
users.

## Deployment

```bash
npx supabase db push --project-ref avgvkymmzclckazxglli --yes
npx supabase functions deploy admin-users --project-ref avgvkymmzclckazxglli --yes
```

The function requires the existing server-side `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_URL` and `SUPABASE_ANON_KEY` secrets. Do not place any of these in
Angular environment files.
