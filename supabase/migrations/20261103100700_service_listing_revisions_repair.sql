-- Repair: production created service_listing_revisions from an earlier definition.
-- The 20261022100000 migration used CREATE TABLE IF NOT EXISTS, so columns added
-- later (review_notes, reviewed_by, reviewed_at) never reached production.
-- Add the missing columns without touching existing data.
begin;

alter table public.service_listing_revisions
  add column if not exists review_notes text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

notify pgrst, 'reload schema';
commit;
