-- Guest room/stay enquiries with owner-scoped inbox management.
begin;

create table if not exists public.lodging_inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.service_listings(id) on delete cascade,
  guest_name text not null,
  guest_phone text not null check (char_length(trim(guest_phone)) between 7 and 24),
  guest_email text check (guest_email is null or guest_email = '' or (char_length(guest_email) <= 254 and guest_email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  question_type text not null check (question_type in ('availability', 'assisted_booking', 'booking_instructions', 'other')),
  check_in date,
  check_out date,
  guest_count smallint check (guest_count between 1 and 20),
  message text check (message is null or char_length(message) <= 3000),
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lodging_inquiries_dates_valid check (check_in is null or check_out is null or check_out >= check_in),
  constraint lodging_inquiries_availability_dates check (question_type <> 'availability' or (check_in is not null and check_out is not null))
);

create index if not exists ix_lodging_inquiries_listing_created
  on public.lodging_inquiries(listing_id, created_at desc);
create index if not exists ix_lodging_inquiries_status_created
  on public.lodging_inquiries(status, created_at desc);

alter table public.lodging_inquiries enable row level security;

drop policy if exists "public can enquire about published lodging" on public.lodging_inquiries;
create policy "public can enquire about published lodging"
  on public.lodging_inquiries for insert to anon, authenticated
  with check (
    exists (
      select 1
      from public.service_listings listing
      join public.service_providers provider on provider.id = listing.provider_id
      join public.service_categories category on category.id = listing.category_id
      where listing.id = listing_id
        and listing.status = 'published'
        and provider.verification_status = 'verified'
        and category.is_active
        and category.slug in ('hotels', 'lodge-stay')
    )
  );

drop policy if exists "lodging owners read enquiries" on public.lodging_inquiries;
create policy "lodging owners read enquiries"
  on public.lodging_inquiries for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.service_listings listing
      join public.service_providers provider on provider.id = listing.provider_id
      where listing.id = listing_id and provider.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "lodging owners update enquiry status" on public.lodging_inquiries;
create policy "lodging owners update enquiry status"
  on public.lodging_inquiries for update to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.service_listings listing
      join public.service_providers provider on provider.id = listing.provider_id
      where listing.id = listing_id and provider.owner_user_id = (select auth.uid())
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.service_listings listing
      join public.service_providers provider on provider.id = listing.provider_id
      where listing.id = listing_id and provider.owner_user_id = (select auth.uid())
    )
  );

drop trigger if exists lodging_inquiries_set_updated_at on public.lodging_inquiries;
create trigger lodging_inquiries_set_updated_at
  before update on public.lodging_inquiries
  for each row execute function public.set_updated_at();

grant insert (listing_id, guest_name, guest_phone, guest_email, question_type, check_in, check_out, guest_count, message)
  on public.lodging_inquiries to anon, authenticated;
grant select on public.lodging_inquiries to authenticated;
grant update (status) on public.lodging_inquiries to authenticated;

commit;
