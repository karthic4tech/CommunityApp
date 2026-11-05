-- CDM 360 local marketplace. Additive tables/policies only; existing service
-- listings and their media workflow are deliberately untouched.
begin;

create table if not exists public.marketplace_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.marketplace_categories(id) on delete restrict,
  name text not null,
  name_ta text not null,
  slug text not null unique,
  description text,
  icon text,
  sort_order integer not null default 0 check (sort_order >= 0),
  attributes_schema jsonb not null default '[]'::jsonb check (jsonb_typeof(attributes_schema) = 'array'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);
create index if not exists ix_marketplace_categories_parent_active_order
  on public.marketplace_categories(parent_id, is_active, sort_order);

create table if not exists public.marketplace_settings (
  id boolean primary key default true check (id),
  allow_free_listings boolean not null default false,
  default_expiry_days integer not null default 60 check (default_expiry_days between 1 and 365),
  max_images_per_listing integer not null default 10 check (max_images_per_listing between 1 and 10),
  updated_at timestamptz not null default now()
);
insert into public.marketplace_settings(id) values (true) on conflict (id) do nothing;

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete restrict,
  category_id uuid not null references public.marketplace_categories(id) on delete restrict,
  subcategory_id uuid references public.marketplace_categories(id) on delete restrict,
  title text not null check (length(trim(title)) between 3 and 160),
  slug text not null unique,
  description text not null default '' check (length(description) <= 10000),
  price numeric(12,2) not null check (price >= 0),
  is_negotiable boolean not null default false,
  condition text not null check (condition in ('brand_new', 'like_new', 'gently_used', 'good', 'fair', 'for_parts')),
  brand text check (brand is null or length(brand) <= 100),
  model text check (model is null or length(model) <= 100),
  location_id uuid not null references public.locations(id) on delete restrict,
  seller_display_name text not null check (length(trim(seller_display_name)) between 1 and 120),
  seller_contact_phone text,
  contact_method text not null default 'enquiry' check (contact_method in ('phone', 'whatsapp', 'enquiry')),
  seller_contact_consent boolean not null default false,
  seller_terms_accepted_at timestamptz,
  seller_terms_version text,
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'published', 'rejected', 'sold', 'expired', 'suspended', 'archived')),
  rejection_reason text,
  is_featured boolean not null default false,
  published_at timestamptz,
  submitted_at timestamptz,
  expires_at timestamptz,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (subcategory_id is null or subcategory_id <> category_id),
  check ((contact_method = 'enquiry' and seller_contact_phone is null and not seller_contact_consent)
    or (contact_method in ('phone', 'whatsapp') and nullif(trim(seller_contact_phone), '') is not null and seller_contact_consent))
);
create index if not exists ix_marketplace_listings_public_recent
  on public.marketplace_listings(status, is_featured desc, published_at desc, id);
create index if not exists ix_marketplace_listings_seller_status
  on public.marketplace_listings(seller_id, status, updated_at desc);
create index if not exists ix_marketplace_listings_category_status
  on public.marketplace_listings(category_id, subcategory_id, status, published_at desc);
create index if not exists ix_marketplace_listings_location_status
  on public.marketplace_listings(location_id, status, published_at desc);
create index if not exists ix_marketplace_listings_price on public.marketplace_listings(price) where status = 'published';
create index if not exists ix_marketplace_listings_featured on public.marketplace_listings(is_featured, published_at desc) where status = 'published';
create index if not exists ix_marketplace_listings_expiry on public.marketplace_listings(expires_at) where status = 'published';

create table if not exists public.marketplace_listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  storage_path text not null unique,
  alt_text text not null default '',
  display_order integer not null default 0 check (display_order between 0 and 9),
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists ux_marketplace_listing_primary_image
  on public.marketplace_listing_images(listing_id) where is_primary;
create index if not exists ix_marketplace_listing_images_listing
  on public.marketplace_listing_images(listing_id, display_order);

create or replace function public.validate_marketplace_image()
returns trigger language plpgsql set search_path = '' as $$
declare owner_id uuid; current_status text; image_limit integer; image_count integer;
begin
  select seller_id, status into owner_id, current_status from public.marketplace_listings where id = new.listing_id for update;
  if owner_id is null then raise exception 'Marketplace listing not found'; end if;
  if new.storage_path not like owner_id::text || '/' || new.listing_id::text || '/%' then
    raise exception 'Marketplace image path must be scoped to its seller and listing';
  end if;
  if tg_op = 'INSERT' then
    if current_status not in ('draft', 'rejected') then raise exception 'Images can only be added to editable listings'; end if;
    select max_images_per_listing into image_limit from public.marketplace_settings where id = true;
    select count(*) into image_count from public.marketplace_listing_images where listing_id = new.listing_id;
    if image_count >= coalesce(image_limit, 10) then raise exception 'Marketplace image limit reached'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists validate_marketplace_image on public.marketplace_listing_images;
create trigger validate_marketplace_image before insert or update of listing_id,storage_path
on public.marketplace_listing_images for each row execute function public.validate_marketplace_image();

create table if not exists public.marketplace_listing_attributes (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  attribute_name text not null check (length(trim(attribute_name)) between 1 and 80),
  attribute_value text not null check (length(attribute_value) <= 500),
  created_at timestamptz not null default now(),
  unique (listing_id, attribute_name)
);
create index if not exists ix_marketplace_attributes_listing on public.marketplace_listing_attributes(listing_id);

