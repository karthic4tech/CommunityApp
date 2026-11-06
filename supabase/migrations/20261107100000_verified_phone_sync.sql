-- Keep the profile copy of a phone number derived from Supabase Auth only.
alter table if exists public.profiles
  add column if not exists phone_verified_at timestamptz;

create or replace function public.sync_verified_phone()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  auth_phone text;
  confirmed_at timestamptz;
  result public.profiles;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select u.phone, u.phone_confirmed_at into auth_phone, confirmed_at
    from auth.users u where u.id = current_user_id;
  if auth_phone is null or confirmed_at is null then
    raise exception 'A confirmed phone number is required' using errcode = '42501';
  end if;
  update public.profiles set phone = auth_phone, phone_verified_at = confirmed_at
    where id = current_user_id returning * into result;
  return result;
end;
$$;

revoke all on function public.sync_verified_phone() from public, anon;
grant execute on function public.sync_verified_phone() to authenticated;
