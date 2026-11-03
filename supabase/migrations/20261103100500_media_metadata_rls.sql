-- Media module 6/6: table RLS, column protection, RPCs and admin views.
-- Apply after migrations 1-5. All tables keep RLS enabled.
begin;

-- ---------------------------------------------------------------
-- media_assets
-- ---------------------------------------------------------------
alter policy "read public media or own media" on public.media_assets
using ((visibility = 'public' and deleted_at is null) or owner_user_id = (select auth.uid()) or public.is_admin());

alter policy "directory public media assets" on public.media_assets
using (visibility = 'public' and deleted_at is null);

-- Uploader identity comes from auth.uid(); the object path must be one the caller may write.
alter policy "insert own media metadata" on public.media_assets
with check (
  owner_user_id = (select auth.uid())
  and bucket_name is not null
  and starts_with(storage_path, bucket_name || '/')
  and (
    (bucket_name = 'cdm360-public-media'
      and public.can_upload_to_media_path(bucket_name, substr(storage_path, length(bucket_name) + 2)))
    or (bucket_name = 'cdm360-private-files' and visibility <> 'public'
      and public.can_access_private_file(substr(storage_path, length(bucket_name) + 2)))
  )
  and (
    visibility <> 'public'
    or public.is_admin()
    or starts_with(storage_path, 'cdm360-public-media/profiles/' || (select auth.uid())::text || '/')
  )
);

-- Direct client updates may only change descriptive fields. Publication, ownership,
-- location and soft deletion go through administrators or the RPCs below.
create or replace function public.protect_media_asset_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    if new.owner_user_id is distinct from old.owner_user_id
       or new.bucket_name is distinct from old.bucket_name
       or new.storage_path is distinct from old.storage_path
       or new.media_type is distinct from old.media_type
       or new.mime_type is distinct from old.mime_type
       or new.file_size_bytes is distinct from old.file_size_bytes
       or new.upload_status is distinct from old.upload_status
       or new.deleted_at is distinct from old.deleted_at
       or (new.visibility is distinct from old.visibility and new.visibility <> 'private') then
      raise exception 'This media field can only be changed by an administrator' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_media_asset_columns on public.media_assets;
create trigger protect_media_asset_columns before update on public.media_assets
for each row execute function public.protect_media_asset_columns();

-- ---------------------------------------------------------------
-- listing_media: the attached asset must belong to the caller (or an admin).
-- ---------------------------------------------------------------
alter policy "provider manages listing media" on public.listing_media
with check (
  public.is_admin() or (
    exists (
      select 1 from public.service_listings sl
      join public.service_providers sp on sp.id = sl.provider_id
      where sl.id = listing_id and sp.owner_user_id = (select auth.uid())
        and sl.status in ('draft', 'pending_review')
    )
    and exists (
      select 1 from public.media_assets ma
      where ma.id = media_asset_id and ma.owner_user_id = (select auth.uid())
    )
  )
);

-- ---------------------------------------------------------------
-- provider_media
-- ---------------------------------------------------------------
create policy "directory provider media" on public.provider_media for select to anon
using (exists (
  select 1 from public.service_providers sp
  where sp.id = provider_id and sp.verification_status = 'verified'
));

create policy "read provider media" on public.provider_media for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.service_providers sp
    where sp.id = provider_id
      and (sp.verification_status = 'verified' or sp.owner_user_id = (select auth.uid()))
  )
);

create policy "owner manages provider media" on public.provider_media for all to authenticated
using (public.can_manage_media_target('provider', provider_id))
with check (
  public.can_manage_media_target('provider', provider_id)
  and (public.is_admin() or exists (
    select 1 from public.media_assets ma
    where ma.id = media_asset_id and ma.owner_user_id = (select auth.uid())
  ))
);

grant select on public.provider_media to anon;
grant select, insert, update, delete on public.provider_media to authenticated;

-- ---------------------------------------------------------------
-- media_cleanup_queue
-- ---------------------------------------------------------------
create policy "read own or admin cleanup items" on public.media_cleanup_queue for select to authenticated
using (requested_by = (select auth.uid()) or public.is_admin());

create policy "request cleanup of writable paths" on public.media_cleanup_queue for insert to authenticated
with check (
  requested_by = (select auth.uid())
  and reason in ('metadata_failed', 'deleted', 'replaced')
  and (
    (bucket_name = 'cdm360-public-media' and public.can_upload_to_media_path(bucket_name, object_path))
    or (bucket_name = 'cdm360-private-files' and public.can_access_private_file(object_path))
  )
);

create policy "admin updates cleanup items" on public.media_cleanup_queue for update to authenticated
using (public.is_admin()) with check (public.is_admin());

grant select, insert, update on public.media_cleanup_queue to authenticated;

-- ---------------------------------------------------------------
-- RPCs (SECURITY DEFINER with explicit permission checks)
-- ---------------------------------------------------------------
create or replace function public.retire_media_asset(_asset public.media_assets, _reason text)
returns public.media_cleanup_queue
language plpgsql
security definer
set search_path = ''
as $$
declare
  queued public.media_cleanup_queue;
