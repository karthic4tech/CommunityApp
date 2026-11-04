-- Keep the existing public directory RPC and add category/subcategory text search.
-- No tables, columns, RLS policies, or result shape are changed.
begin;

create or replace function public.directory_listings(
  category uuid, location uuid default null, keyword text default ''
) returns setof public.service_listings
language sql stable security invoker set search_path = '' as $$
  with recursive categories as (
    select id
    from public.service_categories
    where is_active and ((category is null and parent_id is null) or id = category)
    union
    select child.id
    from public.service_categories child
    join categories parent on child.parent_id = parent.id
    where child.is_active
  ), places as (
    select id from public.locations where id = location and is_active
    union
    select child.id
    from public.locations child
    join places parent on child.parent_id = parent.id
    where child.is_active
  ), category_paths(listing_category_id, ancestor_category_id) as (
    select id, id from public.service_categories where is_active
    union
    select path.listing_category_id, parent.id
    from category_paths path
    join public.service_categories current_category on current_category.id = path.ancestor_category_id
    join public.service_categories parent on parent.id = current_category.parent_id and parent.is_active
  )
  select listing.*
  from public.service_listings listing
  join public.service_providers provider on provider.id = listing.provider_id
  where listing.status = 'published'
    and provider.verification_status = 'verified'
    and (category is null or listing.category_id in (select id from categories))
    and (location is null or exists (
      select 1
      from public.listing_locations listing_location
      where listing_location.listing_id = listing.id
        and listing_location.location_id in (select id from places)
    ))
    and (
      coalesce(trim(keyword), '') = ''
      or strpos(lower(concat_ws(' ', listing.title, listing.description, provider.display_name, provider.description)), lower(trim(keyword))) > 0
      or exists (
        select 1
        from category_paths path
        join public.service_categories searched_category on searched_category.id = path.ancestor_category_id
        where path.listing_category_id = listing.category_id
          and strpos(lower(concat_ws(' ', searched_category.name_en, searched_category.name_ta, searched_category.slug)), lower(trim(keyword))) > 0
      )
    );
$$;

revoke all on function public.directory_listings(uuid, uuid, text) from public;
grant execute on function public.directory_listings(uuid, uuid, text) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
