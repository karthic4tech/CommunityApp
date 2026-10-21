-- Migration 001 revokes anonymous execution of is_admin(). Do not call it
-- from an anonymous policy, or rely on SQL OR short-circuit evaluation.
begin;
drop policy if exists "active service categories are readable" on public.service_categories;
create policy "active service categories are publicly readable"
on public.service_categories for select to anon, authenticated
using (is_active = true);
-- The existing authenticated-only "admin manages service categories" policy
-- continues to provide admin access, including inactive rows.
grant select on public.service_categories to anon, authenticated;
alter table public.service_categories enable row level security;
commit;
