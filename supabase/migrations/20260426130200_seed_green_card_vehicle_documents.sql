-- Seed the shared green card PDF as a vehicle_document for every VIN.
-- document_url stores the storage object path (bucket is implied).

do $$
begin
  -- Some environments use `document_id` (NOT NULL) instead of `id`.
  -- `document_type` is constrained in some DBs to uppercase values like 'GROENE_KAART'.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vehicle_documents'
      and column_name = 'document_id'
  ) then
    execute $sql$
      insert into public.vehicle_documents (document_id, voertuig_vin, document_type, document_url)
      select
        gen_random_uuid(),
        fv.vin::text,
        'GROENE_KAART',
        'green-cards/groene-kaart.pdf'
      from public.fleet_vehicles fv
      where fv.vin is not null
        and trim(fv.vin) <> ''
      on conflict (voertuig_vin, document_type) do update
      set
        document_url = excluded.document_url,
        updated_at = now()
    $sql$;
  else
    execute $sql$
      insert into public.vehicle_documents (voertuig_vin, document_type, document_url)
      select
        fv.vin::text,
        'GROENE_KAART',
        'green-cards/groene-kaart.pdf'
      from public.fleet_vehicles fv
      where fv.vin is not null
        and trim(fv.vin) <> ''
      on conflict (voertuig_vin, document_type) do update
      set
        document_url = excluded.document_url,
        updated_at = now()
    $sql$;
  end if;
end $$;

