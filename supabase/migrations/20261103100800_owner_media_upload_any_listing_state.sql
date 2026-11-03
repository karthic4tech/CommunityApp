-- Media module 8/8: let owners attach PRIVATE images to their own listings in any state.
-- Images stay invisible to the public until an administrator approves a submission or
-- revision (admin_review_service_listing / admin_review_service_listing_revision flip
-- listing media to public). Updates and deletes of listing media stay moderated.
begin;

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
    when 'services' then exists (
      select 1 from public.service_listings sl
      join public.service_providers sp on sp.id = sl.provider_id
      where sl.id = entity and sp.owner_user_id = (select auth.uid())
    ) or public.is_admin()
    when 'events' then public.is_admin()
    when 'announcements' then public.is_admin()
    when 'categories' then public.is_admin()
    when 'banners' then public.is_admin()
    else false
  end;
end;
$$;

-- Insert-only owner policy; row update/delete keep the moderated rules from migration 6.
drop policy if exists "owner links own media to own listing" on public.listing_media;
create policy "owner links own media to own listing" on public.listing_media for insert to authenticated
with check (
  exists (
    select 1 from public.service_listings sl
    join public.service_providers sp on sp.id = sl.provider_id
    where sl.id = listing_id and sp.owner_user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.media_assets ma
    where ma.id = media_asset_id and ma.owner_user_id = (select auth.uid())
  )
);

notify pgrst, 'reload schema';
commit;
