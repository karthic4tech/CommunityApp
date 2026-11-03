-- Media module 1/6: extend the existing public.media_assets table.
-- Additive only. Existing rows are backfilled; no existing column is changed.
begin;

alter table public.media_assets
  add column if not exists original_filename text,
  add column if not exists stored_filename text,
  add column if not exists bucket_name text,
  add column if not exists file_extension text,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists alt_text text,
  add column if not exists caption text,
  add column if not exists upload_status text not null default 'uploaded',
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

-- Legacy rows store "bucket/object/path" in storage_path. Keep that convention.
update public.media_assets
set bucket_name = split_part(storage_path, '/', 1),
    stored_filename = coalesce(stored_filename, regexp_replace(storage_path, '^.*/', ''))
where bucket_name is null and storage_path like '%/%';

alter table public.media_assets
  drop constraint if exists media_assets_upload_status_check,
  drop constraint if exists media_assets_dimensions_check,
  drop constraint if exists media_assets_text_length_check;
alter table public.media_assets
  add constraint media_assets_upload_status_check
    check (upload_status in ('pending', 'uploaded', 'failed', 'deleted')),
  add constraint media_assets_dimensions_check
    check ((width is null or width > 0) and (height is null or height > 0)),
  add constraint media_assets_text_length_check
    check (char_length(coalesce(alt_text, '')) <= 300 and char_length(coalesce(caption, '')) <= 500);

create index if not exists ix_media_assets_bucket on public.media_assets(bucket_name);
create index if not exists ix_media_assets_status_created on public.media_assets(upload_status, created_at desc);
create index if not exists ix_media_assets_active_created on public.media_assets(created_at desc) where deleted_at is null;

drop trigger if exists set_updated_at on public.media_assets;
create trigger set_updated_at before update on public.media_assets
for each row execute function public.set_updated_at();

commit;