create or replace function public.validate_marketplace_attribute()
returns trigger language plpgsql set search_path = '' as $$
declare root_schema jsonb; child_schema jsonb; definition jsonb; listing_row public.marketplace_listings;
begin
  select * into listing_row from public.marketplace_listings where id = new.listing_id;
  if listing_row.id is null then raise exception 'Marketplace listing not found'; end if;
  select attributes_schema into root_schema from public.marketplace_categories where id = listing_row.category_id;
  if listing_row.subcategory_id is not null then
    select attributes_schema into child_schema from public.marketplace_categories where id = listing_row.subcategory_id;
  end if;
  select schema_item.value into definition
  from jsonb_array_elements(coalesce(root_schema, '[]'::jsonb) || coalesce(child_schema, '[]'::jsonb)) as schema_item(value)
  where schema_item.value->>'key' = new.attribute_name limit 1;
  if definition is null then raise exception 'This product field is not defined for the selected category'; end if;
  if definition->>'type' = 'number' and new.attribute_value !~ '^-?[0-9]+([.][0-9]+)?$' then
    raise exception 'This category field must be a number';
  end if;
  if definition->>'type' = 'select' and jsonb_typeof(definition->'options') = 'array'
    and not (definition->'options' @> to_jsonb(array[new.attribute_value])) then
    raise exception 'Choose an allowed option for this category field';
  end if;
  return new;
end;
$$;
drop trigger if exists validate_marketplace_attribute on public.marketplace_listing_attributes;
create trigger validate_marketplace_attribute before insert or update on public.marketplace_listing_attributes
for each row execute function public.validate_marketplace_attribute();

create table if not exists public.marketplace_favourites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, listing_id)
);
create index if not exists ix_marketplace_favourites_user on public.marketplace_favourites(user_id, created_at desc);

create table if not exists public.marketplace_enquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (length(trim(message)) between 1 and 2000),
  status text not null default 'new' check (status in ('new', 'contacted', 'negotiating', 'closed', 'spam')),
  seller_response text check (seller_response is null or length(seller_response) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, buyer_id)
);
create index if not exists ix_marketplace_enquiries_buyer on public.marketplace_enquiries(buyer_id, created_at desc);
create index if not exists ix_marketplace_enquiries_seller on public.marketplace_enquiries(seller_id, status, created_at desc);
create index if not exists ix_marketplace_enquiries_listing on public.marketplace_enquiries(listing_id, created_at desc);

create table if not exists public.marketplace_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.marketplace_listings(id) on delete cascade,
  reporter_id uuid references public.profiles(id) on delete set null,
  reason text not null check (reason in ('prohibited_item', 'scam_or_suspicious', 'misleading', 'duplicate', 'wrong_category', 'other')),
  description text check (description is null or length(description) <= 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'action_taken', 'dismissed')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ix_marketplace_reports_status on public.marketplace_reports(status, created_at desc);
create index if not exists ix_marketplace_reports_listing on public.marketplace_reports(listing_id, created_at desc);
create unique index if not exists ux_marketplace_reporter_listing
  on public.marketplace_reports(listing_id, reporter_id) where reporter_id is not null;

create table if not exists public.marketplace_moderation_logs (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.marketplace_listings(id) on delete set null,
  report_id uuid references public.marketplace_reports(id) on delete set null,
  admin_id uuid not null references public.profiles(id) on delete restrict,
  action text not null,
  remarks text,
  created_at timestamptz not null default now()
);
create index if not exists ix_marketplace_moderation_logs_listing on public.marketplace_moderation_logs(listing_id, created_at desc);

-- Stable listing slugs are generated in the database, never trusted from the browser.
create or replace function public.set_marketplace_listing_slug()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := coalesce(nullif(trim(both '-' from regexp_replace(lower(new.title), '[^a-z0-9]+', '-', 'g')), ''), 'item') || '-' || left(new.id::text, 8);
  end if;
  return new;
end;
$$;
drop trigger if exists set_marketplace_listing_slug on public.marketplace_listings;
create trigger set_marketplace_listing_slug before insert on public.marketplace_listings
for each row execute function public.set_marketplace_listing_slug();

create or replace function public.validate_marketplace_listing_category()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.marketplace_categories root
    where root.id = new.category_id and root.is_active and root.parent_id is null
  ) then raise exception 'Choose an active marketplace category'; end if;
  if new.subcategory_id is not null and not exists (
    select 1 from public.marketplace_categories child
    where child.id = new.subcategory_id and child.parent_id = new.category_id and child.is_active
  ) then raise exception 'The selected subcategory does not belong to this category'; end if;
  if new.price = 0 and not (select allow_free_listings from public.marketplace_settings where id = true) then
    raise exception 'Free listings are currently disabled';
  end if;
  return new;
end;
$$;
drop trigger if exists validate_marketplace_listing_category on public.marketplace_listings;
create trigger validate_marketplace_listing_category before insert or update of category_id, subcategory_id, price
on public.marketplace_listings for each row execute function public.validate_marketplace_listing_category();

