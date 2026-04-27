-- Iteration: damage-only track should collect photo evidence for glass breakage
-- and single-vehicle damage. We store uploaded images in a private bucket so
-- the dossier can reference them and the dispatch e-mail can include signed links.
--
-- Bucket layout: ongeval-photos/{user_id}/{report_id}/{timestamp}-{seq}-{filename}
-- The user_id prefix is enforced by the RLS policies below.

insert into storage.buckets (id, name, public)
values ('ongeval-photos', 'ongeval-photos', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "ongeval_photos_insert_own" on storage.objects;
create policy "ongeval_photos_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'ongeval-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "ongeval_photos_update_own" on storage.objects;
create policy "ongeval_photos_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'ongeval-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'ongeval-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "ongeval_photos_select_own" on storage.objects;
create policy "ongeval_photos_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'ongeval-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "ongeval_photos_delete_own" on storage.objects;
create policy "ongeval_photos_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'ongeval-photos'
    and split_part(name, '/', 1) = auth.uid()::text
  );

