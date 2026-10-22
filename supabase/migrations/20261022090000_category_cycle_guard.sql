-- Apply after the existing category/public-directory migrations.
-- Prevents an authorized category mutation from creating a circular parent tree.
-- This migration is intentionally not applied automatically by the application.
begin;

-- Table privileges are required in addition to the existing admin-only RLS
-- policy. No anonymous mutation privilege is granted.
grant insert, update, delete on public.service_categories to authenticated;

create or replace function public.prevent_service_category_cycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  cycle_found boolean;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'A service category cannot be its own parent';
  end if;

  with recursive ancestors(id, path) as (
    select new.parent_id, array[new.parent_id]
    union all
    select parent.parent_id, ancestors.path || parent.parent_id
    from public.service_categories parent
    join ancestors on parent.id = ancestors.id
    where parent.parent_id is not null
      and not (parent.parent_id = any(ancestors.path))
  )
  select exists (select 1 from ancestors where id = new.id)
    into cycle_found;

  if cycle_found then
    raise exception 'A service category cannot be placed below one of its descendants';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_service_category_cycle on public.service_categories;
create trigger prevent_service_category_cycle
before insert or update of parent_id on public.service_categories
for each row execute function public.prevent_service_category_cycle();

commit;
