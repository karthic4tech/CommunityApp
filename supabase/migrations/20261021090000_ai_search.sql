-- Apply after 004. Preserve the same real FK joins/publication checks, but allow
-- category = null for literal keyword fallback across the active hierarchy.
begin;
create or replace function public.directory_listings(
  category uuid, location uuid default null, keyword text default ''
) returns setof public.service_listings
language sql stable security invoker set search_path = '' as $$
  with recursive categories as (
    select id from public.service_categories where is_active
      and (id = category or (category is null and parent_id is null))
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
      select 1 from public.listing_locations ll where ll.listing_id = sl.id and ll.location_id in (select id from places)
    ))
    and (coalesce(trim(keyword), '') = '' or strpos(
      lower(sl.title || ' ' || sl.description || ' ' || sp.display_name), lower(trim(keyword))
    ) > 0);
$$;

-- New, purpose-specific bookkeeping, not duplicate directory data. No query text,
-- tokens, IP addresses or model output are stored. No direct client table access.
create table public.ai_search_usage (
  bucket text not null,
  window_start timestamptz not null,
  requests integer not null check (requests > 0),
  primary key (bucket, window_start)
);
alter table public.ai_search_usage enable row level security;
revoke all on public.ai_search_usage from public, anon, authenticated;

create function public.reserve_ai_search() returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  minute_start timestamptz := date_trunc('minute', now());
  day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  caller text := 'caller:' || coalesce((select auth.uid())::text, 'anon');
  caller_limit integer := case when (select auth.uid()) is null then 10 else 6 end;
begin
  -- One short transaction serializes reservations across all Edge isolates.
  perform pg_catalog.pg_advisory_xact_lock(471082105);
  if coalesce((select requests from public.ai_search_usage where bucket = 'global:day' and window_start = day_start), 0) >= 300
    or coalesce((select requests from public.ai_search_usage where bucket = 'global:minute' and window_start = minute_start), 0) >= 20
    or coalesce((select requests from public.ai_search_usage where bucket = caller and window_start = minute_start), 0) >= caller_limit then
    return false;
  end if;
  delete from public.ai_search_usage where window_start < day_start - interval '2 days';
  insert into public.ai_search_usage (bucket, window_start, requests) values
    ('global:day', day_start, 1), ('global:minute', minute_start, 1), (caller, minute_start, 1)
  on conflict (bucket, window_start) do update set requests = public.ai_search_usage.requests + 1;
  return true;
end;
$$;
revoke all on function public.reserve_ai_search() from public;
grant execute on function public.reserve_ai_search() to anon, authenticated;
-- SECURITY DEFINER is confined to quota counters. Directory reads stay INVOKER.
commit;
