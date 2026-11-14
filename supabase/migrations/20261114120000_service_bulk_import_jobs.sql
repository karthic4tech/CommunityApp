begin;

create table if not exists public.service_import_jobs (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique check (char_length(idempotency_key) between 16 and 128),
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'processing' check (status in ('processing', 'completed', 'partial', 'failed')),
  total_rows integer not null check (total_rows between 1 and 2000),
  inserted_rows integer not null default 0 check (inserted_rows >= 0),
  skipped_rows integer not null default 0 check (skipped_rows >= 0),
  failed_rows integer not null default 0 check (failed_rows >= 0),
  row_results jsonb not null default '{}'::jsonb,
  error_summary jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_service_import_jobs_uploader_created
  on public.service_import_jobs(uploaded_by, created_at desc);

alter table public.service_import_jobs enable row level security;
drop policy if exists "admins read service import jobs" on public.service_import_jobs;
create policy "admins read service import jobs"
  on public.service_import_jobs for select to authenticated using (public.is_admin());
revoke all on public.service_import_jobs from anon, authenticated;
grant select on public.service_import_jobs to authenticated;
grant all on public.service_import_jobs to service_role;

drop trigger if exists set_updated_at on public.service_import_jobs;
create trigger set_updated_at before update on public.service_import_jobs
  for each row execute function public.set_updated_at();

create or replace function public.admin_import_service_row(
  _job_id uuid,
  _row_index integer,
  _provider jsonb,
  _listing jsonb,
  _contacts jsonb,
  _location_id uuid
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_row public.service_import_jobs;
  provider_id uuid;
  listing_id uuid;
  contact_row jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if _row_index < 0 or _row_index >= 2000 then
    raise exception 'Invalid import row index' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(_job_id::text || ':' || _row_index::text, 0));
  select * into job_row from public.service_import_jobs where id = _job_id for update;
  if not found then raise exception 'Import job not found' using errcode = 'P0002'; end if;
  if job_row.row_results ? _row_index::text
     and job_row.row_results #>> array[_row_index::text, 'status'] = 'inserted' then
    return (job_row.row_results #>> array[_row_index::text, 'listingId'])::uuid;
  end if;
  if job_row.status not in ('processing', 'partial') then
    raise exception 'Import job is not open for retries' using errcode = '55000';
  end if;

  insert into public.service_providers (
    owner_user_id, provider_type, display_name, description, verification_status,
    public_email, website_url, address, postal_code
  ) values (
    job_row.uploaded_by, _provider->>'provider_type', _provider->>'display_name', nullif(_provider->>'description', ''), 'pending',
    nullif(_provider->>'public_email', ''), nullif(_provider->>'website_url', ''), nullif(_provider->>'address', ''), nullif(_provider->>'postal_code', '')
  ) returning id into provider_id;

  insert into public.service_listings (provider_id, category_id, title, description, room_amenities, indicative_room_price, status, submitted_at)
  values (provider_id, (_listing->>'category_id')::uuid, _listing->>'title', nullif(_listing->>'description', ''), '{}'::text[], null, 'pending_review', pg_catalog.now())
  returning id into listing_id;

  for contact_row in select value from pg_catalog.jsonb_array_elements(coalesce(_contacts, '[]'::jsonb)) loop
    insert into public.listing_contacts (listing_id, contact_type, contact_value, is_public, sort_order)
    values (listing_id, contact_row->>'contact_type', contact_row->>'contact_value', true, coalesce((contact_row->>'sort_order')::integer, 0));
  end loop;
  insert into public.listing_locations (listing_id, location_id, coverage_type)
  values (listing_id, _location_id, 'based_here');

  update public.service_import_jobs
  set row_results = row_results || pg_catalog.jsonb_build_object(_row_index::text, pg_catalog.jsonb_build_object('status', 'inserted', 'listingId', listing_id)),
      inserted_rows = inserted_rows + 1,
      updated_at = pg_catalog.now()
  where id = _job_id;
  return listing_id;
end;
$$;

revoke all on function public.admin_import_service_row(uuid, integer, jsonb, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.admin_import_service_row(uuid, integer, jsonb, jsonb, jsonb, uuid) to service_role;

commit;
