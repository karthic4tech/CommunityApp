-- User submission workflow additions.
-- Apply after the existing core/public-directory migrations only after
-- reconciling local and remote migration history.
begin;

alter table public.service_providers
  add column if not exists address text,
  add column if not exists postal_code text,
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6);

alter table public.service_providers
  drop constraint if exists service_providers_latitude_check,
  drop constraint if exists service_providers_longitude_check;

alter table public.service_providers
  add constraint service_providers_latitude_check
    check (latitude is null or latitude between -90 and 90),
  add constraint service_providers_longitude_check
    check (longitude is null or longitude between -180 and 180),
  add constraint service_providers_postal_code_check
    check (postal_code is null or char_length(postal_code) between 3 and 16);

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
     ) then
    raise exception 'Published provider details require an administrator-approved listing update';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_published_provider_edit on public.service_providers;
create trigger prevent_published_provider_edit
before update on public.service_providers
for each row execute function public.prevent_published_provider_edit();

create or replace function public.protect_listing_category_selection()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not public.is_admin()
     and not exists (select 1 from public.service_categories where id = new.category_id and is_active) then
    raise exception 'A submission must use an active service category';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_listing_category_selection on public.service_listings;
create trigger protect_listing_category_selection
before insert or update of category_id on public.service_listings
for each row execute function public.protect_listing_category_selection();

-- The existing table has a single contact_type check. Expand it only for
-- explicitly supported HTTPS social profiles; privacy still uses is_public.
alter table public.listing_contacts
  drop constraint if exists listing_contacts_contact_type_check;
alter table public.listing_contacts
  add constraint listing_contacts_contact_type_check
    check (contact_type in ('phone', 'whatsapp', 'email', 'website', 'facebook', 'instagram', 'youtube', 'other'));

create table if not exists public.service_listing_revisions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.service_listings(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'changes_requested', 'rejected', 'approved')),
  snapshot jsonb not null default '{}'::jsonb,
  review_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, version_number)
);

create index if not exists ix_service_listing_revisions_listing_status
  on public.service_listing_revisions(listing_id, status, version_number desc);
create index if not exists ix_service_listing_revisions_submitter
  on public.service_listing_revisions(submitted_by, updated_at desc);

alter table public.service_listing_revisions enable row level security;

create policy "owners read own listing revisions"
on public.service_listing_revisions for select to authenticated
using (
  submitted_by = (select auth.uid())
  or exists (
    select 1 from public.service_listings sl
    join public.service_providers sp on sp.id = sl.provider_id
    where sl.id = listing_id and sp.owner_user_id = (select auth.uid())
  )
  or public.is_admin()
);

create policy "owners create own listing revisions"
on public.service_listing_revisions for insert to authenticated
with check (
  submitted_by = (select auth.uid())
  and exists (
    select 1 from public.service_listings sl
    join public.service_providers sp on sp.id = sl.provider_id
    where sl.id = listing_id and sp.owner_user_id = (select auth.uid())
  )
);

create policy "owners update editable listing revisions"
on public.service_listing_revisions for update to authenticated
using (
  public.is_admin()
  or (
    submitted_by = (select auth.uid())
    and status in ('draft', 'changes_requested')
  )
)
with check (
  public.is_admin()
  or (
    submitted_by = (select auth.uid())
    and status in ('draft', 'pending_review', 'changes_requested')
  )
);

create policy "admins manage listing revisions"
on public.service_listing_revisions for delete to authenticated
using (public.is_admin());

drop trigger if exists set_updated_at on public.service_listing_revisions;
create trigger set_updated_at
before update on public.service_listing_revisions
for each row execute function public.set_updated_at();

grant select, insert, update on public.service_listing_revisions to authenticated;
grant delete on public.service_listing_revisions to authenticated;

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
  if _decision not in ('approve', 'request_changes', 'reject', 'unpublish') then
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
    set status = 'published', published_at = coalesce(published_at, pg_catalog.now()), submitted_at = coalesce(submitted_at, pg_catalog.now())
    where id = _listing_id;
    update public.media_assets asset
    set visibility = 'public'
    where asset.id in (select media_asset_id from public.listing_media where listing_id = _listing_id);
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
          latitude = nullif(listing_snapshot #>> '{provider,latitude}', '')::numeric,
          longitude = nullif(listing_snapshot #>> '{provider,longitude}', '')::numeric,
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
          latitude = nullif(listing_snapshot #>> '{provider,latitude}', '')::numeric,
          longitude = nullif(listing_snapshot #>> '{provider,longitude}', '')::numeric
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

revoke all on function public.admin_review_service_listing(uuid, text, text, boolean) from public, anon;
revoke all on function public.admin_review_service_listing_revision(uuid, text, text, boolean) from public, anon;
grant execute on function public.admin_review_service_listing(uuid, text, text, boolean) to authenticated;
grant execute on function public.admin_review_service_listing_revision(uuid, text, text, boolean) to authenticated;

commit;
