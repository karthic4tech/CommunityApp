begin;

alter table public.service_providers
  add column if not exists google_maps_url text,
  add column if not exists location_source text;

alter table public.service_providers
  drop constraint if exists service_providers_google_maps_url_check,
  drop constraint if exists service_providers_location_source_check,
  drop constraint if exists service_providers_location_method_check;

alter table public.service_providers
  add constraint service_providers_google_maps_url_check
    check (
      google_maps_url is null
      or (
        char_length(google_maps_url) between 1 and 2048
        and google_maps_url ~* '^https://(maps\.app\.goo\.gl/[A-Za-z0-9_-]+/?([?][^[:space:]]*)?|goo\.gl/maps/[A-Za-z0-9_-]+/?([?][^[:space:]]*)?|((www|maps)\.)?google\.(com|co\.in|co\.uk|ca|com\.au|de|fr|co\.jp)(/maps(/|[?#])|/maps$|/[?][^[:space:]]*(q|query|ll|center|destination|daddr)=)[^[:space:]]*)$'
      )
    ),
  add constraint service_providers_location_source_check
    check (location_source is null or location_source in ('gps', 'google_maps_link')),
  add constraint service_providers_location_method_check
    check (
      location_source is null
      or (
        location_source = 'gps'
        and latitude is not null
        and longitude is not null
        and google_maps_url is null
      )
      or (
        location_source = 'google_maps_link'
        and google_maps_url is not null
        and ((latitude is null and longitude is null) or (latitude is not null and longitude is not null))
      )
    );

create or replace function public.prevent_published_provider_edit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and not public.is_admin()
     and exists (select 1 from public.service_listings where provider_id = old.id and status = 'published')
     and (
       new.provider_type is distinct from old.provider_type
       or new.display_name is distinct from old.display_name
       or new.description is distinct from old.description
       or new.public_email is distinct from old.public_email
       or new.website_url is distinct from old.website_url
       or new.address is distinct from old.address
       or new.postal_code is distinct from old.postal_code
       or new.latitude is distinct from old.latitude
       or new.longitude is distinct from old.longitude
       or new.google_maps_url is distinct from old.google_maps_url
       or new.location_source is distinct from old.location_source
     ) then
    raise exception 'Published provider details require an administrator-approved listing update';
  end if;
  return new;
end;
$$;

