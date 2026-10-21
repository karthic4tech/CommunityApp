-- Run as postgres in a DEVELOPMENT Supabase database after migrations 001-004.
-- Fixtures and assertions are fully rolled back. No pgTAP dependency required.
begin;

insert into auth.users (id) values ('de000000-0000-4000-8000-000000000001');
insert into public.profiles (id) values ('de000000-0000-4000-8000-000000000001');
insert into public.service_providers (id, owner_user_id, display_name, verification_status) values
  ('de000000-0000-4000-8000-000000000010', 'de000000-0000-4000-8000-000000000001', 'Directory Test Business', 'verified'),
  ('de000000-0000-4000-8000-000000000011', 'de000000-0000-4000-8000-000000000001', 'Directory Hidden Business', 'suspended');
insert into public.service_categories (id, parent_id, name_ta, name_en, slug) values
  ('de000000-0000-4000-8000-000000000020', null, 'சோதனை', 'Test', 'directory-regression-root'),
  ('de000000-0000-4000-8000-000000000021', 'de000000-0000-4000-8000-000000000020', 'சோதனை', 'Test child', 'directory-regression-child'),
  ('de000000-0000-4000-8000-000000000022', null, 'சோதனை', 'Other', 'directory-regression-other');
insert into public.locations (id, parent_id, location_type, name_ta, name_en, slug) values
  ('de000000-0000-4000-8000-000000000030', null, 'district', 'சோதனை', 'Test district', 'directory-regression-district'),
  ('de000000-0000-4000-8000-000000000031', 'de000000-0000-4000-8000-000000000030', 'town', 'சோதனை', 'Test town', 'directory-regression-town'),
  ('de000000-0000-4000-8000-000000000032', 'de000000-0000-4000-8000-000000000031', 'locality', 'சோதனை', 'Test locality', 'directory-regression-locality'),
  ('de000000-0000-4000-8000-000000000033', null, 'town', 'சோதனை', 'Other town', 'directory-regression-other-town');
insert into public.service_listings (id, provider_id, category_id, title, description, status) values
  ('de000000-0000-4000-8000-000000000040', 'de000000-0000-4000-8000-000000000010', 'de000000-0000-4000-8000-000000000021', 'Leak repairs', 'Plumbing 100% quality', 'published'),
  ('de000000-0000-4000-8000-000000000041', 'de000000-0000-4000-8000-000000000010', 'de000000-0000-4000-8000-000000000020', 'Parent listing', 'Maintenance', 'published'),
  ('de000000-0000-4000-8000-000000000042', 'de000000-0000-4000-8000-000000000010', 'de000000-0000-4000-8000-000000000021', 'Draft listing', 'Hidden', 'draft'),
  ('de000000-0000-4000-8000-000000000043', 'de000000-0000-4000-8000-000000000011', 'de000000-0000-4000-8000-000000000021', 'Suspended provider listing', 'Hidden', 'published'),
  ('de000000-0000-4000-8000-000000000044', 'de000000-0000-4000-8000-000000000010', 'de000000-0000-4000-8000-000000000022', 'Unrelated listing', 'Hidden from category', 'published');
insert into public.listing_locations (listing_id, location_id, coverage_type) values
  ('de000000-0000-4000-8000-000000000040', 'de000000-0000-4000-8000-000000000032', 'based_here'),
  ('de000000-0000-4000-8000-000000000041', 'de000000-0000-4000-8000-000000000033', 'serves_here'),
  ('de000000-0000-4000-8000-000000000042', 'de000000-0000-4000-8000-000000000032', 'based_here');
insert into public.listing_contacts (listing_id, contact_type, contact_value, is_public) values
  ('de000000-0000-4000-8000-000000000040', 'phone', '+919876543210', true),
  ('de000000-0000-4000-8000-000000000040', 'phone', '+919999999999', false),
  ('de000000-0000-4000-8000-000000000042', 'email', 'private@example.com', true);
insert into public.media_assets (id, storage_path, media_type, visibility) values
  ('de000000-0000-4000-8000-000000000050', 'directory-test/public.jpg', 'image', 'public'),
  ('de000000-0000-4000-8000-000000000051', 'directory-test/private.jpg', 'image', 'private');
insert into public.listing_media (listing_id, media_asset_id) values
  ('de000000-0000-4000-8000-000000000040', 'de000000-0000-4000-8000-000000000050'),
  ('de000000-0000-4000-8000-000000000040', 'de000000-0000-4000-8000-000000000051');

set local role anon;
do $$
begin
  if (select count(*) from public.directory_listings('de000000-0000-4000-8000-000000000020')) <> 2 then
    raise exception 'Parent must include descendants, excluding drafts, suspended providers and unrelated categories';
  end if;
  if (select count(*) from public.directory_listings('de000000-0000-4000-8000-000000000021')) <> 1 then
    raise exception 'Leaf category filtering failed';
  end if;
  if (select count(*) from public.directory_listings('de000000-0000-4000-8000-000000000020', 'de000000-0000-4000-8000-000000000030')) <> 1 then
    raise exception 'District must include descendant locality';
  end if;
  if (select count(*) from public.directory_listings('de000000-0000-4000-8000-000000000020', 'de000000-0000-4000-8000-000000000031')) <> 1 then
    raise exception 'Town must include descendant locality';
  end if;
  if (select count(*) from public.directory_listings('de000000-0000-4000-8000-000000000021', 'de000000-0000-4000-8000-000000000033')) <> 0 then
    raise exception 'Unrelated location must not match';
  end if;
  if (select count(*) from public.directory_listings('de000000-0000-4000-8000-000000000020', null, 'TEST BUSINESS')) <> 2 then
    raise exception 'Case-insensitive business-name search failed';
  end if;
  if (select count(*) from public.directory_listings('de000000-0000-4000-8000-000000000020', null, '100%')) <> 1 then
    raise exception 'Keyword must be literal, not a wildcard expression';
  end if;
  if exists (select 1 from public.service_listings where id in ('de000000-0000-4000-8000-000000000042', 'de000000-0000-4000-8000-000000000043')) then
    raise exception 'Anonymous direct reads exposed unpublished data';
  end if;
  if (select count(*) from public.listing_contacts where listing_id in ('de000000-0000-4000-8000-000000000040', 'de000000-0000-4000-8000-000000000042')) <> 1 then
    raise exception 'Private contacts or draft contacts exposed';
  end if;
  if (select count(*) from public.media_assets where id in ('de000000-0000-4000-8000-000000000050', 'de000000-0000-4000-8000-000000000051')) <> 1 then
    raise exception 'Private media exposed';
  end if;
  if exists (select 1 from public.listing_locations where listing_id = 'de000000-0000-4000-8000-000000000042') then
    raise exception 'Draft location exposed';
  end if;
end;
$$;

reset role;
-- Authenticated owners retain their original access, but the public RPC must
-- still exclude their drafts and private contacts are filtered by the client.
select set_config('request.jwt.claim.sub', 'de000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
begin
  if not exists (select 1 from public.service_listings where id = 'de000000-0000-4000-8000-000000000042') then
    raise exception 'Owner draft access was lost';
  end if;
  if (select count(*) from public.directory_listings('de000000-0000-4000-8000-000000000020')) <> 2 then
    raise exception 'Public directory RPC exposed owner-only rows';
  end if;
end;
$$;
reset role;
rollback;