create or replace function public.protect_marketplace_listing_workflow()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() then
    if tg_op = 'INSERT' then
      if new.seller_id is distinct from (select auth.uid()) then raise exception 'Seller must be the current user' using errcode = '42501'; end if;
      new.status := 'draft'; new.is_featured := false; new.published_at := null; new.rejection_reason := null;
      new.seller_terms_accepted_at := null; new.seller_terms_version := null;
    else
      if new.id is distinct from old.id
         or new.slug is distinct from old.slug
         or new.created_at is distinct from old.created_at
         or new.submitted_at is distinct from old.submitted_at
         or new.seller_id is distinct from old.seller_id
         or new.status is distinct from old.status
         or new.is_featured is distinct from old.is_featured
         or new.published_at is distinct from old.published_at
         or new.rejection_reason is distinct from old.rejection_reason
         or new.seller_terms_accepted_at is distinct from old.seller_terms_accepted_at
         or new.seller_terms_version is distinct from old.seller_terms_version
         or new.expires_at is distinct from old.expires_at
         or new.sold_at is distinct from old.sold_at then
        raise exception 'Listing workflow fields are controlled by trusted marketplace operations' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_marketplace_listing_workflow on public.marketplace_listings;
create trigger protect_marketplace_listing_workflow before insert or update on public.marketplace_listings
for each row execute function public.protect_marketplace_listing_workflow();

drop trigger if exists set_updated_at on public.marketplace_categories;
create trigger set_updated_at before update on public.marketplace_categories for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.marketplace_listings;
create trigger set_updated_at before update on public.marketplace_listings for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.marketplace_enquiries;
create trigger set_updated_at before update on public.marketplace_enquiries for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at on public.marketplace_settings;
create trigger set_updated_at before update on public.marketplace_settings for each row execute function public.set_updated_at();

-- Parent/subcategory integrity for marketplace categories.
create or replace function public.validate_marketplace_subcategory_parent()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.parent_id is not null and not exists (
    select 1 from public.marketplace_categories parent where parent.id = new.parent_id and parent.parent_id is null
  ) then raise exception 'Marketplace subcategories must belong directly to a root category'; end if;
  return new;
end;
$$;
drop trigger if exists validate_marketplace_subcategory_parent on public.marketplace_categories;
create trigger validate_marketplace_subcategory_parent before insert or update of parent_id
on public.marketplace_categories for each row execute function public.validate_marketplace_subcategory_parent();

-- RLS
alter table public.marketplace_categories enable row level security;
alter table public.marketplace_settings enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.marketplace_listing_images enable row level security;
alter table public.marketplace_listing_attributes enable row level security;
alter table public.marketplace_favourites enable row level security;
alter table public.marketplace_enquiries enable row level security;
alter table public.marketplace_reports enable row level security;
alter table public.marketplace_moderation_logs enable row level security;

create policy "marketplace active categories are public" on public.marketplace_categories
  for select to anon using (is_active);
create policy "marketplace categories readable to authenticated" on public.marketplace_categories
  for select to authenticated using (is_active or public.is_admin());
create policy "marketplace admins manage categories" on public.marketplace_categories
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "marketplace settings are public" on public.marketplace_settings
  for select to anon, authenticated using (true);
create policy "marketplace admins manage settings" on public.marketplace_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "public sees published marketplace listings" on public.marketplace_listings
  for select to anon using (status = 'published' and (expires_at is null or expires_at > now()));
create policy "buyers see published marketplace listings" on public.marketplace_listings
  for select to authenticated using (status = 'published' and (expires_at is null or expires_at > now()));
create policy "sellers see their marketplace listings" on public.marketplace_listings
  for select to authenticated using (seller_id = (select auth.uid()));
create policy "admins see all marketplace listings" on public.marketplace_listings
  for select to authenticated using (public.is_admin());
create policy "sellers create marketplace drafts" on public.marketplace_listings
  for insert to authenticated with check (seller_id = (select auth.uid()) and status = 'draft' and not is_featured);
create policy "sellers edit their marketplace drafts" on public.marketplace_listings
  for update to authenticated using (seller_id = (select auth.uid()) and status in ('draft', 'rejected'))
  with check (seller_id = (select auth.uid()) and status in ('draft', 'rejected'));
create policy "admins manage marketplace listings" on public.marketplace_listings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "published marketplace images are public" on public.marketplace_listing_images
  for select to anon using (exists (select 1 from public.marketplace_listings listing
    where listing.id = listing_id and listing.status = 'published' and (listing.expires_at is null or listing.expires_at > now())));
create policy "marketplace users read associated images" on public.marketplace_listing_images
  for select to authenticated using (exists (select 1 from public.marketplace_listings listing
    where listing.id = listing_id and (listing.seller_id = (select auth.uid()) or listing.status = 'published' or public.is_admin())));
create policy "sellers manage draft marketplace images" on public.marketplace_listing_images
  for all to authenticated using (exists (select 1 from public.marketplace_listings listing
    where listing.id = listing_id and listing.seller_id = (select auth.uid()) and listing.status in ('draft', 'rejected')))
  with check (exists (select 1 from public.marketplace_listings listing
    where listing.id = listing_id and listing.seller_id = (select auth.uid()) and listing.status in ('draft', 'rejected')
      and storage_path like listing.seller_id::text || '/' || listing.id::text || '/%'));