begin
  if _asset.owner_user_id is distinct from (select auth.uid()) and not public.is_admin() then
    raise exception 'You do not have permission to change this media' using errcode = '42501';
  end if;
  if not public.is_admin() and exists (
    select 1 from public.listing_media lm
    join public.service_listings sl on sl.id = lm.listing_id
    where lm.media_asset_id = _asset.id and sl.status not in ('draft', 'pending_review')
  ) then
    raise exception 'Images on published listings require an administrator' using errcode = '42501';
  end if;

  update public.media_assets
  set deleted_at = pg_catalog.now(), upload_status = 'deleted', visibility = 'private'
  where id = _asset.id;
  delete from public.listing_media where media_asset_id = _asset.id;
  delete from public.provider_media where media_asset_id = _asset.id;
  update public.profiles set avatar_path = null where avatar_path = _asset.storage_path;

  insert into public.media_cleanup_queue(media_asset_id, bucket_name, object_path, reason, requested_by)
  values (_asset.id, _asset.bucket_name, substr(_asset.storage_path, length(_asset.bucket_name) + 2), _reason, (select auth.uid()))
  returning * into queued;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'media.' || _reason, 'media_asset', _asset.id,
          pg_catalog.jsonb_build_object('bucket', _asset.bucket_name, 'path', _asset.storage_path));
  return queued;
end;
$$;

create or replace function public.delete_media_asset(_media_id uuid)
returns public.media_cleanup_queue
language plpgsql
security definer
set search_path = ''
as $$
declare
  asset public.media_assets;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select * into asset from public.media_assets where id = _media_id and deleted_at is null for update;
  if not found then raise exception 'Media not found'; end if;
  return public.retire_media_asset(asset, 'deleted');
end;
$$;

create or replace function public.replace_media_asset(_old_id uuid, _new_id uuid)
returns public.media_cleanup_queue
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_asset public.media_assets;
  new_asset public.media_assets;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select * into old_asset from public.media_assets where id = _old_id and deleted_at is null for update;
  select * into new_asset from public.media_assets where id = _new_id and deleted_at is null for update;
  if old_asset.id is null or new_asset.id is null then raise exception 'Media not found'; end if;
  if new_asset.owner_user_id is distinct from (select auth.uid()) and not public.is_admin() then
    raise exception 'You do not have permission to change this media' using errcode = '42501';
  end if;
  if old_asset.owner_user_id is distinct from (select auth.uid()) and not public.is_admin() then
    raise exception 'You do not have permission to change this media' using errcode = '42501';
  end if;

  update public.listing_media set media_asset_id = _new_id where media_asset_id = _old_id;
  update public.provider_media set media_asset_id = _new_id where media_asset_id = _old_id;
  update public.profiles set avatar_path = new_asset.storage_path where avatar_path = old_asset.storage_path;
  update public.media_assets set visibility = old_asset.visibility where id = _new_id;
  return public.retire_media_asset(old_asset, 'replaced');
end;
$$;

create or replace function public.resolve_media_cleanup(_queue_id uuid, _error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.media_cleanup_queue
  set resolved_at = case when _error is null then pg_catalog.now() else null end,
      attempts = attempts + 1,
      last_error = left(_error, 500)
  where id = _queue_id and resolved_at is null
    and (requested_by = (select auth.uid()) or public.is_admin());
end;
$$;

create or replace function public.admin_media_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return (
    select pg_catalog.jsonb_build_object(
      'total', pg_catalog.count(*) filter (where deleted_at is null),
      'public', pg_catalog.count(*) filter (where deleted_at is null and visibility = 'public'),
      'private', pg_catalog.count(*) filter (where deleted_at is null and visibility <> 'public'),
      'failed', pg_catalog.count(*) filter (where upload_status = 'failed'),
      'deleted', pg_catalog.count(*) filter (where deleted_at is not null),
      'recent', pg_catalog.count(*) filter (where deleted_at is null and created_at > pg_catalog.now() - interval '7 days'),
      'bytes', coalesce(pg_catalog.sum(file_size_bytes) filter (where deleted_at is null), 0),
      'orphaned', pg_catalog.count(*) filter (
        where deleted_at is null
          and not exists (select 1 from public.listing_media lm where lm.media_asset_id = ma.id)
          and not exists (select 1 from public.provider_media pm where pm.media_asset_id = ma.id)
          and not exists (select 1 from public.profiles p where p.avatar_path = ma.storage_path)),
      'pending_cleanup', (select pg_catalog.count(*) from public.media_cleanup_queue where resolved_at is null)
    )
    from public.media_assets ma
  );
end;
$$;

revoke all on function public.retire_media_asset(public.media_assets, text) from public, anon, authenticated;
revoke all on function public.delete_media_asset(uuid) from public, anon;
revoke all on function public.replace_media_asset(uuid, uuid) from public, anon;
revoke all on function public.resolve_media_cleanup(uuid, text) from public, anon;
revoke all on function public.admin_media_stats() from public, anon;
grant execute on function public.delete_media_asset(uuid) to authenticated;
grant execute on function public.replace_media_asset(uuid, uuid) to authenticated;
grant execute on function public.resolve_media_cleanup(uuid, text) to authenticated;
grant execute on function public.admin_media_stats() to authenticated;

-- Admin listing view. security_invoker keeps RLS in force, so non-admins only see their own rows.
create or replace view public.admin_media_overview with (security_invoker = true) as
select
  ma.id, ma.original_filename, ma.stored_filename, ma.bucket_name, ma.storage_path, ma.media_type,
  ma.mime_type, ma.file_size_bytes, ma.width, ma.height, ma.alt_text, ma.caption, ma.visibility,
  ma.upload_status, ma.owner_user_id, p.full_name as uploader_name, ma.created_at, ma.deleted_at,
  case
    when exists (select 1 from public.listing_media lm where lm.media_asset_id = ma.id) then 'service_listing'
    when exists (select 1 from public.provider_media pm where pm.media_asset_id = ma.id) then 'provider'
    when exists (select 1 from public.profiles pr where pr.avatar_path = ma.storage_path) then 'profile'
    else null
  end as related_module
from public.media_assets ma
left join public.profiles p on p.id = ma.owner_user_id;
revoke all on public.admin_media_overview from public, anon;
grant select on public.admin_media_overview to authenticated;

commit;
