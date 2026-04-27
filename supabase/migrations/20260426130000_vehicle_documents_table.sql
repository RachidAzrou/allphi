-- Vehicle documents (per VIN) + RLS for own vehicle / fleet roles.
-- Note: this repo previously referenced vehicle_documents in v_fleet_assistant_context
-- but did not define the table in migrations. This migration is idempotent and
-- safe if the table already exists.

create table if not exists public.vehicle_documents (
  id uuid primary key default gen_random_uuid(),
  voertuig_vin text not null,
  document_type text not null,
  document_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure expected columns exist even when the table pre-existed.
alter table public.vehicle_documents
  add column if not exists id uuid,
  add column if not exists voertuig_vin text,
  add column if not exists document_type text,
  add column if not exists document_url text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

-- Backfill defaults where possible (only when columns exist and are null).
update public.vehicle_documents
set
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where created_at is null or updated_at is null;

-- PK/default for id (only if not already present).
do $$
begin
  -- Default id generator
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'vehicle_documents'
      and column_name = 'id'
      and column_default is null
  ) then
    alter table public.vehicle_documents
      alter column id set default gen_random_uuid();
  end if;

  -- Primary key constraint
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.vehicle_documents'::regclass
      and contype = 'p'
  ) then
    alter table public.vehicle_documents
      add constraint vehicle_documents_pkey primary key (id);
  end if;
end $$;

create index if not exists vehicle_documents_voertuig_vin_idx
  on public.vehicle_documents (voertuig_vin);

-- Enforce idempotent seeding / one row per (VIN, type).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.vehicle_documents'::regclass
      and conname = 'vehicle_documents_vin_type_unique'
  ) then
    alter table public.vehicle_documents
      add constraint vehicle_documents_vin_type_unique
      unique (voertuig_vin, document_type);
  end if;
end $$;

create or replace function public.touch_vehicle_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists vehicle_documents_touch_updated on public.vehicle_documents;
create trigger vehicle_documents_touch_updated
  before update on public.vehicle_documents
  for each row
  execute function public.touch_vehicle_documents_updated_at();

alter table public.vehicle_documents enable row level security;

-- Read for own vehicle docs or fleet/management.
drop policy if exists "vehicle_documents_select_own_or_fleet" on public.vehicle_documents;
create policy "vehicle_documents_select_own_or_fleet"
  on public.vehicle_documents
  for select
  to authenticated
  using (
    public.is_fleet_or_management()
    or exists (
      select 1
      from public.fleet_vehicles fv
      where fv.vin::text = voertuig_vin
        and fv.medewerker_id = public.current_medewerker_id()
    )
  );

grant select on table public.vehicle_documents to authenticated;