create policy "admins manage marketplace images" on public.marketplace_listing_images
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "published marketplace attributes are public" on public.marketplace_listing_attributes
  for select to anon using (exists (select 1 from public.marketplace_listings listing
    where listing.id = listing_id and listing.status = 'published' and (listing.expires_at is null or listing.expires_at > now())));
create policy "marketplace users read attributes" on public.marketplace_listing_attributes
  for select to authenticated using (exists (select 1 from public.marketplace_listings listing
    where listing.id = listing_id and (listing.seller_id = (select auth.uid()) or listing.status = 'published' or public.is_admin())));
create policy "sellers manage draft attributes" on public.marketplace_listing_attributes
  for all to authenticated using (exists (select 1 from public.marketplace_listings listing
    where listing.id = listing_id and listing.seller_id = (select auth.uid()) and listing.status in ('draft', 'rejected')))
  with check (exists (select 1 from public.marketplace_listings listing
    where listing.id = listing_id and listing.seller_id = (select auth.uid()) and listing.status in ('draft', 'rejected')));
create policy "admins manage marketplace attributes" on public.marketplace_listing_attributes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "users read own marketplace favourites" on public.marketplace_favourites
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users add own published marketplace favourites" on public.marketplace_favourites
  for insert to authenticated with check (user_id = (select auth.uid()) and exists (
    select 1 from public.marketplace_listings listing where listing.id = listing_id
      and listing.status = 'published' and (listing.expires_at is null or listing.expires_at > now())
  ));
create policy "users remove own marketplace favourites" on public.marketplace_favourites
  for delete to authenticated using (user_id = (select auth.uid()));
create policy "buyers and sellers read marketplace enquiries" on public.marketplace_enquiries
  for select to authenticated using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()) or public.is_admin());
create policy "buyers create marketplace enquiries" on public.marketplace_enquiries
  for insert to authenticated with check (
    buyer_id = (select auth.uid()) and buyer_id <> seller_id
    and exists (select 1 from public.marketplace_listings listing
      where listing.id = listing_id and listing.seller_id = seller_id and listing.status = 'published'
        and (listing.expires_at is null or listing.expires_at > now()))
  );
create policy "marketplace admins manage enquiries" on public.marketplace_enquiries
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "users create marketplace reports" on public.marketplace_reports
  for insert to authenticated with check (reporter_id = (select auth.uid()) and exists (
    select 1 from public.marketplace_listings listing where listing.id = listing_id
      and listing.seller_id <> (select auth.uid()) and listing.status = 'published'
  ));
create policy "users read own marketplace reports" on public.marketplace_reports
  for select to authenticated using (reporter_id = (select auth.uid()) or public.is_admin());
create policy "marketplace admins manage reports" on public.marketplace_reports
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "marketplace admins read moderation logs" on public.marketplace_moderation_logs
  for select to authenticated using (public.is_admin());
create policy "marketplace admins add moderation logs" on public.marketplace_moderation_logs
  for insert to authenticated with check (public.is_admin() and admin_id = (select auth.uid()));

grant select on public.marketplace_categories, public.marketplace_settings to anon, authenticated;
grant insert, update, delete on public.marketplace_categories, public.marketplace_settings to authenticated;
grant select, insert, update, delete on public.marketplace_listings to authenticated;
grant select, insert, update, delete on public.marketplace_listing_images, public.marketplace_listing_attributes to authenticated;
grant select, insert, delete on public.marketplace_favourites to authenticated;
grant select, insert, update on public.marketplace_enquiries to authenticated;
grant select, insert, update on public.marketplace_reports to authenticated;
grant select, insert on public.marketplace_moderation_logs to authenticated;
grant select on public.marketplace_listings, public.marketplace_listing_images, public.marketplace_listing_attributes to anon;

-- Trusted workflow functions. SECURITY DEFINER bypasses table grants, but each
-- operation checks auth.uid()/is_admin() and retains fixed search_path.
create or replace function public.submit_marketplace_listing(_listing_id uuid, _accept_rules boolean)
returns public.marketplace_listings
language plpgsql security definer set search_path = '' as $$
declare result public.marketplace_listings;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not coalesce(_accept_rules, false) then raise exception 'Confirm the marketplace prohibited-items and safety rules before submission'; end if;
  if not exists (select 1 from public.marketplace_listings listing
    where listing.id = _listing_id and listing.seller_id = (select auth.uid())
      and listing.status in ('draft', 'rejected')) then
    raise exception 'Listing is not editable by this seller' using errcode = '42501';
  end if;
  if not exists (select 1 from public.marketplace_listing_images image where image.listing_id = _listing_id) then
    raise exception 'Add at least one product image before submission';
  end if;
  update public.marketplace_listings set status = 'pending_approval', submitted_at = now(), rejection_reason = null,
    seller_terms_accepted_at = now(), seller_terms_version = '2026-11-06'
  where id = _listing_id returning * into result;
  return result;
