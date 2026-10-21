-- Apply after 001, 002 and 003. No tables/columns or write policies are changed.
begin;

-- Keep the original owner/admin SELECT rules, but never execute is_admin() as anon.
alter policy "active locations are readable" on public.locations to authenticated;
alter policy "read verified providers or own" on public.service_providers to authenticated;
alter policy "read published listings or own or admin" on public.service_listings to authenticated;
alter policy "read listing locations with listing access" on public.listing_locations to authenticated;
alter policy "read listing contacts with listing access" on public.listing_contacts to authenticated;
alter policy "read listing media with listing access" on public.listing_media to authenticated;
alter policy "read public media or own media" on public.media_assets to authenticated;

create policy "directory active locations" on public.locations for select to anon
using (is_active = true);
create policy "directory verified providers" on public.service_providers for select to anon
using (verification_status = 'verified');
create policy "directory published listings" on public.service_listings for select to anon
using (status = 'published' and exists (
  select 1 from public.service_providers sp where sp.id = provider_id and sp.verification_status = 'verified'
));
create policy "directory listing locations" on public.listing_locations for select to anon
using (exists (select 1 from public.service_listings sl where sl.id = listing_id and sl.status = 'published'));
create policy "directory public contacts" on public.listing_contacts for select to anon
using (is_public = true and exists (
  select 1 from public.service_listings sl where sl.id = listing_id and sl.status = 'published'
));
create policy "directory listing media" on public.listing_media for select to anon
using (exists (select 1 from public.service_listings sl where sl.id = listing_id and sl.status = 'published'));
create policy "directory public media assets" on public.media_assets for select to anon
using (visibility = 'public');

-- An invoker (not definer) function keeps RLS in force. Returning the real row type
-- lets PostgREST embed the existing FK relationships. Filters also apply to owners/admins.
create or replace function public.directory_listings(
  category uuid, location uuid default null, keyword text default ''
) returns setof public.service_listings
language sql stable security invoker set search_path = '' as $$
  with recursive categories as (
    select id from public.service_categories where id = category and is_active
    union
    select c.id from public.service_categories c join categories p on c.parent_id = p.id where c.is_active
  ), places as (
    select id from public.locations where id = location and is_active
    union
    select l.id from public.locations l join places p on l.parent_id = p.id where l.is_active
  )
  select sl.* from public.service_listings sl
  join public.service_providers sp on sp.id = sl.provider_id
  where sl.status = 'published' and sp.verification_status = 'verified'
    and sl.category_id in (select id from categories)
    and (location is null or exists (
      select 1 from public.listing_locations ll
      where ll.listing_id = sl.id and ll.location_id in (select id from places)
    ))
    and (coalesce(trim(keyword), '') = '' or strpos(
      lower(sl.title || ' ' || sl.description || ' ' || sp.display_name), lower(trim(keyword))
    ) > 0);
$$;
revoke all on function public.directory_listings(uuid, uuid, text) from public;
grant execute on function public.directory_listings(uuid, uuid, text) to anon, authenticated;
grant select on public.locations, public.service_providers, public.service_listings,
  public.listing_locations, public.listing_contacts, public.listing_media, public.media_assets to anon, authenticated;
-- All existing RLS remains enabled; Storage configuration is deliberately unchanged.
commit;
