-- Enforce Belgian plate format `2-ABC-111` on fleet_vehicles.nummerplaat.
-- Also clean up legacy placeholder plates like `ALL-000005`.

do $$
begin
  if to_regclass('public.fleet_vehicles') is null then
    raise notice 'Skipping plate format constraint: public.fleet_vehicles does not exist';
    return;
  end if;

  -- Convert placeholder plates to NULL (we cannot infer the real plate).
  execute $sql$
    update public.fleet_vehicles
    set nummerplaat = null
    where nummerplaat is not null
      and trim(nummerplaat) ~* '^ALL-[0-9]+$'
  $sql$;

  -- Drop any previous constraint with this name to keep migration idempotent.
  execute $sql$
    alter table public.fleet_vehicles
      drop constraint if exists fleet_vehicles_nummerplaat_be_format
  $sql$;

  -- Allow NULL/empty; otherwise enforce `digit-AAA-999` with digit 1..9.
  execute $sql$
    alter table public.fleet_vehicles
      add constraint fleet_vehicles_nummerplaat_be_format
      check (
        nummerplaat is null
        or btrim(nummerplaat) = ''
        or upper(btrim(nummerplaat)) ~ '^[1-9]-[A-Z]{3}-[0-9]{3}$'
      )
  $sql$;
end $$;

