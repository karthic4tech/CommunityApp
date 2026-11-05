# Essential Services and All Services

## Routes

- `/essential-services` — priority categories and shortcuts only (`is_essential = true`), with listings returned by the curated `essential_directory_listings` RPC.
- `/services` — every active category from `service_categories` and the existing all-services search RPC.
- `/services/category/:slug` — explicit category detail URL.
- `/services/:slug` — published listing detail URL. Existing `/services/:categorySlug` category URLs continue to resolve through a category lookup; `/providers/:id` remains supported.
- `/admin/essential-services` — admin-only curation and shortcut management.

## Supabase migration

Review and apply `supabase/migrations/20261105100000_essential_service_curations.sql` to the intended Supabase project. It is additive: it adds curation columns, the shortcut table and RLS, a public listing-slug column, and the essential-only listing RPC. The migration seeds the initial curated Chidambaram services by existing stable category slugs; administrators can revise that selection afterward.

For a linked project, inspect pending migrations before applying:

```sh
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

Do not run the push against production until the SQL and target project have been reviewed. The Angular app must use the existing Supabase publishable key; no service-role key is required or permitted in the browser.

## Admin workflow

1. Sign in with an existing authorized admin role.
2. Open **Essential Services Management** from `/admin` or directly at `/admin/essential-services`.
3. Mark active categories as Essential and assign priority order. Mark a parent category Essential before curating one of its subcategories.
4. Configure homepage visibility and shortcuts. Shortcuts can target a category or an Essential subcategory and have English/Tamil labels, icon class, emergency flag, visibility and order.
5. Public Essential Services pages query only active Essential categories and shortcuts. All Services continues to query all active categories.

The emergency shortcut navigates to public provider listings. It does not invent or promise an emergency phone number; contact actions come from the published listing's public contact data. CDM 360 is a directory and not an emergency-response service.

## Verification

Local checks cover Angular route navigation, category/detail compatibility, the Essential search call path and production compilation. Database migrations and RLS role behavior must still be verified against a Supabase development project after applying the migration; no live database policy test was run as part of this change.
