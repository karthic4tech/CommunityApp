-- Additive Essential Services curation for the existing service directory.
-- Essential selection is independent from is_active; All Services continues to
-- use every active row while the curated experience filters is_essential=true.
begin;

alter table public.service_categories
  add column if not exists is_essential boolean not null default false,
  add column if not exists essential_order integer,
  add column if not exists show_as_shortcut boolean not null default false,
  add column if not exists shortcut_order integer,
  add column if not exists show_on_homepage boolean not null default false,
  add column if not exists homepage_order integer,
  add column if not exists is_emergency boolean not null default false;

alter table public.service_categories
  drop constraint if exists service_categories_essential_order_nonnegative,
  add constraint service_categories_essential_order_nonnegative
    check (essential_order is null or essential_order >= 0),
  drop constraint if exists service_categories_shortcut_order_nonnegative,
  add constraint service_categories_shortcut_order_nonnegative
    check (shortcut_order is null or shortcut_order >= 0),
  drop constraint if exists service_categories_homepage_order_nonnegative,
  add constraint service_categories_homepage_order_nonnegative
    check (homepage_order is null or homepage_order >= 0);

create index if not exists ix_service_categories_essential_order
  on public.service_categories(essential_order, sort_order, id)
  where is_active and is_essential;
create index if not exists ix_service_categories_homepage_order
  on public.service_categories(homepage_order, sort_order, id)
  where is_active and is_essential and show_on_homepage;
create index if not exists ix_service_categories_shortcut_order
  on public.service_categories(shortcut_order, sort_order, id)
  where is_active and is_essential and show_as_shortcut;

-- Stable public detail slugs let listing details coexist with legacy
-- /services/:categorySlug URLs. Category routes also have the explicit
-- /services/category/:slug form.
alter table public.service_listings add column if not exists slug text;
update public.service_listings
set slug = coalesce(nullif(trim(slug), ''),
  coalesce(nullif(trim(both '-' from regexp_replace(lower(title), '[^a-z0-9]+', '-', 'g')), ''), 'service') || '-' || left(id::text, 8))
where slug is null or trim(slug) = '';
create unique index if not exists ux_service_listings_slug on public.service_listings(slug);
alter table public.service_listings alter column slug set not null;

create or replace function public.set_service_listing_slug()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := coalesce(nullif(trim(both '-' from regexp_replace(lower(new.title), '[^a-z0-9]+', '-', 'g')), ''), 'service') || '-' || left(new.id::text, 8);
  end if;
  return new;
end;
$$;
drop trigger if exists set_service_listing_slug on public.service_listings;
create trigger set_service_listing_slug before insert on public.service_listings
for each row execute function public.set_service_listing_slug();

create table if not exists public.essential_service_shortcuts (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories(id) on delete cascade,
  subcategory_id uuid references public.service_categories(id) on delete cascade,
  title text not null,
  title_ta text,
  icon text,
  display_order integer not null default 0 check (display_order >= 0),
  is_active boolean not null default true,
  is_emergency boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint essential_service_shortcuts_target_unique unique (category_id, subcategory_id),
  constraint essential_service_shortcuts_title_nonempty check (length(trim(title)) > 0)
);

create index if not exists ix_essential_service_shortcuts_active_order
  on public.essential_service_shortcuts(display_order, id) where is_active;
create unique index if not exists ux_essential_service_shortcuts_root
  on public.essential_service_shortcuts(category_id) where subcategory_id is null;

create or replace function public.validate_essential_service_shortcut()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.subcategory_id is not null and not exists (
    select 1 from public.service_categories subcategory
    where subcategory.id = new.subcategory_id
      and subcategory.parent_id = new.category_id
  ) then
    raise exception 'Shortcut subcategory must belong to its selected category';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_essential_service_shortcut on public.essential_service_shortcuts;
create trigger validate_essential_service_shortcut
before insert or update of category_id, subcategory_id
on public.essential_service_shortcuts
for each row execute function public.validate_essential_service_shortcut();

drop trigger if exists set_updated_at on public.essential_service_shortcuts;
create trigger set_updated_at before update on public.essential_service_shortcuts
for each row execute function public.set_updated_at();