end;
$$;
create or replace function public.mark_marketplace_listing_sold(_listing_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.marketplace_listings set status = 'sold', sold_at = now()
  where id = _listing_id and seller_id = (select auth.uid()) and status = 'published'
    and (expires_at is null or expires_at > now());
  if not found then raise exception 'Published listing not found or not owned by current user' using errcode = '42501'; end if;
end;
$$;
create or replace function public.renew_marketplace_listing(_listing_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.marketplace_listing_images where listing_id = _listing_id) then
    raise exception 'Add at least one product image before renewing';
  end if;
  update public.marketplace_listings set status = 'pending_approval', submitted_at = now(), sold_at = null
  where id = _listing_id and seller_id = (select auth.uid())
    and (status = 'expired' or (status = 'published' and expires_at is not null and expires_at <= now()));
  if not found then raise exception 'Only your expired listing can be renewed' using errcode = '42501'; end if;
end;
$$;
create or replace function public.archive_marketplace_listing(_listing_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.marketplace_listings set status = 'archived'
  where id = _listing_id and seller_id = (select auth.uid())
    and (status in ('draft', 'rejected', 'sold', 'expired') or (status = 'published' and expires_at is not null and expires_at <= now()));
  if not found then raise exception 'Listing cannot be archived by current user' using errcode = '42501'; end if;
end;
$$;
create or replace function public.respond_to_marketplace_enquiry(_enquiry_id uuid, _response text, _status text default 'contacted')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if _status not in ('contacted', 'negotiating', 'closed', 'spam') then raise exception 'Invalid enquiry status'; end if;
  update public.marketplace_enquiries set seller_response = left(trim(_response), 2000), status = _status
  where id = _enquiry_id and seller_id = (select auth.uid());
  if not found then raise exception 'Enquiry not found for current seller' using errcode = '42501'; end if;
end;
$$;
create or replace function public.admin_moderate_marketplace_listing(
  _listing_id uuid, _decision text, _remarks text default null, _feature boolean default null
) returns public.marketplace_listings
language plpgsql security definer set search_path = '' as $$
declare result public.marketplace_listings;
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if _decision not in ('approve', 'reject', 'suspend', 'restore') then raise exception 'Invalid moderation action'; end if;
  if _decision = 'approve' and not exists (
    select 1 from public.marketplace_listings where id = _listing_id and seller_terms_accepted_at is not null
  ) then raise exception 'Seller must accept the marketplace prohibited-items and safety rules'; end if;
  update public.marketplace_listings set
    status = case _decision when 'approve' then 'published' when 'reject' then 'rejected' when 'suspend' then 'suspended' when 'restore' then 'published' end,
    published_at = case when _decision in ('approve', 'restore') then coalesce(published_at, now()) else published_at end,
    rejection_reason = case when _decision = 'reject' then left(trim(coalesce(_remarks, '')), 2000) else null end,
    is_featured = coalesce(_feature, is_featured),
    expires_at = case when _decision = 'approve' then now() + make_interval(days => (select default_expiry_days from public.marketplace_settings where id = true)) else expires_at end
  where id = _listing_id returning * into result;
  if not found then raise exception 'Marketplace listing not found'; end if;
  insert into public.marketplace_moderation_logs(listing_id, admin_id, action, remarks)
  values (_listing_id, (select auth.uid()), _decision, nullif(trim(_remarks), ''));
  return result;
end;
$$;
create or replace function public.admin_resolve_marketplace_report(
  _report_id uuid, _status text, _remarks text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare report_listing uuid;
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if _status not in ('reviewing', 'action_taken', 'dismissed') then raise exception 'Invalid report status'; end if;
  update public.marketplace_reports set status = _status, reviewed_by = (select auth.uid()), reviewed_at = now()
  where id = _report_id returning listing_id into report_listing;
  if not found then raise exception 'Marketplace report not found'; end if;
  insert into public.marketplace_moderation_logs(listing_id, report_id, admin_id, action, remarks)
  values (report_listing, _report_id, (select auth.uid()), 'report_' || _status, nullif(trim(_remarks), ''));
end;
$$;
revoke all on function public.submit_marketplace_listing(uuid, boolean) from public;
revoke all on function public.mark_marketplace_listing_sold(uuid) from public;
revoke all on function public.renew_marketplace_listing(uuid) from public;
revoke all on function public.archive_marketplace_listing(uuid) from public;
revoke all on function public.respond_to_marketplace_enquiry(uuid, text, text) from public;
revoke all on function public.admin_moderate_marketplace_listing(uuid, text, text, boolean) from public;
revoke all on function public.admin_resolve_marketplace_report(uuid, text, text) from public;
grant execute on function public.submit_marketplace_listing(uuid, boolean), public.mark_marketplace_listing_sold(uuid), public.renew_marketplace_listing(uuid), public.archive_marketplace_listing(uuid), public.respond_to_marketplace_enquiry(uuid, text, text) to authenticated;
grant execute on function public.admin_moderate_marketplace_listing(uuid, text, text, boolean) to authenticated;
grant execute on function public.admin_resolve_marketplace_report(uuid, text, text) to authenticated;

-- Private object bucket: published item images are served through signed URLs.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('cdm360-marketplace-images', 'cdm360-marketplace-images', false, 5242880,
  array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "marketplace image upload by listing owner" on storage.objects;
create policy "marketplace image upload by listing owner" on storage.objects for insert to authenticated
with check (bucket_id = 'cdm360-marketplace-images'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and exists (select 1 from public.marketplace_listings listing
    where listing.id::text = split_part(name, '/', 2)
      and listing.seller_id = (select auth.uid()) and listing.status in ('draft', 'rejected')));
drop policy if exists "published marketplace images readable" on storage.objects;
create policy "published marketplace images readable" on storage.objects for select to anon, authenticated
using (bucket_id = 'cdm360-marketplace-images' and exists (
  select 1 from public.marketplace_listing_images image
  join public.marketplace_listings listing on listing.id = image.listing_id
  where image.storage_path = name and listing.status = 'published'
    and (listing.expires_at is null or listing.expires_at > now())
));
drop policy if exists "owner reads marketplace images" on storage.objects;
create policy "owner reads marketplace images" on storage.objects for select to authenticated
using (bucket_id = 'cdm360-marketplace-images'
  and split_part(name, '/', 1) = (select auth.uid())::text);
drop policy if exists "owner deletes draft marketplace images" on storage.objects;
create policy "owner deletes draft marketplace images" on storage.objects for delete to authenticated
using (bucket_id = 'cdm360-marketplace-images'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and exists (select 1 from public.marketplace_listings listing
    where listing.id::text = split_part(name, '/', 2)
      and listing.seller_id = (select auth.uid()) and listing.status in ('draft', 'rejected')));
drop policy if exists "admins manage marketplace storage" on storage.objects;
create policy "admins manage marketplace storage" on storage.objects for all to authenticated
using (bucket_id = 'cdm360-marketplace-images' and public.is_admin())
with check (bucket_id = 'cdm360-marketplace-images' and public.is_admin());

-- Initial marketplace category catalogue. Names/icons are database-managed and
-- can be changed through the admin module without changing Angular code.
insert into public.marketplace_categories(parent_id,name,name_ta,slug,description,icon,sort_order,attributes_schema,is_active)
values
  (null,'Mobiles & Tablets','மொபைல்கள் மற்றும் டேப்லெட்கள்','mobiles-tablets','Phones, tablets and accessories','bi bi-phone',10,'[{"key":"brand","label":"Brand","label_ta":"பிராண்ட்","type":"text"},{"key":"model","label":"Model","label_ta":"மாடல்","type":"text"},{"key":"purchase_year","label":"Purchase year","label_ta":"வாங்கிய ஆண்டு","type":"number"},{"key":"warranty","label":"Warranty status","label_ta":"உத்தரவாதம்","type":"text"},{"key":"accessories","label":"Accessories included","label_ta":"சேர்க்கப்பட்ட உபகரணங்கள்","type":"text"}]'::jsonb,true),
  (null,'Electronics & Appliances','மின்னணுவியல் மற்றும் வீட்டு உபயோகப் பொருட்கள்','electronics-appliances','Electronics and home appliances','bi bi-tv',20,'[{"key":"brand","label":"Brand","label_ta":"பிராண்ட்","type":"text"},{"key":"model","label":"Model","label_ta":"மாடல்","type":"text"},{"key":"purchase_year","label":"Purchase year","label_ta":"வாங்கிய ஆண்டு","type":"number"},{"key":"warranty","label":"Warranty","label_ta":"உத்தரவாதம்","type":"text"}]'::jsonb,true),
  (null,'Cars','கார்கள்','cars','Cars listed by local sellers','bi bi-car-front',30,'[{"key":"brand","label":"Brand","label_ta":"பிராண்ட்","type":"text","required":true},{"key":"model","label":"Model","label_ta":"மாடல்","type":"text","required":true},{"key":"manufacturing_year","label":"Manufacturing year","label_ta":"உற்பத்தி ஆண்டு","type":"number"},{"key":"kilometres_driven","label":"Kilometres driven","label_ta":"ஓடிய கிலோமீட்டர்","type":"number"},{"key":"fuel_type","label":"Fuel type","label_ta":"எரிபொருள் வகை","type":"select","options":["Petrol","Diesel","Electric","Hybrid","CNG"]},{"key":"transmission","label":"Transmission","label_ta":"கியர் வகை","type":"select","options":["Manual","Automatic"]},{"key":"ownership_count","label":"Ownership count","label_ta":"உரிமையாளர் எண்ணிக்கை","type":"number"}]'::jsonb,true),
  (null,'Bikes & Scooters','பைக்குகள் மற்றும் ஸ்கூட்டர்கள்','bikes-scooters','Motorcycles, scooters, e-bikes and bicycles','bi bi-bicycle',40,'[{"key":"brand","label":"Brand","label_ta":"பிராண்ட்","type":"text"},{"key":"model","label":"Model","label_ta":"மாடல்","type":"text"},{"key":"manufacturing_year","label":"Manufacturing year","label_ta":"உற்பத்தி ஆண்டு","type":"number"},{"key":"kilometres_driven","label":"Kilometres driven","label_ta":"ஓடிய கிலோமீட்டர்","type":"number"},{"key":"fuel_type","label":"Fuel type","label_ta":"எரிபொருள் வகை","type":"select","options":["Petrol","Electric"]},{"key":"ownership_count","label":"Ownership count","label_ta":"உரிமையாளர் எண்ணிக்கை","type":"number"}]'::jsonb,true),
  (null,'Home & Furniture','வீடு மற்றும் மரச்சாமான்கள்','home-furniture','Furniture, decor and household goods','bi bi-house-heart',50,'[{"key":"material","label":"Material","label_ta":"பொருள்","type":"text"},{"key":"dimensions","label":"Dimensions","label_ta":"அளவுகள்","type":"text"},{"key":"age","label":"Age","label_ta":"வயது","type":"text"}]'::jsonb,true),
  (null,'Fashion & Accessories','ஆடை மற்றும் அணிகலன்கள்','fashion-accessories','Clothing, footwear, bags and accessories','bi bi-handbag',60,'[]'::jsonb,true),
  (null,'Property','சொத்து','property','Property for sale or rent','bi bi-buildings',70,'[{"key":"property_type","label":"Property type","label_ta":"சொத்து வகை","type":"text"},{"key":"area","label":"Area","label_ta":"பரப்பளவு","type":"number"},{"key":"area_unit","label":"Area unit","label_ta":"அளவு அலகு","type":"text"},{"key":"bedrooms","label":"Bedrooms","label_ta":"படுக்கையறைகள்","type":"number"},{"key":"ownership_type","label":"Ownership type","label_ta":"உரிமை வகை","type":"text"}]'::jsonb,true),
  (null,'Books & Education','புத்தகங்கள் மற்றும் கல்வி','books-education','Books, study material and educational equipment','bi bi-book',80,'[]'::jsonb,true),
  (null,'Sports & Fitness','விளையாட்டு மற்றும் உடற்பயிற்சி','sports-fitness','Sports and fitness equipment','bi bi-activity',90,'[]'::jsonb,true),
  (null,'Kids & Baby Products','குழந்தைகள் மற்றும் குழந்தைப் பொருட்கள்','kids-baby','Toys, strollers and baby furniture','bi bi-balloon',100,'[]'::jsonb,true),
  (null,'Agriculture & Farming','விவசாயம் மற்றும் பண்ணை','agriculture-farming','Farm tools, machinery and irrigation','bi bi-flower1',110,'[]'::jsonb,true),
  (null,'Tools & Machinery','கருவிகள் மற்றும் இயந்திரங்கள்','tools-machinery','Construction, workshop and industrial tools','bi bi-tools',120,'[]'::jsonb,true),
  (null,'Business Equipment','வணிக உபகரணங்கள்','business-equipment','Office, shop and commercial equipment','bi bi-pc-display',130,'[]'::jsonb,true),
  (null,'Musical Instruments','இசைக்கருவிகள்','musical-instruments','Instruments and audio equipment','bi bi-music-note-beamed',140,'[]'::jsonb,true),
  (null,'Pets & Pet Supplies','செல்லப்பிராணிகள் மற்றும் பொருட்கள்','pets-pet-supplies','Pet supplies and equipment','bi bi-heart',150,'[]'::jsonb,true),
  (null,'Others','மற்றவை','others','Other items for sale','bi bi-three-dots',160,'[]'::jsonb,true)
on conflict (slug) do update set name = excluded.name, name_ta = excluded.name_ta,
  description = excluded.description, icon = excluded.icon, sort_order = excluded.sort_order,
  attributes_schema = excluded.attributes_schema, is_active = excluded.is_active, updated_at = now();

with seed(parent_slug,name,name_ta,slug,sort_order) as (values
  ('mobiles-tablets','Android Phones','ஆண்ட்ராய்டு போன்கள்','android-phones',10),('mobiles-tablets','iPhones','ஐபோன்கள்','iphones',20),('mobiles-tablets','Tablets','டேப்லெட்கள்','tablets',30),('mobiles-tablets','Mobile Accessories','மொபைல் உபகரணங்கள்','mobile-accessories',40),
  ('electronics-appliances','TVs','தொலைக்காட்சிகள்','tvs',10),('electronics-appliances','Refrigerators','குளிர்சாதனப் பெட்டிகள்','refrigerators',20),('electronics-appliances','Washing Machines','சலவை இயந்திரங்கள்','washing-machines',30),('electronics-appliances','Air Conditioners','குளிரூட்டிகள்','air-conditioners',40),('electronics-appliances','Computers & Laptops','கணினிகள் மற்றும் மடிக்கணினிகள்','computers-laptops',50),('electronics-appliances','Cameras','கேமராக்கள்','cameras',60),('electronics-appliances','Kitchen Appliances','சமையலறை உபகரணங்கள்','kitchen-appliances',70),('electronics-appliances','Other Electronics','மற்ற மின்னணுவியல்','other-electronics',80),
  ('cars','Hatchbacks','ஹேட்ச்பேக் கார்கள்','hatchbacks',10),('cars','Sedans','செடான் கார்கள்','sedans',20),('cars','SUVs','எஸ்யூவிகள்','suvs',30),('cars','Other Cars','மற்ற கார்கள்','other-cars',40),
  ('bikes-scooters','Motorcycles','மோட்டார் சைக்கிள்கள்','motorcycles',10),('bikes-scooters','Scooters','ஸ்கூட்டர்கள்','scooters',20),('bikes-scooters','Electric Bikes','மின்சார பைக்குகள்','electric-bikes',30),('bikes-scooters','Bicycles','மிதிவண்டிகள்','bicycles',40),
  ('home-furniture','Sofas','சோபாக்கள்','sofas',10),('home-furniture','Beds','படுக்கைகள்','beds',20),('home-furniture','Wardrobes','அலமாரிகள்','wardrobes',30),('home-furniture','Tables & Chairs','மேசைகள் மற்றும் நாற்காலிகள்','tables-chairs',40),('home-furniture','Kitchen Furniture','சமையலறை மரச்சாமான்கள்','kitchen-furniture',50),('home-furniture','Home Decor','வீட்டு அலங்காரம்','home-decor',60),('home-furniture','Household Items','வீட்டுப் பொருட்கள்','household-items',70),
  ('fashion-accessories','Men''s Clothing','ஆண்கள் ஆடை','mens-clothing',10),('fashion-accessories','Women''s Clothing','பெண்கள் ஆடை','womens-clothing',20),('fashion-accessories','Children''s Clothing','குழந்தைகள் ஆடை','childrens-clothing',30),('fashion-accessories','Watches','கைக்கடிகாரங்கள்','watches',40),('fashion-accessories','Bags','பைகள்','bags',50),('fashion-accessories','Footwear','காலணிகள்','footwear',60),('fashion-accessories','Jewellery','நகைகள்','jewellery',70),
  ('property','Houses for Sale','விற்பனை வீடுகள்','houses-for-sale',10),('property','Flats for Sale','விற்பனை குடியிருப்புகள்','flats-for-sale',20),('property','Rental Properties','வாடகை சொத்துகள்','rental-properties',30),('property','Commercial Properties','வணிக சொத்துகள்','commercial-properties',40),('property','Land & Plots','நிலம் மற்றும் மனைகள்','land-plots',50),
  ('books-education','School Books','பள்ளிப் புத்தகங்கள்','school-books',10),('books-education','College Books','கல்லூரிப் புத்தகங்கள்','college-books',20),('books-education','Competitive Exam Books','போட்டித் தேர்வு புத்தகங்கள்','competitive-exam-books',30),('books-education','Study Materials','படிப்புப் பொருட்கள்','study-materials',40),('books-education','Educational Equipment','கல்வி உபகரணங்கள்','educational-equipment',50),
  ('sports-fitness','Fitness Equipment','உடற்பயிற்சி உபகரணங்கள்','fitness-equipment',10),('sports-fitness','Sports Equipment','விளையாட்டு உபகரணங்கள்','sports-equipment',20),('sports-fitness','Gym Accessories','ஜிம் உபகரணங்கள்','gym-accessories',30),
  ('kids-baby','Baby Furniture','குழந்தை மரச்சாமான்கள்','baby-furniture',10),('kids-baby','Toys','விளையாட்டுப் பொருட்கள்','toys',20),('kids-baby','Strollers','குழந்தை தள்ளுவண்டிகள்','strollers',30),('kids-baby','Children''s Products','குழந்தைப் பொருட்கள்','childrens-products',40),
  ('agriculture-farming','Farm Equipment','பண்ணை உபகரணங்கள்','farm-equipment',10),('agriculture-farming','Agricultural Machinery','விவசாய இயந்திரங்கள்','agricultural-machinery',20),('agriculture-farming','Irrigation Equipment','பாசன உபகரணங்கள்','irrigation-equipment',30),('agriculture-farming','Farming Tools','விவசாயக் கருவிகள்','farming-tools',40),
  ('tools-machinery','Construction Equipment','கட்டுமான உபகரணங்கள்','construction-equipment',10),('tools-machinery','Workshop Tools','பட்டறைக் கருவிகள்','workshop-tools',20),('tools-machinery','Industrial Machinery','தொழிற்துறை இயந்திரங்கள்','industrial-machinery',30),('tools-machinery','Electrical Tools','மின்சாரக் கருவிகள்','electrical-tools',40),
  ('business-equipment','Office Furniture','அலுவலக மரச்சாமான்கள்','office-furniture',10),('business-equipment','Computers','கணினிகள்','business-computers',20),('business-equipment','Commercial Equipment','வணிக உபகரணங்கள்','commercial-equipment',30),('business-equipment','Shop Equipment','கடை உபகரணங்கள்','shop-equipment',40),
  ('musical-instruments','Keyboards','கீபோர்டுகள்','keyboards',10),('musical-instruments','Guitars','கிட்டார்கள்','guitars',20),('musical-instruments','Drums','டிரம்ஸ்','drums',30),('musical-instruments','Other Instruments','மற்ற இசைக்கருவிகள்','other-instruments',40),
  ('pets-pet-supplies','Pet Accessories','செல்லப்பிராணி உபகரணங்கள்','pet-accessories',10),('pets-pet-supplies','Pet Food','செல்லப்பிராணி உணவு','pet-food',20),('pets-pet-supplies','Pet Equipment','செல்லப்பிராணி சாதனங்கள்','pet-equipment',30),
  ('others','Miscellaneous Items','இதர பொருட்கள்','miscellaneous-items',10)
)
insert into public.marketplace_categories(parent_id,name,name_ta,slug,sort_order,is_active)
select parent.id, seed.name, seed.name_ta, seed.slug, seed.sort_order, true
from seed join public.marketplace_categories parent on parent.slug = seed.parent_slug
on conflict (slug) do update set parent_id = excluded.parent_id, name = excluded.name,
  name_ta = excluded.name_ta, sort_order = excluded.sort_order, is_active = excluded.is_active, updated_at = now();

notify pgrst, 'reload schema';
commit;
