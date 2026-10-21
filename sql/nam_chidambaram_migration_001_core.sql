-- Nam Chidambaram - Core Supabase schema (Migration 001)
-- Scope: Foundation + Service Marketplace + Admin Moderation
-- Review in a development Supabase project before production deployment.

begin;

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. Locations
-- Flexible hierarchy: state -> district -> town -> locality.
-- ------------------------------------------------------------
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.locations(id) on delete restrict,
  location_type text not null check (
    location_type in ('country', 'state', 'district', 'town', 'locality', 'village', 'ward', 'other')
  ),
  name_ta text not null,
  name_en text,
  slug text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parent_id, slug)
);

create index if not exists ix_locations_parent on public.locations(parent_id);
create index if not exists ix_locations_type_active on public.locations(location_type, is_active);

-- ------------------------------------------------------------
-- 2. User profiles and access control
-- Supabase Auth owns credentials; never store passwords here.
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  preferred_locality_id uuid references public.locations(id) on delete set null,
  preferred_language text not null default 'ta' check (preferred_language in ('ta', 'en')),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.roles (
  code text primary key,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

insert into public.roles (code, name, description) values
  ('super_admin', 'Super Admin', 'Platform-wide administration'),
  ('district_admin', 'District Admin', 'Administration within an assigned district'),
  ('locality_coordinator', 'Locality Coordinator', 'Coordination within an assigned locality'),
  ('moderator', 'Moderator', 'Moderation of assigned content'),
  ('service_provider', 'Service Provider', 'Manage own service provider profile and listings'),
  ('resident', 'Resident', 'Standard registered user')
on conflict (code) do nothing;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_code text not null references public.roles(code) on delete restrict,
  scope_location_id uuid references public.locations(id) on delete cascade,
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, role_code, scope_location_id)
);

create index if not exists ix_user_roles_user on public.user_roles(user_id);
create index if not exists ix_user_roles_scope on public.user_roles(scope_location_id, role_code);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  notification_preferences jsonb not null default '{"in_app": true}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent_type text not null,
  version text not null,
  accepted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ix_consents_user_type on public.consents(user_id, consent_type);

-- ------------------------------------------------------------
-- 3. Shared media metadata
-- Actual files belong in Supabase Storage, not in this table.
-- ------------------------------------------------------------
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles(id) on delete set null,
  storage_path text not null unique,
  media_type text not null check (media_type in ('image', 'document', 'video', 'other')),
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  visibility text not null default 'private' check (visibility in ('public', 'private', 'restricted')),
  created_at timestamptz not null default now()
);

create index if not exists ix_media_owner on public.media_assets(owner_user_id);

-- ------------------------------------------------------------
-- 4. Service categories
-- Use parent_id for Category -> Subcategory.
-- ------------------------------------------------------------
create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.service_categories(id) on delete restrict,
  name_ta text not null,
  name_en text not null,
  slug text not null unique,
  description text,
  icon_name text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id)
);

create index if not exists ix_service_categories_parent_active
  on public.service_categories(parent_id, is_active, sort_order);

-- ------------------------------------------------------------
-- 5. Providers and service listings
-- ------------------------------------------------------------
create table if not exists public.service_providers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  provider_type text not null default 'individual'
    check (provider_type in ('individual', 'business', 'organisation')),
  display_name text not null,
  description text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'suspended')),
  public_email text,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_service_providers_owner on public.service_providers(owner_user_id);
create index if not exists ix_service_providers_verification on public.service_providers(verification_status);

create table if not exists public.service_listings (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.service_providers(id) on delete restrict,
  category_id uuid not null references public.service_categories(id) on delete restrict,
  title text not null,
  description text not null,
  price_type text not null default 'quote'
    check (price_type in ('fixed', 'starting_from', 'hourly', 'quote', 'free')),
  price_from numeric(12,2) check (price_from is null or price_from >= 0),
  currency char(3) not null default 'INR',
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'published', 'rejected', 'suspended', 'archived')),
  submitted_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_service_listings_category_status
  on public.service_listings(category_id, status);
create index if not exists ix_service_listings_provider_status
  on public.service_listings(provider_id, status);
create index if not exists ix_service_listings_created on public.service_listings(created_at desc);

