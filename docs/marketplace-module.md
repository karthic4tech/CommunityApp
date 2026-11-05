# CDM 360 Marketplace

## Routes

- `/marketplace` — browse, featured deals, recent products, category discovery and local search.
- `/marketplace/category/:slug` — category/subcategory browsing with location, condition, price and sort filters.
- `/marketplace/item/:id/:slug` — product gallery, attributes, seller contact, enquiry and report actions.
- `/marketplace/sell` and `/marketplace/edit/:id` — authenticated multi-step listing wizard.
- `/marketplace/my-listings`, `/marketplace/favourites`, `/marketplace/my-enquiries` — seller and buyer tools.
- `/admin/marketplace` — listing moderation, reports, categories, rules and moderation logs.

## Database deployment

Review and apply `supabase/migrations/20261106100000_local_marketplace.sql` to the intended Supabase project. It is additive and creates the marketplace catalogue, listing tables, RLS policies, listing lifecycle RPCs, category-specific field validation and a private image bucket. It seeds the initial category catalogue.

```sh
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

The marketplace migration has **not** been applied to the remote project in this implementation. Review it and the target project before deploying. It creates `cdm360-marketplace-images` as a private bucket; product photos use signed URLs and storage policies tied to listing ownership/publication.

## Listing workflow

1. Sellers create a draft, add category-defined details and upload photos under their own `user_id/listing_id/` path.
2. Submission requires an image and seller acknowledgment of the prohibited-items/safety rules; a database RPC changes the listing to `pending_approval`.
3. Only admin moderation can publish, reject, suspend or feature a listing. Public search is limited to published, unexpired listings.
4. Sellers can edit drafts/rejected listings, mark an active listing sold, renew an expired listing for approval, archive eligible items and manage enquiries.

CDM 360 does not process payments or guarantee item quality, ownership or transaction safety. Buyers and sellers connect directly.

## Verification

The Angular production build and marketplace route tests were run. Supabase RLS, RPC and Storage policies still require role-based testing against a development project after applying the migration; a successful build does not verify database authorization.
