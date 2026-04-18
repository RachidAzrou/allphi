-- Iteration 3: scan-fallback flow. Party A can scan a paper "Europees
-- aanrijdingsformulier" instead of running through the wizard. We persist the
-- generated PDF (and optionally the raw page images) in a private storage
-- bucket so the same email-dispatch action can attach it.
--
-- Bucket layout: ongeval-scans/{user_id}/{report_id}/document.pdf
-- The user_id prefix is enforced by the RLS policies below.

insert into storage.buckets (id, name, public)
values ('ongeval-scans', 'ongeval-scans', false)
on conflict (id) do update set public = excluded.public;

drop policy if exists "ongeval_scans_insert_own" on storage.objects;
create policy "ongeval_scans_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'ongeval-scans'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "ongeval_scans_update_own" on storage.objects;
create policy "ongeval_scans_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'ongeval-scans'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'ongeval-scans'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "ongeval_scans_select_own" on storage.objects;
create policy "ongeval_scans_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'ongeval-scans'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "ongeval_scans_delete_own" on storage.objects;
create policy "ongeval_scans_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'ongeval-scans'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- Track on the report row whether this is a wizard- or scan-based submission
-- so the dispatch action can pick the right PDF source.
alter table public.ongeval_aangiften
  add column if not exists submission_mode text
    not null default 'wizard'
    check (submission_mode in ('wizard', 'scan')),
  add column if not exists scan_storage_path text,
  add column if not exists scan_page_count integer not null default 0,
  add column if not exists scan_uploaded_at timestamptz;