create or replace function public.admin_review_service_listing_revision(
  _revision_id uuid,
  _decision text,
  _notes text default null,
  _verify_provider boolean default false
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  revision_row public.service_listing_revisions;
  listing_row public.service_listings;
  provider_status text;
  listing_snapshot jsonb;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  if _decision not in ('approve', 'request_changes', 'reject') then
    raise exception 'Unsupported revision decision';
  end if;

  select * into revision_row from public.service_listing_revisions
  where id = _revision_id for update;
  if not found then raise exception 'Revision not found'; end if;
  select * into listing_row from public.service_listings
  where id = revision_row.listing_id for update;
  if not found then raise exception 'Listing not found'; end if;

  if _decision = 'approve' then
    listing_snapshot := revision_row.snapshot;
    if _verify_provider then
      update public.service_providers
      set provider_type = coalesce(listing_snapshot #>> '{provider,provider_type}', provider_type),
          display_name = coalesce(listing_snapshot #>> '{provider,display_name}', display_name),
          description = nullif(listing_snapshot #>> '{provider,description}', ''),
          public_email = nullif(listing_snapshot #>> '{provider,public_email}', ''),
          website_url = nullif(listing_snapshot #>> '{provider,website_url}', ''),
          address = nullif(listing_snapshot #>> '{provider,address}', ''),
          postal_code = nullif(listing_snapshot #>> '{provider,postal_code}', ''),
          latitude = case when listing_snapshot #> '{provider,latitude}' is null then latitude else nullif(listing_snapshot #>> '{provider,latitude}', '')::numeric end,
          longitude = case when listing_snapshot #> '{provider,longitude}' is null then longitude else nullif(listing_snapshot #>> '{provider,longitude}', '')::numeric end,
          google_maps_url = case when listing_snapshot #> '{provider,google_maps_url}' is null then google_maps_url else nullif(listing_snapshot #>> '{provider,google_maps_url}', '') end,
          location_source = case when listing_snapshot #> '{provider,location_source}' is null then location_source else nullif(listing_snapshot #>> '{provider,location_source}', '') end,
          verification_status = 'verified'
      where id = listing_row.provider_id;
    else
      update public.service_providers
      set provider_type = coalesce(listing_snapshot #>> '{provider,provider_type}', provider_type),
          display_name = coalesce(listing_snapshot #>> '{provider,display_name}', display_name),
          description = nullif(listing_snapshot #>> '{provider,description}', ''),
          public_email = nullif(listing_snapshot #>> '{provider,public_email}', ''),
          website_url = nullif(listing_snapshot #>> '{provider,website_url}', ''),
          address = nullif(listing_snapshot #>> '{provider,address}', ''),
          postal_code = nullif(listing_snapshot #>> '{provider,postal_code}', ''),
          latitude = case when listing_snapshot #> '{provider,latitude}' is null then latitude else nullif(listing_snapshot #>> '{provider,latitude}', '')::numeric end,
          longitude = case when listing_snapshot #> '{provider,longitude}' is null then longitude else nullif(listing_snapshot #>> '{provider,longitude}', '')::numeric end,
          google_maps_url = case when listing_snapshot #> '{provider,google_maps_url}' is null then google_maps_url else nullif(listing_snapshot #>> '{provider,google_maps_url}', '') end,
          location_source = case when listing_snapshot #> '{provider,location_source}' is null then location_source else nullif(listing_snapshot #>> '{provider,location_source}', '') end
      where id = listing_row.provider_id;
    end if;

    select verification_status into provider_status from public.service_providers where id = listing_row.provider_id;
    if provider_status <> 'verified' then raise exception 'Provider must be verified before publication'; end if;
    if not exists (select 1 from public.service_categories where id = (listing_snapshot #>> '{listing,category_id}')::uuid and is_active) then
      raise exception 'Listing category must be active before publication';
    end if;

    update public.service_listings
    set category_id = (listing_snapshot #>> '{listing,category_id}')::uuid,
        title = coalesce(listing_snapshot #>> '{listing,title}', title),
        description = coalesce(listing_snapshot #>> '{listing,description}', description),
        status = 'published', published_at = coalesce(published_at, pg_catalog.now())
    where id = revision_row.listing_id;
    update public.media_assets asset
    set visibility = 'public'
    where asset.id in (select media_asset_id from public.listing_media where listing_id = revision_row.listing_id);

    delete from public.listing_contacts where listing_id = revision_row.listing_id;
    insert into public.listing_contacts(listing_id, contact_type, contact_value, is_public, sort_order)
    select revision_row.listing_id, contact_type, contact_value, coalesce(is_public, true), coalesce(sort_order, 0)
    from jsonb_to_recordset(coalesce(listing_snapshot->'contacts', '[]'::jsonb)) as contacts(contact_type text, contact_value text, is_public boolean, sort_order integer);

    delete from public.listing_locations where listing_id = revision_row.listing_id;
    insert into public.listing_locations(listing_id, location_id, coverage_type)
    select revision_row.listing_id, location_id::uuid, coverage_type
    from jsonb_to_recordset(coalesce(listing_snapshot->'locations', '[]'::jsonb)) as locations(location_id text, coverage_type text);

    update public.service_listing_revisions
    set status = 'approved', review_notes = _notes, reviewed_by = (select auth.uid()), reviewed_at = pg_catalog.now()
    where id = _revision_id;
    insert into public.listing_verification_history(listing_id, reviewer_user_id, decision, notes)
    values (revision_row.listing_id, (select auth.uid()), 'approved', _notes);
  elsif _decision = 'request_changes' then
    update public.service_listing_revisions
    set status = 'changes_requested', review_notes = _notes, reviewed_by = (select auth.uid()), reviewed_at = pg_catalog.now()
    where id = _revision_id;
    insert into public.listing_verification_history(listing_id, reviewer_user_id, decision, notes)
    values (revision_row.listing_id, (select auth.uid()), 'changes_requested', _notes);
  else
    update public.service_listing_revisions
    set status = 'rejected', review_notes = _notes, reviewed_by = (select auth.uid()), reviewed_at = pg_catalog.now()
    where id = _revision_id;
    insert into public.listing_verification_history(listing_id, reviewer_user_id, decision, notes)
    values (revision_row.listing_id, (select auth.uid()), 'rejected', _notes);
  end if;
  return revision_row.listing_id;
end;
$$;

commit;
