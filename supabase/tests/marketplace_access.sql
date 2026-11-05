-- Run as postgres in a DEVELOPMENT Supabase database after migration
-- 20261106100000_local_marketplace.sql. Fixtures are rolled back.
begin;
insert into auth.users(id) values
  ('de060000-0000-4000-8000-000000000001'),
  ('de060000-0000-4000-8000-000000000002'),
  ('de060000-0000-4000-8000-000000000003');
insert into public.profiles(id, full_name) values
  ('de060000-0000-4000-8000-000000000001','Marketplace seller one'),
  ('de060000-0000-4000-8000-000000000002','Marketplace seller two'),
  ('de060000-0000-4000-8000-000000000003','Marketplace admin');
insert into public.user_roles(user_id,role_code) values ('de060000-0000-4000-8000-000000000003','super_admin');
insert into public.locations(id,location_type,name_ta,name_en,slug) values
  ('de060000-0000-4000-8000-000000000030','town','சோதனை','Marketplace Test Town','marketplace-test-town');
insert into public.marketplace_categories(id,parent_id,name,name_ta,slug,attributes_schema) values
  ('de060000-0000-4000-8000-000000000020',null,'Marketplace Test','சந்தை சோதனை','marketplace-regression-root','[{"key":"brand","label":"Brand","type":"text"}]'::jsonb),
  ('de060000-0000-4000-8000-000000000021','de060000-0000-4000-8000-000000000020','Marketplace Child','சந்தை துணை வகை','marketplace-regression-child','[]'::jsonb);

insert into public.marketplace_listings
  (id,seller_id,category_id,subcategory_id,title,slug,description,price,condition,location_id,seller_display_name,status,seller_terms_accepted_at)
values
  ('de060000-0000-4000-8000-000000000040','de060000-0000-4000-8000-000000000001','de060000-0000-4000-8000-000000000020',null,'Seller draft','marketplace-seller-draft-de060040','Draft item',100,'good','de060000-0000-4000-8000-000000000030','Seller one','draft',null),
  ('de060000-0000-4000-8000-000000000041','de060000-0000-4000-8000-000000000002','de060000-0000-4000-8000-000000000020',null,'Public marketplace item','marketplace-public-item-de060041','Published item',200,'like_new','de060000-0000-4000-8000-000000000030','Seller two','draft',now()),
  ('de060000-0000-4000-8000-000000000042','de060000-0000-4000-8000-000000000001','de060000-0000-4000-8000-000000000020','de060000-0000-4000-8000-000000000021','Pending marketplace item','marketplace-pending-item-de060042','Awaiting review',300,'brand_new','de060000-0000-4000-8000-000000000030','Seller one','draft',null);
insert into public.marketplace_listing_images(listing_id,storage_path,alt_text,display_order,is_primary) values
  ('de060000-0000-4000-8000-000000000041','de060000-0000-4000-8000-000000000002/de060000-0000-4000-8000-000000000041/main.webp','test image',0,true),
  ('de060000-0000-4000-8000-000000000042','de060000-0000-4000-8000-000000000001/de060000-0000-4000-8000-000000000042/main.webp','test image',0,true);
insert into public.marketplace_listing_attributes(listing_id,attribute_name,attribute_value)
values ('de060000-0000-4000-8000-000000000041','brand','Test Brand');
update public.marketplace_listings set status='published',published_at=now()
where id='de060000-0000-4000-8000-000000000041';

set local role anon;
do $$
begin
  if (select count(*) from public.marketplace_listings) <> 1 then raise exception 'Anon must only see published marketplace listings'; end if;
  if exists (select 1 from public.marketplace_listings where id='de060000-0000-4000-8000-000000000040') then raise exception 'Anon saw a draft marketplace listing'; end if;
  if (select count(*) from public.marketplace_listing_images) <> 1 then raise exception 'Anon must only see images for published marketplace listings'; end if;
  if (select count(*) from public.marketplace_listing_attributes) <> 1 then raise exception 'Anon must only see attributes for published marketplace listings'; end if;
  if (select count(*) from public.marketplace_categories where is_active and slug like 'marketplace-regression-%') <> 2 then raise exception 'Active marketplace categories should be public'; end if;
  begin
    insert into public.marketplace_favourites(user_id,listing_id) values ('de060000-0000-4000-8000-000000000001','de060000-0000-4000-8000-000000000041');
    raise exception 'Anon must not create favourites';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub','de060000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.marketplace_listings where seller_id='de060000-0000-4000-8000-000000000001') <> 2 then raise exception 'Seller must read their own draft and pending listings'; end if;
  begin
    update public.marketplace_listings set status='published' where id='de060000-0000-4000-8000-000000000040';
    raise exception 'Seller must not publish their own listing directly';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.marketplace_listings set is_featured=true where id='de060000-0000-4000-8000-000000000040';
    raise exception 'Seller must not feature their own listing';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.marketplace_favourites(user_id,listing_id) values ('de060000-0000-4000-8000-000000000001','de060000-0000-4000-8000-000000000041');
  exception when unique_violation then null;
  end;
  perform public.submit_marketplace_listing('de060000-0000-4000-8000-000000000042',true);
  if (select status from public.marketplace_listings where id='de060000-0000-4000-8000-000000000042') <> 'pending_approval' then raise exception 'Submission must enter pending approval'; end if;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub','de060000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$
begin
  perform public.admin_moderate_marketplace_listing('de060000-0000-4000-8000-000000000042','approve','Reviewed in test',false);
  if (select status from public.marketplace_listings where id='de060000-0000-4000-8000-000000000042') <> 'published' then raise exception 'Admin approval should publish the listing'; end if;
  if not exists (select 1 from public.marketplace_moderation_logs where listing_id='de060000-0000-4000-8000-000000000042' and admin_id='de060000-0000-4000-8000-000000000003') then raise exception 'Admin approval must be audited'; end if;
end;
$$;
reset role;
rollback;
