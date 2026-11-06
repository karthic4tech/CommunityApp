-- Tune AI interpretation reservations to the documented hourly/daily limits.
-- Results and directory visibility remain unchanged.
begin;

create or replace function public.reserve_ai_search() returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare
  minute_start timestamptz := date_trunc('minute', now());
  hour_start timestamptz := date_trunc('hour', now());
  day_start timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  caller_id uuid := (select auth.uid());
  caller text := 'caller:' || coalesce(caller_id::text, 'anon');
  caller_hour_limit integer := case when caller_id is null then 10 else 30 end;
begin
  perform pg_catalog.pg_advisory_xact_lock(471082105);
  if coalesce((select requests from public.ai_search_usage where bucket = 'global:day' and window_start = day_start), 0) >= 300
    or coalesce((select requests from public.ai_search_usage where bucket = 'global:minute' and window_start = minute_start), 0) >= 20
    or coalesce((select requests from public.ai_search_usage where bucket = caller and window_start = hour_start), 0) >= caller_hour_limit
    or (caller_id is not null and coalesce((select requests from public.ai_search_usage where bucket = caller and window_start = day_start), 0) >= 100) then
    return false;
  end if;
  delete from public.ai_search_usage where window_start < day_start - interval '2 days';
  insert into public.ai_search_usage (bucket, window_start, requests) values
    ('global:day', day_start, 1), ('global:minute', minute_start, 1),
    (caller, hour_start, 1), (caller, day_start, 1)
  on conflict (bucket, window_start) do update set requests = public.ai_search_usage.requests + 1;
  return true;
end;
$$;

revoke all on function public.reserve_ai_search() from public;
grant execute on function public.reserve_ai_search() to anon, authenticated;
commit;
