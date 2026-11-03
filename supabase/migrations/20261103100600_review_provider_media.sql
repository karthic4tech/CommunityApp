-- Media module 7/7: align provider (business) media visibility with listing approval.
-- Extends the existing admin_review_service_listing RPC (security invoker, is_admin() check)
-- to flip provider_media assets the same way listing assets are flipped.
begin;

create or replace function public.admin_review_service_listing(
  _listing_id uuid,
  _decision text,
  _notes text default null,
  _verify_provider boolean default false
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  listing_row public.service_listings;
  provider_status text;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if _decision is null or _decision not in ('approve', 'request_changes', 'reject', 'unpublish') then
    raise exception 'Unsupported review decision';
  end if;

  select * into listing_row
  from public.service_listings
  where id = _listing_id
  for update;
  if not found then raise exception 'Listing not found'; end if;

  if _verify_provider then
    update public.service_providers
    set verification_status = 'verified'
    where id = listing_row.provider_id;
  end if;

  select verification_status into provider_status
  from public.service_providers where id = listing_row.provider_id;

  if _decision = 'approve' then
    if provider_status <> 'verified' then
      raise exception 'Provider must be verified before publication';
    end if;
    if not exists (select 1 from public.service_categories where id = listing_row.category_id and is_active) then
      raise exception 'Listing category must be active before publication';
    end if;
    update public.service_listings
    set status = 'published',
        published_at = coalesce(published_at, pg_catalog.now()),
        submitted_at = coalesce(submitted_at, pg_catalog.now())
    where id = _listing_id;
    update public.media_assets asset
    set visibility = 'public'
    where asset.id in (select media_asset_id from public.listing_media where listing_id = _listing_id);
    -- A verified provider's business images (logo, profile, gallery) are approved with the listing.
    update public.media_assets asset
    set visibility = 'public'
    where asset.id in (select media_asset_id from public.provider_media where provider_id = listing_row.provider_id);
    insert into public.listing_verification_history(listing_id, reviewer_user_id, decision, notes)
    values (_listing_id, (select auth.uid()), 'approved', _notes);
  elsif _decision = 'request_changes' then
    update public.service_listings set status = 'draft', submitted_at = null where id = _listing_id;
    insert into public.listing_verification_history(listing_id, reviewer_user_id, decision, notes)
    values (_listing_id, (select auth.uid()), 'changes_requested', _notes);
  elsif _decision = 'reject' then
    update public.service_listings set status = 'rejected' where id = _listing_id;
    insert into public.listing_verification_history(listing_id, reviewer_user_id, decision, notes)
    values (_listing_id, (select auth.uid()), 'rejected', _notes);
  else
    update public.service_listings set status = 'archived' where id = _listing_id;
    update public.media_assets asset
    set visibility = 'private'
    where asset.id in (select media_asset_id from public.listing_media where listing_id = _listing_id);
    insert into public.listing_verification_history(listing_id, reviewer_user_id, decision, notes)
    values (_listing_id, (select auth.uid()), 'suspended', _notes);
  end if;
  return _listing_id;
end;
$$;

revoke all on function public.admin_review_service_listing(uuid, text, text, boolean) from public, anon;
grant execute on function public.admin_review_service_listing(uuid, text, text, boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
