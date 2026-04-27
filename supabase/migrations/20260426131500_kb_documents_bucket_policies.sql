-- Storage RLS for KB documents bucket `kb-documents`.
-- Bucket must be created in Supabase Dashboard (private recommended).

-- Helper predicate: allow fleet_manager/management.
-- Uses auth.jwt()->>'email' to match medewerkers.emailadres.

drop policy if exists "kb_documents_insert_fleet" on storage.objects;
create policy "kb_documents_insert_fleet"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'kb-documents'
    and exists (
      select 1
      from public.medewerkers m
      where lower(m.emailadres) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and (m.rol = 'fleet_manager' or m.rol = 'management')
    )
  );

drop policy if exists "kb_documents_select_fleet" on storage.objects;
create policy "kb_documents_select_fleet"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'kb-documents'
    and exists (
      select 1
      from public.medewerkers m
      where lower(m.emailadres) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and (m.rol = 'fleet_manager' or m.rol = 'management')
    )
  );

drop policy if exists "kb_documents_update_fleet" on storage.objects;
create policy "kb_documents_update_fleet"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'kb-documents'
    and exists (
      select 1
      from public.medewerkers m
      where lower(m.emailadres) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and (m.rol = 'fleet_manager' or m.rol = 'management')
    )
  )
  with check (
    bucket_id = 'kb-documents'
    and exists (
      select 1
      from public.medewerkers m
      where lower(m.emailadres) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and (m.rol = 'fleet_manager' or m.rol = 'management')
    )
  );

drop policy if exists "kb_documents_delete_fleet" on storage.objects;
create policy "kb_documents_delete_fleet"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'kb-documents'
    and exists (
      select 1
      from public.medewerkers m
      where lower(m.emailadres) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and (m.rol = 'fleet_manager' or m.rol = 'management')
    )
  );