alter table public.essential_service_shortcuts enable row level security;
drop policy if exists "active essential shortcuts are public" on public.essential_service_shortcuts;
create policy "active essential shortcuts are public"
on public.essential_service_shortcuts for select to anon, authenticated
using (
  is_active
  and exists (
    select 1 from public.service_categories category
    where category.id = category_id and category.is_active and category.is_essential
  )
  and (subcategory_id is null or exists (
    select 1 from public.service_categories subcategory
    where subcategory.id = subcategory_id and subcategory.is_active and subcategory.is_essential
  ))
);
drop policy if exists "admins manage essential shortcuts" on public.essential_service_shortcuts;
create policy "admins manage essential shortcuts"
on public.essential_service_shortcuts for all to authenticated
using (public.is_admin()) with check (public.is_admin());
grant select on public.essential_service_shortcuts to anon, authenticated;
grant insert, update, delete on public.essential_service_shortcuts to authenticated;
grant select, insert, update, delete on public.service_categories to authenticated;

-- Seed the initial curated set against stable slugs already present in the
-- checked-in category seed. Administrators remain free to change the curation.
update public.service_categories
set is_essential = true,
    essential_order = case slug
      when 'medical-emergency-services' then 10
      when 'jobs-professional-services' then 20
      when 'transport-tourism-services' then 30
      when 'food-restaurant-services' then 40
      when 'vehicle-services' then 50
      when 'community-help-senior-care' then 60
      when 'government-public-services' then 70
      when 'funeral-death-related-services' then 80
      when 'home-services' then 90
      when 'sanitation-drainage-services' then 100
      when 'wholesale-retail-services' then 110
      when 'event-services' then 120
      else essential_order
    end,
    is_emergency = slug in ('medical-emergency-services', 'funeral-death-related-services'),
    show_on_homepage = slug in (
      'medical-emergency-services', 'jobs-professional-services',
      'transport-tourism-services', 'food-restaurant-services',
      'vehicle-services', 'home-services'
    ),
    homepage_order = case slug
      when 'medical-emergency-services' then 10
      when 'jobs-professional-services' then 20
      when 'transport-tourism-services' then 30
      when 'food-restaurant-services' then 40
      when 'vehicle-services' then 50
      when 'home-services' then 60
      else homepage_order
    end
where slug in (
  'medical-emergency-services', 'jobs-professional-services',
  'transport-tourism-services', 'food-restaurant-services',
  'vehicle-services', 'community-help-senior-care',
  'government-public-services', 'funeral-death-related-services',
  'home-services', 'sanitation-drainage-services',
  'wholesale-retail-services', 'event-services'
);

update public.service_categories
set is_essential = true,
    essential_order = case slug
      when 'ambulance-services' then 10
      when 'local-job-listings' then 20
      when 'cab-services' then 30
      when 'auto-rickshaw-services' then 40
      when 'home-nursing' then 50
      when 'elder-care-medical' then 60
      when 'hotels' then 70
      when 'restaurants' then 75
      when 'vegetarian-restaurants' then 80
      when 'non-vegetarian-restaurants' then 90
      when 'mess-tiffin-services' then 100
      when 'catering-services' then 110
      when 'citizen-service-centres' then 120
      when 'funeral-arrangements' then 130
      when 'water-can-supply' then 140
      when 'home-cleaning' then 150
      when 'plumber' then 160
      when 'electrician' then 170
      when 'car-repair' then 180
      when 'two-wheeler-repair' then 190
      else essential_order
    end,
    is_emergency = slug in ('ambulance-services', 'funeral-arrangements')
where slug in (
  'ambulance-services', 'local-job-listings', 'cab-services',
  'auto-rickshaw-services', 'home-nursing', 'elder-care-medical', 'hotels', 'restaurants',
  'vegetarian-restaurants', 'non-vegetarian-restaurants', 'mess-tiffin-services',
  'catering-services', 'citizen-service-centres', 'funeral-arrangements',
  'water-can-supply', 'home-cleaning', 'plumber', 'electrician', 'car-repair',
  'two-wheeler-repair'
);

insert into public.essential_service_shortcuts
  (category_id, subcategory_id, title, title_ta, icon, display_order, is_active, is_emergency)
select parent.id, child.id, shortcut.title, shortcut.title_ta, shortcut.icon,
       shortcut.display_order, true, shortcut.is_emergency
