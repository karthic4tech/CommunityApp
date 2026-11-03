-- Media module 3/6: Storage buckets. Storage RLS stays enabled (see migration 5).
-- Neither bucket existed before this migration. The earlier "listing-media" bucket
-- (if you created it) is left in place so existing files keep working, but no new
-- uploads are accepted there after migration 5.
begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('cdm360-public-media', 'cdm360-public-media', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('cdm360-private-files', 'cdm360-private-files', false, 10485760,
   array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

commit;
