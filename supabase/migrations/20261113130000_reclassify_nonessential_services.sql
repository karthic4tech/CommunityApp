begin;

-- Keep general local businesses in the full directory rather than the
-- hand-curated essential-services experience.
with nonessential_categories as (
  select id
  from public.service_categories
  where slug in (
    'restaurants',
    'vegetarian-restaurants',
    'non-vegetarian-restaurants',
    'two-wheeler-repair',
    'electrician'
  )
)
update public.service_categories category
set is_essential = false,
    essential_order = null,
    is_emergency = false
from nonessential_categories nonessential
where category.id = nonessential.id;

update public.essential_service_shortcuts shortcut
set is_active = false,
    updated_at = now()
where shortcut.subcategory_id in (
  select id
  from public.service_categories
  where slug in (
    'restaurants',
    'vegetarian-restaurants',
    'non-vegetarian-restaurants',
    'two-wheeler-repair',
    'electrician'
  )
);

notify pgrst, 'reload schema';
commit;
