begin;

alter table public.service_listings
  add column if not exists room_amenities text[] not null default '{}',
  add column if not exists indicative_room_price numeric(10,2);

alter table public.service_listings
  drop constraint if exists service_listings_indicative_room_price_check,
  add constraint service_listings_indicative_room_price_check
    check (indicative_room_price is null or indicative_room_price >= 0);

create or replace function public.apply_reviewed_lodge_details()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status = 'approved' and old.status is distinct from new.status and public.is_admin() then
    update public.service_listings
    set room_amenities = case
          when new.snapshot #> '{listing,room_amenities}' is null then room_amenities
          else coalesce(array(select jsonb_array_elements_text(new.snapshot #> '{listing,room_amenities}')), '{}'::text[])
        end,
        indicative_room_price = case
          when new.snapshot #> '{listing,indicative_room_price}' is null then indicative_room_price
          else nullif(new.snapshot #>> '{listing,indicative_room_price}', '')::numeric
        end
    where id = new.listing_id;
  end if;
  return new;
end;
$$;
revoke all on function public.apply_reviewed_lodge_details() from public, anon, authenticated;
create trigger apply_reviewed_lodge_details
  after update of status on public.service_listing_revisions
  for each row execute function public.apply_reviewed_lodge_details();

create table public.lodge_reviews (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.service_listings(id) on delete cascade,
  author_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text check (title is null or char_length(trim(title)) between 1 and 120),
  review_text text not null check (char_length(trim(review_text)) between 10 and 3000),
  status text not null default 'pending_review' check (status in ('pending_review', 'published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index lodge_reviews_one_active_per_author_listing
  on public.lodge_reviews(listing_id, author_user_id)
  where status in ('pending_review', 'published');
create index lodge_reviews_public_listing_created
  on public.lodge_reviews(listing_id, created_at desc) where status = 'published';
create trigger lodge_reviews_set_updated_at before update on public.lodge_reviews
  for each row execute function public.set_updated_at();

create table public.lodge_review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.lodge_reviews(id) on delete cascade,
  reporter_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam', 'abuse', 'fake_or_misleading', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz
);
create unique index lodge_review_reports_one_open_per_user
  on public.lodge_review_reports(review_id, reporter_user_id) where status = 'open';
create index lodge_review_reports_open_created on public.lodge_review_reports(created_at desc) where status = 'open';

create table public.lodge_review_owner_responses (
  review_id uuid primary key references public.lodge_reviews(id) on delete cascade,
  owner_user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  response_text text not null check (char_length(trim(response_text)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger lodge_review_owner_responses_set_updated_at before update on public.lodge_review_owner_responses
  for each row execute function public.set_updated_at();

create table public.lodge_review_moderation_actions (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.lodge_reviews(id) on delete cascade,
  report_id uuid references public.lodge_review_reports(id) on delete set null,
  moderator_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('approved', 'hidden', 'report_dismissed')),
  notes text check (notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);

create or replace function public.is_published_lodge_listing(_listing_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.service_listings sl
    join public.service_categories sc on sc.id = sl.category_id
    join public.service_providers sp on sp.id = sl.provider_id
    where sl.id = _listing_id and sl.status = 'published'
      and sc.is_active and sc.slug in ('hotels', 'lodge-stay')
      and sp.verification_status = 'verified'
  );
$$;
revoke all on function public.is_published_lodge_listing(uuid) from public;
grant execute on function public.is_published_lodge_listing(uuid) to anon, authenticated;

create or replace function public.is_lodge_listing_owner(_listing_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.service_listings sl
    join public.service_categories sc on sc.id = sl.category_id
    join public.service_providers sp on sp.id = sl.provider_id
    where sl.id = _listing_id and sc.slug in ('hotels', 'lodge-stay')
      and sp.owner_user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_lodge_listing_owner(uuid) from public, anon;
grant execute on function public.is_lodge_listing_owner(uuid) to authenticated;

alter table public.lodge_reviews enable row level security;
alter table public.lodge_review_reports enable row level security;
alter table public.lodge_review_owner_responses enable row level security;
alter table public.lodge_review_moderation_actions enable row level security;

create policy "Public read published lodge reviews" on public.lodge_reviews
  for select to anon, authenticated
  using (status = 'published' and public.is_published_lodge_listing(listing_id));
create policy "Authors read own lodge reviews" on public.lodge_reviews
  for select to authenticated using (author_user_id = (select auth.uid()));
create policy "Admins read all lodge reviews" on public.lodge_reviews
  for select to authenticated using (public.is_admin());
create policy "Authenticated users submit lodge reviews" on public.lodge_reviews
  for insert to authenticated
  with check (author_user_id = (select auth.uid()) and status = 'pending_review' and public.is_published_lodge_listing(listing_id));
create policy "Authors edit own active lodge reviews" on public.lodge_reviews
  for update to authenticated
  using (author_user_id = (select auth.uid()) and status in ('pending_review', 'published'))
  with check (author_user_id = (select auth.uid()) and status = 'pending_review');
create policy "Admins manage lodge reviews" on public.lodge_reviews
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.lodge_reviews from anon, authenticated;
grant select (id, listing_id, rating, title, review_text, status, created_at, updated_at) on public.lodge_reviews to anon, authenticated;
grant select (author_user_id) on public.lodge_reviews to authenticated;
grant insert (listing_id, rating, title, review_text) on public.lodge_reviews to authenticated;
grant update (rating, title, review_text, status) on public.lodge_reviews to authenticated;

create policy "Reporters read own lodge review reports" on public.lodge_review_reports
  for select to authenticated using (reporter_user_id = (select auth.uid()));
create policy "Admins read lodge review reports" on public.lodge_review_reports
  for select to authenticated using (public.is_admin());
create policy "Users report published lodge reviews" on public.lodge_review_reports
  for insert to authenticated
  with check (
    reporter_user_id = (select auth.uid())
    and exists (select 1 from public.lodge_reviews r where r.id = review_id and r.status = 'published' and r.author_user_id <> (select auth.uid()))
  );
revoke all on public.lodge_review_reports from anon, authenticated;
grant select on public.lodge_review_reports to authenticated;
grant insert (review_id, reason, details) on public.lodge_review_reports to authenticated;

create policy "Public read lodge owner responses" on public.lodge_review_owner_responses
  for select to anon, authenticated
  using (exists (
    select 1 from public.lodge_reviews r
    where r.id = review_id and r.status = 'published' and public.is_published_lodge_listing(r.listing_id)
  ));
create policy "Owners read own lodge responses" on public.lodge_review_owner_responses
  for select to authenticated using (owner_user_id = (select auth.uid()));
create policy "Admins read lodge owner responses" on public.lodge_review_owner_responses
  for select to authenticated using (public.is_admin());
create policy "Lodge owners respond to published reviews" on public.lodge_review_owner_responses
  for insert to authenticated
  with check (
    owner_user_id = (select auth.uid())
    and exists (
      select 1 from public.lodge_reviews r
      join public.service_listings sl on sl.id = r.listing_id
      join public.service_providers sp on sp.id = sl.provider_id
      where r.id = review_id and r.status = 'published' and sp.owner_user_id = (select auth.uid())
    )
  );
create policy "Owners edit own lodge responses" on public.lodge_review_owner_responses
  for update to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (
    owner_user_id = (select auth.uid())
    and exists (
      select 1 from public.lodge_reviews r
      join public.service_listings sl on sl.id = r.listing_id
      join public.service_providers sp on sp.id = sl.provider_id
      where r.id = review_id and r.status = 'published' and sp.owner_user_id = (select auth.uid())
    )
  );
revoke all on public.lodge_review_owner_responses from anon, authenticated;
grant select on public.lodge_review_owner_responses to anon, authenticated;
grant insert (review_id, response_text) on public.lodge_review_owner_responses to authenticated;
grant update (response_text) on public.lodge_review_owner_responses to authenticated;

create policy "Admins read lodge review moderation history" on public.lodge_review_moderation_actions
  for select to authenticated using (public.is_admin());
revoke all on public.lodge_review_moderation_actions from anon, authenticated;
grant select on public.lodge_review_moderation_actions to authenticated;

create or replace view public.lodge_review_summaries with (security_invoker = true) as
  select listing_id, round(avg(rating)::numeric, 1) as average_rating, count(*)::integer as review_count
  from public.lodge_reviews where status = 'published' group by listing_id;
grant select on public.lodge_review_summaries to anon, authenticated;

create or replace function public.moderate_lodge_review(
  _review_id uuid, _decision text, _notes text default null, _report_id uuid default null
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  review_row public.lodge_reviews;
begin
  if not public.is_admin() then raise exception 'Administrator access required' using errcode = '42501'; end if;
  if _decision not in ('approve', 'hide', 'dismiss') then raise exception 'Unsupported moderation decision'; end if;
  select * into review_row from public.lodge_reviews where id = _review_id for update;
  if not found then raise exception 'Review not found'; end if;

  if _decision = 'approve' then
    update public.lodge_reviews set status = 'published', updated_at = now() where id = _review_id;
  elsif _decision = 'hide' then
    if coalesce(length(trim(_notes)), 0) = 0 then raise exception 'A reason is required to hide a review'; end if;
    update public.lodge_reviews set status = 'hidden', updated_at = now() where id = _review_id;
  elsif _report_id is null then
    raise exception 'A report is required to dismiss';
  end if;

  if _report_id is not null then
    update public.lodge_review_reports set status = 'resolved', reviewed_by = (select auth.uid()), reviewed_at = now()
    where id = _report_id and review_id = _review_id and status = 'open';
    if not found then raise exception 'Open report not found'; end if;
  end if;

  insert into public.lodge_review_moderation_actions(review_id, report_id, moderator_user_id, action, notes)
  values (_review_id, _report_id, (select auth.uid()),
    case _decision when 'approve' then 'approved' when 'hide' then 'hidden' else 'report_dismissed' end,
    nullif(trim(_notes), ''));
  return _review_id;
end;
$$;
revoke all on function public.moderate_lodge_review(uuid, text, text, uuid) from public, anon;
grant execute on function public.moderate_lodge_review(uuid, text, text, uuid) to authenticated;

commit;
