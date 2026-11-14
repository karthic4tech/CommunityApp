-- Run against a development Supabase database after applying all migrations.
-- Fixtures are rolled back. Verifies server-only access, pending status and row idempotency.
begin;

insert into auth.users (id) values ('de141200-0000-4000-8000-000000000001');
insert into public.profiles (id) values ('de141200-0000-4000-8000-000000000001');
insert into public.service_categories (id, parent_id, name_ta, name_en, slug) values
  ('de141200-0000-4000-8000-000000000020', null, 'சோதனை', 'Bulk Test', 'bulk-import-test-root'),
  ('de141200-0000-4000-8000-000000000021', 'de141200-0000-4000-8000-000000000020', 'சோதனை சேவை', 'Bulk Test Service', 'bulk-import-test-leaf');
insert into public.locations (id, parent_id, location_type, name_ta, name_en, slug) values
  ('de141200-0000-4000-8000-000000000030', null, 'town', 'சோதனை', 'Bulk Test Town', 'bulk-import-test-town');
insert into public.service_import_jobs (id, idempotency_key, uploaded_by, total_rows)
values ('de141200-0000-4000-8000-000000000040', 'bulk-import-test-idempotency-0001', 'de141200-0000-4000-8000-000000000001', 1);

set local role authenticated;
do $$
begin
  begin
    perform public.admin_import_service_row(
      'de141200-0000-4000-8000-000000000040', 0, '{}'::jsonb, '{}'::jsonb, '[]'::jsonb,
      'de141200-0000-4000-8000-000000000030'
    );
    raise exception 'Authenticated users must not execute the import RPC';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

select set_config('request.jwt.claim.role', 'service_role', true);
set local role service_role;
do $$
declare first_id uuid; second_id uuid;
begin
  first_id := public.admin_import_service_row(
    'de141200-0000-4000-8000-000000000040', 0,
    '{"provider_type":"business","display_name":"தமிழ் Test Provider"}'::jsonb,
    '{"category_id":"de141200-0000-4000-8000-000000000021","title":"Bulk Imported Service"}'::jsonb,
    '[{"contact_type":"phone","contact_value":"+919876543210","sort_order":0}]'::jsonb,
    'de141200-0000-4000-8000-000000000030'
  );
  second_id := public.admin_import_service_row(
    'de141200-0000-4000-8000-000000000040', 0,
    '{"provider_type":"business","display_name":"தமிழ் Test Provider"}'::jsonb,
    '{"category_id":"de141200-0000-4000-8000-000000000021","title":"Bulk Imported Service"}'::jsonb,
    '[]'::jsonb, 'de141200-0000-4000-8000-000000000030'
  );
  if first_id <> second_id then raise exception 'Retry must return the same listing ID'; end if;
  if (select status from public.service_listings where id = first_id) <> 'pending_review' then
    raise exception 'Imported services must start in the review queue';
  end if;
  if (select count(*) from public.service_listings where title = 'Bulk Imported Service') <> 1 then
    raise exception 'Idempotent retry must not create duplicate listings';
  end if;
  if (select inserted_rows from public.service_import_jobs where id = 'de141200-0000-4000-8000-000000000040') <> 1 then
    raise exception 'Job audit count must record the imported row once';
  end if;
end;
$$;
reset role;
rollback;
