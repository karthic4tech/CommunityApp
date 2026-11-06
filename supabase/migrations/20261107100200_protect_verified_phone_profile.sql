-- Profile phone fields are a derived copy of Supabase Auth state. Prevent a
-- normal authenticated client from forging or replacing that copy.
create or replace function public.protect_verified_phone_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  auth_phone text;
  auth_confirmed_at timestamptz;
begin
  if caller_id is null then
    return new;
  end if;

  select u.phone, u.phone_confirmed_at
    into auth_phone, auth_confirmed_at
    from auth.users u
   where u.id = caller_id;

  if tg_op = 'INSERT' then
    if new.phone is not null or new.phone_verified_at is not null then
      if auth_phone is null or auth_confirmed_at is null
         or new.phone is distinct from auth_phone
         or new.phone_verified_at is distinct from auth_confirmed_at then
        raise exception 'Phone fields must be synchronized from confirmed Auth state'
          using errcode = '42501';
      end if;
    end if;
    return new;
  end if;

  if new.phone is distinct from old.phone
     or new.phone_verified_at is distinct from old.phone_verified_at then
    if auth_phone is null or auth_confirmed_at is null
       or new.phone is distinct from auth_phone
       or new.phone_verified_at is distinct from auth_confirmed_at then
      raise exception 'Phone fields must be synchronized from confirmed Auth state'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_verified_phone_profile() from public, anon;
grant execute on function public.protect_verified_phone_profile() to authenticated;

drop trigger if exists protect_verified_phone_profile on public.profiles;
create trigger protect_verified_phone_profile
before insert or update of phone, phone_verified_at on public.profiles
for each row execute function public.protect_verified_phone_profile();
