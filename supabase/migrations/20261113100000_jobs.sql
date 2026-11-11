-- Dedicated jobs directory. Jobs are not service listings or provider profiles.
begin;

create table if not exists public.job_categories (
  id uuid primary key default gen_random_uuid(),
  name_en text not null,
  name_ta text not null,
  slug text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint job_categories_name_check check (char_length(trim(name_en)) between 2 and 120)
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.job_categories(id) on delete restrict,
  posted_by uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  company_name text not null,
  description text not null,
  location text not null,
  contact_phone text,
  contact_email text,
  status text not null default 'pending_review'
    check (status in ('draft', 'pending_review', 'published', 'changes_requested', 'rejected', 'archived')),
  review_notes text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_title_check check (char_length(trim(title)) between 2 and 200),
  constraint jobs_company_check check (char_length(trim(company_name)) between 2 and 200),
  constraint jobs_description_check check (char_length(trim(description)) between 10 and 5000),
  constraint jobs_location_check check (char_length(trim(location)) between 2 and 200),
  constraint jobs_contact_check check (contact_phone is not null or contact_email is not null)
);

create index if not exists ix_jobs_public_category on public.jobs(category_id, status, created_at desc);
create index if not exists ix_jobs_owner on public.jobs(posted_by, updated_at desc);

alter table public.job_categories enable row level security;
alter table public.jobs enable row level security;

create policy "active job categories are public"
  on public.job_categories for select to anon, authenticated using (is_active or public.is_admin());
create policy "admins manage job categories"
  on public.job_categories for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "published jobs are public"
  on public.jobs for select to anon, authenticated using (status = 'published');
create policy "owners read their jobs"
  on public.jobs for select to authenticated using (posted_by = (select auth.uid()) or public.is_admin());
create policy "owners create jobs"
  on public.jobs for insert to authenticated
  with check (posted_by = (select auth.uid()) and status in ('draft', 'pending_review'));
create policy "owners edit their jobs"
  on public.jobs for update to authenticated
  using ((posted_by = (select auth.uid()) and status in ('draft', 'changes_requested')) or public.is_admin())
  with check ((posted_by = (select auth.uid()) and status in ('draft', 'pending_review')) or public.is_admin());
create policy "admins delete jobs"
  on public.jobs for delete to authenticated using (public.is_admin());

grant select on public.job_categories to anon, authenticated;
grant insert, update, delete on public.job_categories to authenticated;
grant select, insert, update on public.jobs to authenticated;
grant select on public.jobs to anon;
grant delete on public.jobs to authenticated;

drop trigger if exists set_updated_at on public.jobs;
create trigger set_updated_at before update on public.jobs
for each row execute function public.set_updated_at();

insert into public.job_categories (name_en, name_ta, slug, sort_order)
values
  ('IT & Technology', 'தகவல் தொழில்நுட்பம்', 'it-technology', 10),
  ('Sales & Marketing', 'விற்பனை மற்றும் சந்தைப்படுத்தல்', 'sales-marketing', 20),
  ('Education', 'கல்வி', 'education', 30),
  ('Healthcare', 'சுகாதாரம்', 'healthcare', 40),
  ('Construction & Skilled Trades', 'கட்டுமானம் மற்றும் திறன் தொழில்கள்', 'construction-skilled-trades', 50),
  ('Retail & Hospitality', 'சில்லறை வணிகம் மற்றும் விருந்தோம்பல்', 'retail-hospitality', 60),
  ('Driving & Delivery', 'ஓட்டுநர் மற்றும் டெலிவரி', 'driving-delivery', 70),
  ('Other', 'மற்றவை', 'other', 100)
on conflict (slug) do nothing;

commit;