from (values
  ('medical-emergency-services', 'ambulance-services', 'Ambulance', 'ஆம்புலன்ஸ்', 'bi bi-truck-front', 10, true),
  ('jobs-professional-services', 'local-job-listings', 'Jobs', 'வேலைவாய்ப்புகள்', 'bi bi-briefcase', 20, false),
  ('transport-tourism-services', 'cab-services', 'Cab / Taxi', 'கேப் / டாக்ஸி', 'bi bi-taxi-front', 30, false),
  ('vehicle-services', 'auto-rickshaw-services', 'Auto Booking', 'ஆட்டோ முன்பதிவு', 'bi bi-car-front', 40, false),
  ('medical-emergency-services', 'home-nursing', 'Home Nursing', 'வீட்டு செவிலியர்', 'bi bi-heart-pulse', 50, false),
  ('food-restaurant-services', 'hotels', 'Hotels', 'தங்கும் விடுதிகள்', 'bi bi-building', 60, false),
  ('food-restaurant-services', 'restaurants', 'Restaurants', 'உணவகங்கள்', 'bi bi-cup-hot', 70, false),
  ('government-public-services', 'citizen-service-centres', 'E-Sevai', 'இ-சேவை', 'bi bi-file-earmark-text', 80, false),
  ('vehicle-services', 'two-wheeler-repair', 'Vehicle Mechanics', 'வாகன மெக்கானிக்', 'bi bi-tools', 90, false),
  ('funeral-death-related-services', 'funeral-arrangements', 'Funeral Services', 'இறுதிச் சடங்கு சேவைகள்', 'bi bi-flower1', 100, true),
  ('sanitation-drainage-services', 'water-can-supply', 'Drinking Water', 'குடிநீர் விநியோகம்', 'bi bi-droplet', 110, false),
  ('home-services', 'plumber', 'Plumbing', 'குழாய் பழுது', 'bi bi-wrench-adjustable', 120, false)
) as shortcut(parent_slug, child_slug, title, title_ta, icon, display_order, is_emergency)
join public.service_categories parent on parent.slug = shortcut.parent_slug
join public.service_categories child on child.slug = shortcut.child_slug and child.parent_id = parent.id
on conflict (category_id, subcategory_id) do update set
  title = excluded.title,
  title_ta = excluded.title_ta,
  icon = excluded.icon,
  display_order = excluded.display_order,
  is_active = excluded.is_active,
  is_emergency = excluded.is_emergency,
  updated_at = now();

-- Public-search RPC constrained to the curated set. It never expands an
-- essential root into non-essential children, unlike the all-services RPC.
create or replace function public.essential_directory_listings(
  category uuid default null,
  location uuid default null,
  keyword text default ''
) returns setof public.service_listings
language sql stable security invoker set search_path = '' as $$
  with recursive categories as (
    select id
    from public.service_categories
    where is_active and is_essential and (category is null or id = category)
    union
    select child.id
    from public.service_categories child
    join categories parent on child.parent_id = parent.id
    where child.is_active and child.is_essential
  ), places as (
    select id from public.locations where id = location and is_active
    union
    select child.id from public.locations child
    join places parent on child.parent_id = parent.id where child.is_active
  ), category_paths(listing_category_id, ancestor_category_id) as (
    select id, id from public.service_categories where is_active and is_essential
    union
    select path.listing_category_id, parent.id
    from category_paths path
    join public.service_categories current_category on current_category.id = path.ancestor_category_id
    join public.service_categories parent on parent.id = current_category.parent_id
      and parent.is_active and parent.is_essential
  )
  select listing.*
  from public.service_listings listing
  join public.service_providers provider on provider.id = listing.provider_id
  where listing.status = 'published'
    and provider.verification_status = 'verified'
    and listing.category_id in (select id from categories)
    and (location is null or exists (
      select 1 from public.listing_locations listing_location
      where listing_location.listing_id = listing.id
        and listing_location.location_id in (select id from places)
    ))
    and (coalesce(trim(keyword), '') = '' or
      strpos(lower(concat_ws(' ', listing.title, listing.description, provider.display_name, provider.description)), lower(trim(keyword))) > 0 or
      exists (
        select 1 from category_paths path
        join public.service_categories category_row on category_row.id = path.ancestor_category_id
        where path.listing_category_id = listing.category_id
          and strpos(lower(concat_ws(' ', category_row.name_en, category_row.name_ta, category_row.slug)), lower(trim(keyword))) > 0
      )
    );
$$;
revoke all on function public.essential_directory_listings(uuid, uuid, text) from public;
grant execute on function public.essential_directory_listings(uuid, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
