-- Compatibility patch for environments where vehicle_documents already exists
-- with a NOT NULL `document_id` column (instead of `id`).
--
-- Ensures `document_id` has a UUID default so bulk inserts/seeds work.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vehicle_documents'
      and column_name = 'document_id'
  ) then
    -- Add default UUID generator when missing.
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'vehicle_documents'
        and column_name = 'document_id'
        and column_default is null
    ) then
      execute 'alter table public.vehicle_documents alter column document_id set default gen_random_uuid()';
    end if;

    -- Make sure there is a primary key (best-effort; skip if one already exists).
    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.vehicle_documents'::regclass
        and contype = 'p'
    ) then
      execute 'alter table public.vehicle_documents add constraint vehicle_documents_pkey primary key (document_id)';
    end if;
  end if;
end $$;

