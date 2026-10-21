# CommunityApp

## AI-powered Tamil / English service search

Home/header search now opens `/service-search?q=...`, backed by the
`ai-service-search` Edge Function. Existing category browsing remains unchanged.
See **[AI search setup, security, cost controls and verification](docs/ai-service-search.md)**.
Deployment requires migration 005 and Edge Function secrets; no live database or
AI configuration has been changed automatically.

## Public service provider directory

### Setup and behaviour

Apply `supabase/migrations/nam_chidambaram_migration_004_public_directory.sql`
after core 001, seed 002 and category-read fix 003. **This change has not been
applied to your Supabase project automatically.** The original 001/002 files
were inspected from the supplied Downloads paths; they are not duplicated here.
Seed 002 contains locations/categories only, not provider listings: an empty
directory is expected until real providers are verified and their listings published.

- `/services/:slug` keeps the existing category page and subcategory cards and
  now displays matching listings. Leaf cards are links too. Selecting a parent
  includes listings assigned directly to it and all active descendants.
- Keyword search matches literal, case-insensitive substrings of listing title,
  description and provider display name. Location options show the existing
  parent hierarchy; a selected district/town includes its active descendants.
  Matching uses `listing_locations` for either `based_here` or `serves_here`.
  It does not infer coverage from an ancestor-only listing location.
- Filters persist in `?q=...&location=<uuid>&page=...`, support browser Back and
  direct links, and reset pagination when submitted. Results use stable ordering
  and 12-row pages with a lookahead row; locations are fetched in 500-row batches.
- `/providers/:id` is the permanent detail route. The real schema has no listing
  slug. Both reads explicitly require `published` listings and verified providers,
  even for signed-in owners/admins who have wider database access.
- Public contacts supply validated `tel:`, email enquiry, WhatsApp enquiry and
  HTTP(S) website links. Provider `public_email` / `website_url` are fallbacks.
  This does not insert anonymous enquiries: `service_enquiries` requires an
  authenticated customer, and this starter has no sign-in flow.
- Images traverse `listing_media.media_asset_id -> media_assets.id`, use only
  public image metadata and hide failed images. Core 001 does not define a Storage
  bucket. Supply an explicit HTTPS URL or a `bucket/object-path` in `storage_path`;
  bucket/object images require an already configured public Storage bucket and
  appropriate Storage policies. No bucket name is guessed or created, and no
  private asset is signed. Object-only paths without a bucket cannot be rendered.
- Signals, reactive forms, OnPush components and the existing Supabase client /
  language service are reused. Home layout/styles are unchanged; only a redundant
  brand ARIA label was removed to let its visible bilingual name be announced.
  Loading, empty,
  error, retry, invalid-location and not-found states are implemented; stale
  responses cannot overwrite a newer route/filter request.

### Confirmed relationships and security

`service_listings.provider_id -> service_providers.id` and
`service_listings.category_id -> service_categories.id` are many-to-one.
`listing_locations`, `listing_contacts` and `listing_media` each reference a
listing through `listing_id`. Location links reference `locations.id`; media
links reference `media_assets.id`. Both categories and locations use `parent_id`.

Migration 004 changes only SELECT policies/grants and adds the **security invoker**
`directory_listings(category uuid, location uuid, keyword text)` function. It
moves the original mixed public/owner/admin SELECT policies to `authenticated`
and adds anonymous policies with no `is_admin()` calls (anon lacks EXECUTE on
that function). Anonymous reads require published listings from verified providers,
public contacts and public media metadata. Original authenticated owner/admin
access and all write policies remain intact. RLS is never disabled; no table or
existing column is added or changed. The RPC also filters publication/verification
explicitly for authenticated callers. Other modules' original policies are outside
this migration's scope.

### Verification and local checks

```bash
npm test -- --watch=false
npm run build
npm start
```

The directory implementation passed **36 tests in 8 files** and the production
build. Coverage includes parent/leaf route selection, location and keyword query
parameters, publication filters, pagination, contact validation, errors/retries,
detail not-found and stale responses. Two outdated Home assertions were updated
to match the pre-existing linked-card UI and current image alt text.

`supabase/tests/public_directory.sql` is a transactional database regression test:
run it as postgres in a **development** Supabase SQL editor after applying 001–004.
It adds fixtures, checks anonymous hierarchy/search/publication/privacy reads and
authenticated owner access, and rolls everything back. It passed in a temporary
embedded PostgreSQL (PGlite) harness with a focused fixture of the inspected core
tables/SELECT policies and an `auth.uid()` stub. This is not a full Supabase or
PostgREST integration test; re-run against your actual development database.
The temporary verification packages were installed outside this application;
no application dependencies or lockfile changes were made.