create table if not exists public.listing_locations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.service_listings(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete restrict,
  coverage_type text not null default 'serves_here'
    check (coverage_type in ('based_here', 'serves_here')),
  unique (listing_id, location_id, coverage_type)
);

create index if not exists ix_listing_locations_location on public.listing_locations(location_id, listing_id);

create table if not exists public.listing_contacts (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.service_listings(id) on delete cascade,
  contact_type text not null check (contact_type in ('phone', 'whatsapp', 'email', 'website', 'other')),
  contact_value text not null,
  is_public boolean not null default true,
  sort_order integer not null default 0
);

create index if not exists ix_listing_contacts_listing on public.listing_contacts(listing_id);

create table if not exists public.listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.service_listings(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete restrict,
  sort_order integer not null default 0,
  unique (listing_id, media_asset_id)
);

create index if not exists ix_listing_media_listing on public.listing_media(listing_id, sort_order);

create table if not exists public.service_enquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.service_listings(id) on delete restrict,
  customer_user_id uuid references public.profiles(id) on delete set null,
  customer_name text,
  customer_contact text,
  message text not null,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'in_progress', 'closed', 'spam')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_service_enquiries_listing_created
  on public.service_enquiries(listing_id, created_at desc);
create index if not exists ix_service_enquiries_customer
  on public.service_enquiries(customer_user_id, created_at desc);

create table if not exists public.service_reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.service_listings(id) on delete cascade,
  reviewer_user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  review_text text,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'published', 'rejected', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, reviewer_user_id)
);

create index if not exists ix_service_reviews_listing_status
  on public.service_reviews(listing_id, status);

