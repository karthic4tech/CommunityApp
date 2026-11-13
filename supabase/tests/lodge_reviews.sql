-- Run as postgres in a development Supabase database after all migrations.
-- Uses isolated fixtures and rolls back every change.
begin;

insert into auth.users (id) values
  ('de130000-0000-4000-8000-000000000001'),
  ('de130000-0000-4000-8000-000000000002'),
  ('de130000-0000-4000-8000-000000000003');
insert into public.profiles (id) values
  ('de130000-0000-4000-8000-000000000001'),
  ('de130000-0000-4000-8000-000000000002'),
  ('de130000-0000-4000-8000-000000000003');
insert into public.service_providers (id, owner_user_id, display_name, verification_status) values
  ('de130000-0000-4000-8000-000000000010', 'de130000-0000-4000-8000-000000000002', 'Test Lodge', 'verified');
do $$
declare
  lodge_category_id uuid;
begin
  select id into lodge_category_id from public.service_categories
  where slug in ('lodge-stay', 'hotels') and is_active
  order by case slug when 'lodge-stay' then 0 else 1 end limit 1;
  if lodge_category_id is null then raise exception 'An active Lodge & Stay category is required for this test'; end if;
  insert into public.service_listings (id, provider_id, category_id, title, description, status)
  values ('de130000-0000-4000-8000-000000000030', 'de130000-0000-4000-8000-000000000010', lodge_category_id, 'Test Lodge', 'Test listing', 'published');
end;
$$;

insert into public.lodge_reviews (id, listing_id, author_user_id, rating, review_text, status) values
  ('de130000-0000-4000-8000-000000000040', 'de130000-0000-4000-8000-000000000030', 'de130000-0000-4000-8000-000000000001', 5, 'Clean and comfortable stay.', 'published'),
  ('de130000-0000-4000-8000-000000000041', 'de130000-0000-4000-8000-000000000030', 'de130000-0000-4000-8000-000000000002', 1, 'The room was not clean.', 'pending_review');

do $$
begin
  if not exists (select 1 from public.lodge_review_summaries where listing_id = 'de130000-0000-4000-8000-000000000030' and review_count = 1 and average_rating = 5) then
    raise exception 'Rating summary must include only published reviews';
  end if;
  begin
    insert into public.lodge_reviews (listing_id, author_user_id, rating, review_text, status)
    values ('de130000-0000-4000-8000-000000000030', 'de130000-0000-4000-8000-000000000001', 4, 'Duplicate active review.', 'pending_review');
    raise exception 'Duplicate active reviews should be rejected';
  exception when unique_violation then null;
  end;
  begin
    insert into public.lodge_reviews (listing_id, author_user_id, rating, review_text, status)
    values ('de130000-0000-4000-8000-000000000030', 'de130000-0000-4000-8000-000000000003', 6, 'Invalid rating value.', 'pending_review');
    raise exception 'Ratings outside the 1–5 range should be rejected';
  exception when check_violation then null;
  end;
end;
$$;

set local role anon;
do $$
begin
  if (select count(*) from public.lodge_reviews where listing_id = 'de130000-0000-4000-8000-000000000030') <> 1 then
    raise exception 'Anonymous users must only see published lodge reviews';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', 'de130000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.lodge_reviews where author_user_id = auth.uid()) <> 1 then
    raise exception 'Authors must be able to read their own review';
  end if;
  begin
    insert into public.lodge_reviews (listing_id, author_user_id, rating, review_text)
    values ('de130000-0000-4000-8000-000000000030', 'de130000-0000-4000-8000-000000000002', 4, 'Trying to impersonate another reviewer.');
    raise exception 'Authors must not be able to spoof a review author id';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
rollback;
