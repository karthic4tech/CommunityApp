-- DEVELOPMENT only, as postgres, after migrations 001-005. Fully rolled back.
begin;
-- Isolate counters so results do not depend on earlier development traffic.
delete from public.ai_search_usage;
set local role anon;
do $$
declare i integer;
begin
  for i in 1..10 loop
    if not public.reserve_ai_search() then raise exception 'Anonymous quota rejected too early'; end if;
  end loop;
  if public.reserve_ai_search() then raise exception 'Shared anonymous minute quota bypassed'; end if;
  begin
    perform 1 from public.ai_search_usage;
    raise exception 'Anonymous direct counter access was allowed';
  exception when insufficient_privilege then null;
  end;
  -- Nullable category supports non-AI literal fallback without private rows.
  if exists (select 1 from public.directory_listings(null, null, '') where status <> 'published') then
    raise exception 'Keyword fallback exposed unpublished rows';
  end if;
end;
$$;
reset role;

delete from public.ai_search_usage;
select set_config('request.jwt.claim.sub', 'de000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
declare i integer;
begin
  for i in 1..6 loop
    if not public.reserve_ai_search() then raise exception 'User quota rejected too early'; end if;
  end loop;
  if public.reserve_ai_search() then raise exception 'User minute quota bypassed'; end if;
  begin
    insert into public.ai_search_usage values ('forged', now(), 1);
    raise exception 'Authenticated direct counter writes were allowed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

delete from public.ai_search_usage;
insert into public.ai_search_usage values ('global:day', date_trunc('day', now() at time zone 'UTC') at time zone 'UTC', 300);
set local role anon;
do $$ begin
  if public.reserve_ai_search() then raise exception 'Daily hard cap bypassed'; end if;
end; $$;
reset role;

delete from public.ai_search_usage;
insert into public.ai_search_usage values ('global:minute', date_trunc('minute', now()), 20);
set local role authenticated;
do $$ begin
  if public.reserve_ai_search() then raise exception 'Global minute cap bypassed'; end if;
end; $$;
reset role;

do $$ begin
  if not (select relrowsecurity from pg_class where oid = 'public.ai_search_usage'::regclass) then
    raise exception 'Counter RLS must remain enabled';
  end if;
  if (select prosecdef from pg_proc where oid = 'public.directory_listings(uuid,uuid,text)'::regprocedure) then
    raise exception 'Directory reads must remain security invoker';
  end if;
end; $$;
rollback;