create table if not exists public.listing_favourites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.service_listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table if not exists public.listing_verification_history (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.service_listings(id) on delete cascade,
  reviewer_user_id uuid references public.profiles(id) on delete set null,
  decision text not null check (decision in ('approved', 'rejected', 'changes_requested', 'suspended', 'reinstated')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists ix_listing_verification_history_listing
  on public.listing_verification_history(listing_id, created_at desc);

-- ------------------------------------------------------------
-- 6. Moderation, reports, notifications and audit
-- ------------------------------------------------------------
create table if not exists public.moderation_queue (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('service_provider', 'service_listing', 'service_review', 'announcement', 'event', 'job', 'study_material')),
  entity_id uuid not null,
  submitted_by uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'in_review', 'approved', 'rejected', 'changes_requested', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_moderation_queue_status_created on public.moderation_queue(status, created_at);
create index if not exists ix_moderation_queue_assigned on public.moderation_queue(assigned_to, status);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  queue_id uuid not null references public.moderation_queue(id) on delete cascade,
  moderator_user_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('approved', 'rejected', 'changes_requested', 'assigned', 'commented', 'suspended', 'reinstated')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ix_moderation_actions_queue on public.moderation_actions(queue_id, created_at);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid references public.profiles(id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  reason_code text not null,
  description text,
  status text not null default 'open'
    check (status in ('open', 'under_review', 'action_taken', 'dismissed', 'closed')),
  assigned_to uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_reports_status_created on public.reports(status, created_at);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists ix_notifications_user_created on public.notifications(user_id, created_at desc);
create index if not exists ix_notifications_unread on public.notifications(user_id, created_at desc) where read_at is null;

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ix_audit_logs_entity on public.audit_logs(entity_type, entity_id, created_at desc);
create index if not exists ix_audit_logs_actor on public.audit_logs(actor_user_id, created_at desc);

-- ------------------------------------------------------------
-- 7. updated_at trigger
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'locations', 'profiles', 'user_preferences', 'service_categories',
    'service_providers', 'service_listings', 'service_enquiries',
    'service_reviews', 'moderation_queue', 'reports'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- 8. Security helper functions
-- SECURITY DEFINER is used to avoid RLS recursion on user_roles.
-- ------------------------------------------------------------
create or replace function public.has_role(_role_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role_code = _role_code
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_role('super_admin')
      or public.has_role('district_admin')
      or public.has_role('moderator');
$$;

revoke all on function public.has_role(text) from public;
revoke all on function public.is_admin() from public;
grant execute on function public.has_role(text) to authenticated;
grant execute on function public.is_admin() to authenticated;

-- Prevent self-verification of service providers.
-- Owners can create/update their own profile, but only admins can change
-- verification_status. The insert policy below also requires pending status.
create or replace function public.protect_provider_verification_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and new.verification_status is distinct from old.verification_status
     and not public.is_admin() then
    raise exception 'Only an administrator can change provider verification status';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_provider_verification_status on public.service_providers;
create trigger protect_provider_verification_status
before update on public.service_providers
for each row execute function public.protect_provider_verification_status();

-- ------------------------------------------------------------
-- 9. Enable RLS on all user-facing tables
-- ------------------------------------------------------------
alter table public.locations enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.consents enable row level security;
alter table public.media_assets enable row level security;
alter table public.service_categories enable row level security;
alter table public.service_providers enable row level security;
alter table public.service_listings enable row level security;
alter table public.listing_locations enable row level security;
alter table public.listing_contacts enable row level security;
alter table public.listing_media enable row level security;
alter table public.service_enquiries enable row level security;
alter table public.service_reviews enable row level security;
alter table public.listing_favourites enable row level security;
alter table public.listing_verification_history enable row level security;
alter table public.moderation_queue enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- Locations and active categories are publicly readable.
create policy "active locations are readable"
on public.locations for select to anon, authenticated
using (is_active = true or public.is_admin());

create policy "active service categories are readable"
on public.service_categories for select to anon, authenticated
using (is_active = true or public.is_admin());

-- Profiles: users read/update only their own profile; admins may read all.
create policy "read own profile or admin"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.is_admin());

create policy "insert own profile"
on public.profiles for insert to authenticated
with check (id = (select auth.uid()));

create policy "update own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()) or public.is_admin())
with check (id = (select auth.uid()) or public.is_admin());

-- Roles: authenticated users can read role definitions; only admins manage assignments.
create policy "read role definitions"
on public.roles for select to authenticated
using (true);

create policy "admin manages user roles"
on public.user_roles for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "read own user roles"
on public.user_roles for select to authenticated
using (user_id = (select auth.uid()));

create policy "manage own preferences"
on public.user_preferences for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "manage own consents"
on public.consents for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Media metadata: owner can access own; public assets are readable.
create policy "read public media or own media"
on public.media_assets for select to anon, authenticated
using (visibility = 'public' or owner_user_id = (select auth.uid()) or public.is_admin());

create policy "insert own media metadata"
on public.media_assets for insert to authenticated
with check (owner_user_id = (select auth.uid()));

create policy "update own media metadata"
on public.media_assets for update to authenticated
using (owner_user_id = (select auth.uid()) or public.is_admin())
with check (owner_user_id = (select auth.uid()) or public.is_admin());

-- Service providers: public can see verified provider profiles; owner can see their own.
create policy "read verified providers or own"
on public.service_providers for select to anon, authenticated
using (verification_status = 'verified'
       or owner_user_id = (select auth.uid())
       or public.is_admin());

create policy "create provider profile for self"
on public.service_providers for insert to authenticated
with check (
  owner_user_id = (select auth.uid())
  and (verification_status = 'pending' or public.is_admin())
);

create policy "update own provider profile or admin"
on public.service_providers for update to authenticated
using (owner_user_id = (select auth.uid()) or public.is_admin())
with check (owner_user_id = (select auth.uid()) or public.is_admin());

-- Listings: public can see published listings; owner can manage non-published listings.
create policy "read published listings or own or admin"
on public.service_listings for select to anon, authenticated
using (
  status = 'published'
  or exists (
    select 1 from public.service_providers sp
    where sp.id = provider_id and sp.owner_user_id = (select auth.uid())
  )
  or public.is_admin()
);

create policy "provider creates own draft listing"
on public.service_listings for insert to authenticated
with check (
  status in ('draft', 'pending_review')
  and exists (
    select 1 from public.service_providers sp
    where sp.id = provider_id and sp.owner_user_id = (select auth.uid())
  )
);

create policy "provider updates own non-published listing"
on public.service_listings for update to authenticated
using (
  exists (
    select 1 from public.service_providers sp
    where sp.id = provider_id and sp.owner_user_id = (select auth.uid())
  )
  or public.is_admin()
)
with check (
  public.is_admin()
  or (
    status in ('draft', 'pending_review')
    and exists (
      select 1 from public.service_providers sp
      where sp.id = provider_id and sp.owner_user_id = (select auth.uid())
    )
  )
);

create policy "admin manages service categories"
on public.service_categories for all to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Listing location, contact, media rows are readable only when the listing is public,
-- or when the current user owns the listing, or is an admin.
create policy "read listing locations with listing access"
on public.listing_locations for select to anon, authenticated
using (
  exists (
    select 1 from public.service_listings sl
    where sl.id = listing_id
      and (
        sl.status = 'published'
        or exists (select 1 from public.service_providers sp where sp.id = sl.provider_id and sp.owner_user_id = (select auth.uid()))
        or public.is_admin()
      )
  )
);

create policy "provider manages listing locations"
on public.listing_locations for all to authenticated
using (
  public.is_admin() or exists (
    select 1 from public.service_listings sl
    join public.service_providers sp on sp.id = sl.provider_id
    where sl.id = listing_id and sp.owner_user_id = (select auth.uid())
      and sl.status in ('draft', 'pending_review')
  )
)
with check (
  public.is_admin() or exists (
    select 1 from public.service_listings sl
    join public.service_providers sp on sp.id = sl.provider_id
    where sl.id = listing_id and sp.owner_user_id = (select auth.uid())
      and sl.status in ('draft', 'pending_review')
  )
);

create policy "read listing contacts with listing access"
on public.listing_contacts for select to anon, authenticated
using (
  (is_public = true and exists (select 1 from public.service_listings sl where sl.id = listing_id and sl.status = 'published'))
  or exists (
    select 1 from public.service_listings sl
    join public.service_providers sp on sp.id = sl.provider_id
    where sl.id = listing_id and sp.owner_user_id = (select auth.uid())
  )
  or public.is_admin()
);

create policy "provider manages listing contacts"
on public.listing_contacts for all to authenticated
using (
  public.is_admin() or exists (
    select 1 from public.service_listings sl
    join public.service_providers sp on sp.id = sl.provider_id
    where sl.id = listing_id and sp.owner_user_id = (select auth.uid())
      and sl.status in ('draft', 'pending_review')
  )
)
with check (
  public.is_admin() or exists (
    select 1 from public.service_listings sl
    join public.service_providers sp on sp.id = sl.provider_id
    where sl.id = listing_id and sp.owner_user_id = (select auth.uid())
      and sl.status in ('draft', 'pending_review')
  )
);

create policy "read listing media with listing access"
on public.listing_media for select to anon, authenticated
using (
  exists (
    select 1 from public.service_listings sl
    where sl.id = listing_id
      and (
        sl.status = 'published'
        or exists (select 1 from public.service_providers sp where sp.id = sl.provider_id and sp.owner_user_id = (select auth.uid()))
        or public.is_admin()
      )
  )
);

create policy "provider manages listing media"
on public.listing_media for all to authenticated
using (
  public.is_admin() or exists (
    select 1 from public.service_listings sl
    join public.service_providers sp on sp.id = sl.provider_id
    where sl.id = listing_id and sp.owner_user_id = (select auth.uid())
      and sl.status in ('draft', 'pending_review')
  )
)
with check (
  public.is_admin() or exists (
    select 1 from public.service_listings sl
    join public.service_providers sp on sp.id = sl.provider_id
    where sl.id = listing_id and sp.owner_user_id = (select auth.uid())
      and sl.status in ('draft', 'pending_review')
  )
);

-- Enquiries: customer can create/read own; provider owner can read enquiries for own listings.
create policy "customer creates enquiry"
on public.service_enquiries for insert to authenticated
with check (customer_user_id = (select auth.uid()));

create policy "customer or provider reads enquiry"
on public.service_enquiries for select to authenticated
using (
  customer_user_id = (select auth.uid())
  or public.is_admin()
  or exists (
    select 1 from public.service_listings sl
    join public.service_providers sp on sp.id = sl.provider_id
    where sl.id = listing_id and sp.owner_user_id = (select auth.uid())
  )
);

create policy "provider updates enquiry status"
on public.service_enquiries for update to authenticated
using (
  public.is_admin() or exists (
    select 1 from public.service_listings sl
    join public.service_providers sp on sp.id = sl.provider_id
    where sl.id = listing_id and sp.owner_user_id = (select auth.uid())
  )
)
with check (
  public.is_admin() or exists (
    select 1 from public.service_listings sl
    join public.service_providers sp on sp.id = sl.provider_id
    where sl.id = listing_id and sp.owner_user_id = (select auth.uid())
  )
);

-- Reviews: public sees approved reviews; users manage their own pending review.
create policy "read published reviews"
on public.service_reviews for select to anon, authenticated
using (status = 'published' or reviewer_user_id = (select auth.uid()) or public.is_admin());

create policy "create own review"
on public.service_reviews for insert to authenticated
with check (reviewer_user_id = (select auth.uid()) and status = 'pending_review');

create policy "update own pending review or admin"
on public.service_reviews for update to authenticated
using (reviewer_user_id = (select auth.uid()) or public.is_admin())
with check (
  public.is_admin()
  or (reviewer_user_id = (select auth.uid()) and status = 'pending_review')
);

create policy "manage own favourites"
on public.listing_favourites for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Verification history: provider can read own history; admins manage.
create policy "read verification history"
on public.listing_verification_history for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.service_listings sl
    join public.service_providers sp on sp.id = sl.provider_id
    where sl.id = listing_id and sp.owner_user_id = (select auth.uid())
  )
);

create policy "admin inserts verification history"
on public.listing_verification_history for insert to authenticated
with check (public.is_admin());

-- Moderation tables: admin/moderator only.
create policy "moderators read queue"
on public.moderation_queue for select to authenticated
using (public.is_admin());

create policy "authenticated can submit moderation item for self"
on public.moderation_queue for insert to authenticated
with check (submitted_by = (select auth.uid()));

create policy "moderators update queue"
on public.moderation_queue for update to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "moderators read actions"
on public.moderation_actions for select to authenticated
using (public.is_admin());

create policy "moderators create actions"
on public.moderation_actions for insert to authenticated
with check (public.is_admin() and moderator_user_id = (select auth.uid()));

-- Reports: users create/read own; admins manage all.
create policy "user creates report"
on public.reports for insert to authenticated
with check (reporter_user_id = (select auth.uid()));

create policy "read own report or admin"
on public.reports for select to authenticated
using (reporter_user_id = (select auth.uid()) or public.is_admin());

create policy "admin manages reports"
on public.reports for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Notifications: user reads and updates own notifications.
create policy "read own notifications"
on public.notifications for select to authenticated
using (user_id = (select auth.uid()));

create policy "update own notifications"
on public.notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Audit logs are readable by admins only; writes should be performed by trusted
-- server-side code or carefully scoped database triggers.
create policy "admins read audit logs"
on public.audit_logs for select to authenticated
using (public.is_admin());

-- Grant basic table privileges; RLS still determines which rows are accessible.
grant select on public.locations, public.service_categories to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.roles to authenticated;
grant select, insert, update, delete on public.user_roles to authenticated;
grant select, insert, update, delete on public.user_preferences, public.consents to authenticated;
grant select, insert, update on public.media_assets to authenticated;
grant select, insert, update on public.service_providers to authenticated;
grant select, insert, update on public.service_listings to authenticated;
grant select, insert, update, delete on public.listing_locations, public.listing_contacts, public.listing_media to authenticated;
grant select, insert, update on public.service_enquiries to authenticated;
grant select, insert, update on public.service_reviews to authenticated;
grant select, insert, delete on public.listing_favourites to authenticated;
grant select, insert on public.listing_verification_history to authenticated;
grant select, insert, update on public.moderation_queue, public.moderation_actions to authenticated;
grant select, insert, update on public.reports to authenticated;
grant select, update on public.notifications to authenticated;
grant select on public.audit_logs to authenticated;

grant select on public.service_providers, public.service_listings,
  public.listing_locations, public.listing_contacts, public.listing_media,
  public.service_reviews, public.media_assets to anon;

commit;

-- IMPORTANT FOLLOW-UP:
-- 1) Add the first super_admin through a trusted SQL editor / migration, not public signup.
-- 2) Configure Supabase Storage buckets and matching Storage RLS policies separately.
-- 3) Review column-level privileges and state-transition rules before production.
--    Provider verification is trigger-protected here; add further constraints for all admin-only fields.
-- 4) Add the remaining modules (exams, announcements, jobs, events, community help,
--    emergency facilities, subscriptions) in subsequent migrations.
