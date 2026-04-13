-- Storage RLS for chat uploads. Create a private bucket named `chat-attachments` in the
-- Supabase Dashboard (Storage) before running this, or adjust bucket_id to match env.

drop policy if exists "chat_attachments_insert_own" on storage.objects;
create policy "chat_attachments_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "chat_attachments_select_own" on storage.objects;
create policy "chat_attachments_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'chat-attachments'
    and split_part(name, '/', 1) = auth.uid()::text
  );