Headless Edge checks against the production build, with mocked Supabase responses,
passed 18 scenarios: parent category, leaf category and detail pages in Tamil and
English at 1280, 390 and 320 pixels. The default AXE audit reported zero violations,
with no horizontal overflow or page JavaScript errors. This is automated
coverage of populated pages, not a claim of complete manual accessibility certification.

Manual release checks:

1. Configure the existing public Supabase URL/key and apply migration 004.
2. In a signed-out browser, select a parent category, then a leaf. Check business
   names/descriptions, locations, valid contacts and stable detail links.
3. Search by a business name, then select a district/town/locality. Check the URL,
   pagination and browser Back. Confirm unknown locations do not broaden results.
4. In development, compare published vs draft/archived listings, suspended providers,
   private contacts/media, and a signed-in owner's drafts. None should appear in
   the public UI. Use the SQL test to verify RLS independently of client filters.
5. Block a request and use Retry; check empty data and a nonexistent listing UUID.
6. Test keyboard navigation, Tamil/English labels, mobile widths and an AXE audit.

Live Supabase data/Storage connectivity and deployed RLS have not been verified.
The configured public REST schema request returned HTTP 401 during inspection.

### Directory change manifest

Modified existing files:

- `README.md`
- `src/app/app.routes.ts`
- `src/app/services/service-category-page.component.ts`
- `src/app/home/home.component.ts` (brand accessible name only; no design change)
- `src/app/home/home.component.spec.ts`

Added files:

- `src/app/core/models/service-listing.ts`
- `src/app/core/models/service-listing.spec.ts`
- `src/app/core/models/listing-test-fixtures.ts`
- `src/app/core/services/service-directory.service.ts`
- `src/app/core/services/service-directory.service.spec.ts`
- `src/app/services/listing-directory/listing-directory.component.ts`
- `src/app/services/listing-summary/listing-summary.component.ts`
- `src/app/services/provider-detail/provider-detail.component.ts`
- `src/app/services/directory.scss`
- `src/app/services/directory-routes.spec.ts`
- `supabase/migrations/nam_chidambaram_migration_004_public_directory.sql`
- `supabase/tests/public_directory.sql`

The production build regenerates `dist/community-app`. Temporary SQL/browser
verification scripts and their packages live outside the app at
`C:\Users\120394\AppData\Local\Temp\opencode\nam-directory-sql-check`.

The historical category-only implementation notes below predate this directory.

## Nam Chidambaram category Home page

### Supabase setup

1. In a development Supabase project, apply the original core migration 001 and
   seed migration 002 (provided separately). Do not re-run the core migration on
   an already initialized project: its policy creation is not idempotent.
2. Apply `supabase/migrations/nam_chidambaram_migration_003_category_public_read.sql`.
   Migration 001's public category policy calls `is_admin()`, whose EXECUTE
   privilege is revoked from anonymous users. Migration 003 removes that call
   from the public category policy. Authenticated administrator access remains
   supplied by the original authenticated-only admin policy. RLS stays enabled.
   No database changes have been applied automatically.
3. Set `supabaseUrl` and `supabasePublishableKey` in
   `src/environments/environment.ts`. These values are public and compiled into
   the browser bundle. Use only a publishable key or legacy anon key, NEVER a
   service-role/secret key. Configure these values before deployment as well.
4. Run `npm start` and open `http://localhost:4200/`.

### Implementation

- Selecting a service card now navigates to `/services/:slug` instead of expanding
  inline. The category page displays its active subcategories in a responsive
  three/two/one-column grid, with bilingual headings and an All services back link.
  Direct links use the same cached category service and support loading, retry,
  empty and not-found states. Subcategories with descendants can open their own
  category page; leaf subcategories are informational cards until provider listings
  are implemented. This change passed `npm run build`; tests were not added or
  run for it, as requested. Older expansion-specific tests need updating if the
  test suite is used again.

- The category grid now lives on the lazy-loaded `/services` page, not Home.
  Both pages share the header, language switch, navigation and footer. Home keeps
  the hero and community sections. Home/header searches submit to `/services?q=...`;
  Services search filters the cached hierarchy and preserves the query in the URL.
  The Services navigation item highlights the active page. Opening Home alone
  does not fetch categories; Services loads them on initialization.

- The header's தமிழ் / English switch translates Home page labels and states,
  swaps primary/secondary category names at every level, and updates the document
  language/title. Tamil is the default; the choice is saved in browser localStorage
  when available. Switching language reuses cached categories without a new query.
  Descriptions remain Tamil (marked `lang="ta"`) because the database has only
  one description field; English descriptions require translated database content.

