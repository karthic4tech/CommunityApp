-- Featured business cards for the CDM360 homepage.
-- Uses the existing service_providers, service_listings and provider_media records.
begin;

alter table public.service_providers
  add column if not exists is_featured boolean not null default false,
  add column if not exists feature_order integer not null default 0;

alter table public.service_providers
  drop constraint if exists service_providers_feature_order_nonnegative;
alter table public.service_providers
  add constraint service_providers_feature_order_nonnegative
    check (feature_order >= 0);

create index if not exists ix_service_providers_featured_order
  on public.service_providers(feature_order, display_name, id)
  where provider_type = 'business' and verification_status = 'verified' and is_featured;

-- Provider owners may update their existing profile fields, but only admins may
-- set the homepage feature flag or order. New owner-created providers always
-- start unfeatured at the default order.
create or replace function public.protect_provider_featured_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.is_admin() then
    if tg_op = 'INSERT' then
      new.is_featured := false;
      new.feature_order := 0;
    elsif new.is_featured is distinct from old.is_featured
       or new.feature_order is distinct from old.feature_order then
      raise exception 'Only an administrator can feature or order local businesses'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_provider_featured_fields on public.service_providers;
create trigger protect_provider_featured_fields
before insert or update on public.service_providers
for each row execute function public.protect_provider_featured_fields();

notify pgrst, 'reload schema';
commit;
