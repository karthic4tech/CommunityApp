-- Media module 4/6: authorization helpers used by Storage and table policies.
-- Path convention (object name inside a bucket):
--   cdm360-public-media : profiles/{user_id}/..., businesses/{provider_id}/..., services/{listing_id}/...
--                         events|announcements|categories|banners/{id}/...  (administrators only for now)
--   cdm360-private-files: verification/{user_id}/..., businesses/{provider_id}/...
begin;

create or replace function public.can_manage_media_target(_entity_type text, _entity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(case _entity_type
    when 'profile' then _entity_id = (select auth.uid())
    when 'provider' then exists (
      select 1 from public.service_providers sp
      where sp.id = _entity_id and sp.owner_user_id = (select auth.uid())
    )
    when 'listing' then exists (
      select 1 from public.service_listings sl
      join public.service_providers sp on sp.id = sl.provider_id
      where sl.id = _entity_id and sp.owner_user_id = (select auth.uid())
        and sl.status in ('draft', 'pending_review')
    )
    else false
  end, false) or public.is_admin();
$$;

create or replace function public.can_upload_to_media_path(_bucket text, _object text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts text[] := pg_catalog.string_to_array(coalesce(_object, ''), '/');
  entity uuid;
begin
  if (select auth.uid()) is null or pg_catalog.array_length(parts, 1) < 3 or _bucket <> 'cdm360-public-media' then
    return false;
  end if;
  begin
    entity := parts[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return case parts[1]
    when 'profiles' then public.can_manage_media_target('profile', entity)
    when 'businesses' then public.can_manage_media_target('provider', entity)
    when 'services' then public.can_manage_media_target('listing', entity)
    when 'events' then public.is_admin()
    when 'announcements' then public.is_admin()
    when 'categories' then public.is_admin()
    when 'banners' then public.is_admin()
    else false
  end;
end;
$$;

create or replace function public.can_access_private_file(_object text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  parts text[] := pg_catalog.string_to_array(coalesce(_object, ''), '/');
  entity uuid;
begin
  if (select auth.uid()) is null or pg_catalog.array_length(parts, 1) < 3 then
    return false;
  end if;
  begin
    entity := parts[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  if public.has_role('super_admin') or public.has_role('district_admin') then
    return parts[1] in ('verification', 'businesses');
  end if;
  return case parts[1]
    when 'verification' then entity = (select auth.uid())
    when 'businesses' then exists (
      select 1 from public.service_providers sp
      where sp.id = entity and sp.owner_user_id = (select auth.uid())
    )
    else false
  end;
end;
$$;

revoke all on function public.can_manage_media_target(text, uuid) from public, anon;
revoke all on function public.can_upload_to_media_path(text, text) from public, anon;
revoke all on function public.can_access_private_file(text) from public, anon;
grant execute on function public.can_manage_media_target(text, uuid) to authenticated;
grant execute on function public.can_upload_to_media_path(text, text) to authenticated;
grant execute on function public.can_access_private_file(text) to authenticated;

commit;
