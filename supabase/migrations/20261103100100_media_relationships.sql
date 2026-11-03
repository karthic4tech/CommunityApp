-- Media module 2/6: relationships and cleanup queue.
-- Reuses public.listing_media (listings) and profiles.avatar_path (profiles).
-- Adds public.provider_media (businesses/providers) with real foreign keys.
-- Events, announcements, categories and banners have no tables yet, so no
-- relationship tables are created for them (add one per entity when they exist).
begin;

alter table public.listing_media
  add column if not exists is_primary boolean not null default false;

with first_media as (
  select distinct on (listing_id) id from public.listing_media order by listing_id, sort_order, id
)
update public.listing_media lm set is_primary = true
from first_media fm
where lm.id = fm.id
  and not exists (select 1 from public.listing_media x where x.listing_id = lm.listing_id and x.is_primary);

create unique index if not exists ux_listing_media_one_primary
  on public.listing_media(listing_id) where is_primary;

create table if not exists public.provider_media (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.service_providers(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete restrict,
  role text not null default 'gallery' check (role in ('logo', 'profile', 'gallery')),
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (provider_id, media_asset_id)
);
create index if not exists ix_provider_media_provider on public.provider_media(provider_id, role, sort_order);
create index if not exists ix_provider_media_asset on public.provider_media(media_asset_id);
create unique index if not exists ux_provider_media_one_logo on public.provider_media(provider_id) where role = 'logo';
create unique index if not exists ux_provider_media_one_profile on public.provider_media(provider_id) where role = 'profile';
create unique index if not exists ux_provider_media_one_primary on public.provider_media(provider_id) where is_primary;
alter table public.provider_media enable row level security;

-- Failed or pending Storage deletions; lets administrators retry cleanup.
create table if not exists public.media_cleanup_queue (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid references public.media_assets(id) on delete set null,
  bucket_name text not null,
  object_path text not null,
  reason text not null check (reason in ('deleted', 'replaced', 'metadata_failed', 'orphaned')),
  attempts integer not null default 0,
  last_error text,
  requested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists ix_media_cleanup_open on public.media_cleanup_queue(created_at) where resolved_at is null;
alter table public.media_cleanup_queue enable row level security;

commit;
