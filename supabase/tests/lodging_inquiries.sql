-- Run as postgres in a development Supabase database after all migrations.
-- Verifies anonymous guest submission and owner-scoped inquiry management.
begin;

insert into auth.users (id) values
  ('df190000-0000-4000-8000-000000000001'),
  ('df190000-0000-4000-8000-000000000002');
insert into public.profiles (id, full_name) values
  ('df190000-0000-4000-8000-000000000001', 'Guest One'),
  ('df190000-0000-4000-8000-000000000002', 'Lodge Owner');
insert into public.service_providers (id, owner_user_id, display_name, verification_status) values
  ('df190000-0000-4000-8000-000000000010', 'df190000-0000-4000-8000-000000000002', 'Test Stay', 'verified');

do $$
declare lodging_category_id uuid;
begin
  select id into lodging_category_id from public.service_categories
  where slug in ('hotels', 'lodge-stay') and is_active
  order by case slug when 'hotels' then 0 else 1 end limit 1;
  if lodging_category_id is null then raise exception 'An active hotel or lodge category is required'; end if;
  insert into public.service_listings (id, provider_id, category_id, title, description, status)
  values ('df190000-0000-4000-8000-000000000020', 'df190000-0000-4000-8000-000000000010', lodging_category_id, 'Test Stay', 'Test lodging listing', 'published');
end;
$$;

set local role anon;
insert into public.lodging_inquiries (listing_id, guest_name, guest_phone, question_type, check_in, check_out, guest_count)
values ('df190000-0000-4000-8000-000000000020', 'Guest One', '+91 9876543210', 'availability', current_date + 7, current_date + 9, 2);
reset role;

select set_config('request.jwt.claim.sub', 'df190000-0000-4000-8000-000000000002', true);
set local role authenticated;
do $$
declare inquiry_id uuid;
begin
  select id into inquiry_id from public.lodging_inquiries
  where listing_id = 'df190000-0000-4000-8000-000000000020';
  if inquiry_id is null then raise exception 'The lodging owner must see guest enquiries for their property'; end if;
  update public.lodging_inquiries set status = 'contacted' where id = inquiry_id;
  if not exists (select 1 from public.lodging_inquiries where id = inquiry_id and status = 'contacted') then
    raise exception 'The lodging owner must be able to update the enquiry status';
  end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', 'df190000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
begin
  if exists (select 1 from public.lodging_inquiries where listing_id = 'df190000-0000-4000-8000-000000000020') then
    raise exception 'Guests must not be able to read the private owner inbox';
  end if;
end;
$$;
reset role;

rollback;