- The root route lazy-loads Home. Native keyboard-accessible details/summary
  cards expand in place, using database slugs for stable section IDs. There is
  no provider-listing route yet, so no links point to nonexistent pages.
- A root-scoped category service makes one query selecting only public category
  fields, filtered by `is_active = true`, ordered by `sort_order`, then `slug`.
- A typed mapper creates one node per UUID, then attaches children using
  `parent_id`. Only null-parent nodes become roots. Inactive nodes, orphaned
  branches and disconnected cycles are not displayed. No category list is
  hardcoded; the icon-name lookup contains display symbols only, with a fallback.
- Signals expose categories, loading and a friendly Tamil error. Successful
  results (including empty results) are cached for the application lifetime;
  concurrent loads share a request. `ServiceCategoryService.refresh()` invalidates
  that cache. Retry and empty-state buttons call refresh.
- Missing configuration fails gracefully rather than creating a client at app
  bootstrap. Diagnostics omit credentials, query payloads and raw error messages.

### Verification

```bash
npm test -- --watch=false
npm run build
```

The latest implementation run passed 15 tests in 5 files and the production build.
Tests use mocked Supabase responses; they do not verify a deployed database.

### Applied redesign

The Home hero now uses the supplied 1774×887 PNG at
`public/assets/images/chidambaram-hero.png`, served as
`assets/images/chidambaram-hero.png` by the existing `public/` asset configuration.
It replaces the CSS temple placeholder. `NgOptimizedImage` supplies eager,
high-priority loading, and explicit dimensions reserve the 2:1 aspect ratio.
The image uses full-width, automatic-height, contain sizing without cropping;
it sits beside the content on desktop and below it at tablet/mobile widths.

Hero verification: production build and all 15 unit tests passed. A headless
Edge check at widths 1440, 768, 390 and 320 confirmed the PNG loaded successfully
(HTTP 200, image/png), retained its 2:1 proportions, and stayed within the viewport
with no horizontal page overflow, browser console errors or failed requests.
Screenshots were also inspected at desktop/mobile sizes. The supplied PNG is
approximately 2.5 MiB; smaller responsive image variants could improve slow-network
performance later without changing the artwork.

The supplied `nam-chidambaram-redesigned-src.zip` design is integrated into Home:
branded header, navigation, synchronized header/hero searches, illustrated hero,
community benefits, colored category cards, community banner and responsive layouts.
Supabase configuration and existing services were preserved. Home styles are in
`src/app/home/home.component.scss` rather than a large inline style string.

Search matches Tamil/English names, descriptions and slugs, including descendants;
matching descendants retain their parent card and its expandable hierarchy. Clearing
the search restores all categories without a network call. An empty database still
offers Refresh. Jobs/Events navigation currently scrolls to Home sections as in the
archive; dedicated feature pages have not been implemented.

The redesign loads Noto Sans Tamil and Inter from Google Fonts, with system-font
fallbacks. Production builds may need internet access for Angular font inlining.
The component-style warning/error budgets were increased from 4/8 kB to 12/16 kB
to accommodate the redesigned Home stylesheet (10.29 kB); the initial JavaScript
bundle budgets were not changed. Browser visual and AXE audits remain manual.

Manual checks after configuration:

- In a signed-out browser, confirm the Network panel shows a successful category
  read. Confirm Tamil names, English labels, descriptions, icons and expansion.
- Confirm category order matches `sort_order` and `slug`. Set a child inactive
  in a development database and reload: it should disappear. Set its parent
  inactive: the branch should disappear, not become a top-level category.
- Temporarily mark all categories inactive to check the empty state. Restore
  data afterward. Block the category request to check the error and Retry button.
- Navigate using Tab and Enter/Space, check visible focus, and test narrow mobile
  widths. Run a browser AXE audit before release; no AXE/browser audit was run
  during this implementation.
- Check RLS in Supabase: anonymous SELECT should return active rows only;
  authenticated non-admins should not see inactive rows. Keep RLS enabled.

### Current limitations

- Live connectivity and the SQL migration require verification in your project.
- This query is subject to the Supabase API row limit (normally 1,000). The
  supplied catalogue fits; add pagination before the active catalogue exceeds
  that limit to avoid truncation.
- Icons use a dependency-free symbol mapping; platform glyph appearance varies.
- PWA, provider listings, authentication screens and Cloudflare deployment were
  not present in the starter and are outside this category integration.
- Other public policies in migration 001 also call `is_admin()`; migration 003
  intentionally fixes only service categories. Review those before exposing
  other modules anonymously.

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.27.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
