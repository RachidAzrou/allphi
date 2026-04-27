-- Storage bucket + policies for vehicle documents.
-- We keep the bucket private, and allow authenticated users to read only the
-- shared green card PDF. Fleet/management can manage objects.

insert into storage.buckets (id, name, public)
values ('vehicle-documents', 'vehicle-documents', false)
on conflict (id) do update set public = excluded.public;

-- Read access:
-- - Everyone authenticated can download the shared green card file.
-- - Fleet/management can read everything in the bucket.
drop policy if exists "vehicle_documents_select_green_card_or_fleet" on storage.objects;
create policy "vehicle_documents_select_green_card_or_fleet"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'vehicle-documents'
    and (
      public.is_fleet_or_management()
      or name = 'green-cards/groene-kaart.pdf'
    )
  );

-- Write access (fleet/management only).
drop policy if exists "vehicle_documents_insert_fleet" on storage.objects;
create policy "vehicle_documents_insert_fleet"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'vehicle-documents'
    and public.is_fleet_or_management()
  );

drop policy if exists "vehicle_documents_update_fleet" on storage.objects;
create policy "vehicle_documents_update_fleet"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'vehicle-documents'
    and public.is_fleet_or_management()
  )
  with check (
    bucket_id = 'vehicle-documents'
    and public.is_fleet_or_management()
  );

drop policy if exists "vehicle_documents_delete_fleet" on storage.objects;
create policy "vehicle_documents_delete_fleet"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'vehicle-documents'
    and public.is_fleet_or_management()
  );

