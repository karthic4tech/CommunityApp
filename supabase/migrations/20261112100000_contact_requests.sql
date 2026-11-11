-- Public Contact Us submissions and admin-only management.
begin;

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  email text not null check (char_length(trim(email)) between 5 and 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  mobile text not null check (mobile ~ '^\+91[6-9][0-9]{9}$'),
  message text not null check (char_length(trim(message)) between 1 and 4000),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

create index if not exists ix_contact_requests_created on public.contact_requests(created_at desc);
create index if not exists ix_contact_requests_status on public.contact_requests(status, created_at desc);

alter table public.contact_requests enable row level security;

drop policy if exists "anyone can submit contact request" on public.contact_requests;
create policy "anyone can submit contact request"
  on public.contact_requests for insert to anon, authenticated
  with check (true);

drop policy if exists "admins read contact requests" on public.contact_requests;
create policy "admins read contact requests"
  on public.contact_requests for select to authenticated
  using (public.is_admin());

drop policy if exists "admins delete contact requests" on public.contact_requests;
create policy "admins delete contact requests"
  on public.contact_requests for delete to authenticated
  using (public.is_admin());

grant insert (name, email, mobile, message) on public.contact_requests to anon, authenticated;
grant select, delete on public.contact_requests to authenticated;

commit;
