-- Media module 5/6: Storage RLS policies on storage.objects (RLS is never disabled).
-- Public bucket objects are readable by URL because the bucket is public; the
-- policies below control who may write, list or delete.
begin;

-- Retire the unscoped policies from the earlier "listing-media" experiment, if present.
drop policy if exists "listing media public read" on storage.objects;
drop policy if exists "listing media owner upload" on storage.objects;
drop policy if exists "listing media owner delete" on storage.objects;

drop policy if exists "cdm360 public media insert" on storage.objects;
create policy "cdm360 public media insert" on storage.objects for insert to authenticated
with check (bucket_id = 'cdm360-public-media' and public.can_upload_to_media_path(bucket_id, name));

drop policy if exists "cdm360 public media select" on storage.objects;
create policy "cdm360 public media select" on storage.objects for select to authenticated
using (bucket_id = 'cdm360-public-media' and public.can_upload_to_media_path(bucket_id, name));

drop policy if exists "cdm360 public media delete" on storage.objects;
create policy "cdm360 public media delete" on storage.objects for delete to authenticated
using (bucket_id = 'cdm360-public-media' and public.can_upload_to_media_path(bucket_id, name));

drop policy if exists "cdm360 private files insert" on storage.objects;
create policy "cdm360 private files insert" on storage.objects for insert to authenticated
with check (bucket_id = 'cdm360-private-files' and public.can_access_private_file(name));

drop policy if exists "cdm360 private files select" on storage.objects;
create policy "cdm360 private files select" on storage.objects for select to authenticated
using (bucket_id = 'cdm360-private-files' and public.can_access_private_file(name));

drop policy if exists "cdm360 private files delete" on storage.objects;
create policy "cdm360 private files delete" on storage.objects for delete to authenticated
using (bucket_id = 'cdm360-private-files' and public.can_access_private_file(name));

commit;
