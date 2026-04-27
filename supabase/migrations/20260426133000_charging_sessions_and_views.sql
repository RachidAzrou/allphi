-- Charging sessions (EV) + overview views.
-- Note: the app queries public.v_charging_sessions_overview but this repo did not
-- define it in migrations. This migration is idempotent and safe when objects
-- already exist.

-- Ensure helper exists (used by RLS policies).
-- Map authenticated user email → medewerker id (for RLS policies).
create or replace function public.current_medewerker_id()
returns bigint
language sql
stable
as $$
  select m.id
  from public.medewerkers m
  where lower(m.emailadres) = lower((auth.jwt() ->> 'email'))
  limit 1
$$;

-- ──────────────────────────────────────────────
-- charging_sessions
-- ──────────────────────────────────────────────
create table if not exists public.charging_sessions (
  sessie_id uuid primary key default gen_random_uuid(),
  medewerker_id bigint not null references public.medewerkers (id) on delete cascade,
  voertuig_vin text,
  laadpas_id text,
  charging_point_id text,
  datumtijd_start timestamptz not null,
  datumtijd_einde timestamptz,
  kwh numeric not null default 0,
  kost_eur numeric not null default 0,
  locatie_type text not null default 'onbekend',
  terugbetaald boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure expected columns exist even when the table pre-existed.
alter table public.charging_sessions
  add column if not exists sessie_id uuid,
  add column if not exists medewerker_id bigint,
  add column if not exists voertuig_vin text,
  add column if not exists laadpas_id text,
  add column if not exists charging_point_id text,
  add column if not exists datumtijd_start timestamptz,
  add column if not exists datumtijd_einde timestamptz,
  add column if not exists kwh numeric,
  add column if not exists kost_eur numeric,
  add column if not exists locatie_type text,
  add column if not exists terugbetaald boolean,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

-- Backfill defaults where possible (only when columns exist and are null).
update public.charging_sessions
set
  kwh = coalesce(kwh, 0),
  kost_eur = coalesce(kost_eur, 0),
  locatie_type = coalesce(nullif(locatie_type, ''), 'onbekend'),
  terugbetaald = coalesce(terugbetaald, false),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where
  kwh is null
  or kost_eur is null
  or locatie_type is null
  or locatie_type = ''
  or terugbetaald is null
  or created_at is null
  or updated_at is null;

create index if not exists charging_sessions_medewerker_start_idx
  on public.charging_sessions (medewerker_id, datumtijd_start desc);

create index if not exists charging_sessions_vin_start_idx
  on public.charging_sessions (voertuig_vin, datumtijd_start desc);

create or replace function public.touch_charging_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists charging_sessions_touch_updated on public.charging_sessions;
create trigger charging_sessions_touch_updated
  before update on public.charging_sessions
  for each row
  execute function public.touch_charging_sessions_updated_at();

alter table public.charging_sessions enable row level security;

-- Own reads by medewerker linkage (email → medewerker via current_medewerker_id()).
drop policy if exists "charging_sessions_select_own" on public.charging_sessions;
create policy "charging_sessions_select_own"
  on public.charging_sessions
  for select
  to authenticated
  using (medewerker_id = public.current_medewerker_id());

-- Fleet/management can read all.
drop policy if exists "charging_sessions_select_fleet" on public.charging_sessions;
create policy "charging_sessions_select_fleet"
  on public.charging_sessions
  for select
  to authenticated
  using (public.is_fleet_or_management());

grant select on table public.charging_sessions to authenticated;

-- ──────────────────────────────────────────────
-- v_charging_sessions_overview
-- ──────────────────────────────────────────────
create or replace view public.v_charging_sessions_overview as
select
  cs.sessie_id::text as sessie_id,
  cs.datumtijd_start,
  cs.datumtijd_einde,
  cs.kwh::numeric as kwh,
  cs.kost_eur::numeric as kost_eur,
  cs.locatie_type,
  cs.terugbetaald,
  cs.laadpas_id,
  cs.charging_point_id,
  m.id as medewerker_id,
  m.voornaam,
  m.naam,
  m.emailadres,
  fv.vin,
  fv.nummerplaat,
  vc.merk_model,
  vc.aandrijving
from public.charging_sessions cs
  join public.medewerkers m on m.id = cs.medewerker_id
  left join public.fleet_vehicles fv on fv.vin::text = cs.voertuig_vin::text
  left join public.vehicle_catalog vc on vc.catalog_id = fv.catalog_id;

grant select on table public.v_charging_sessions_overview to authenticated;

-- ──────────────────────────────────────────────
-- v_fleet_charging_monthly_overview (for dashboarding)
-- ──────────────────────────────────────────────
create or replace view public.v_fleet_charging_monthly_overview as
select
  date_trunc('month', cs.datumtijd_start)::date as maand,
  cs.medewerker_id,
  m.voornaam,
  m.naam,
  m.emailadres,
  cs.locatie_type,
  count(*)::int as aantal_sessies,
  round(sum(coalesce(cs.kwh, 0))::numeric, 2) as totaal_kwh,
  round(sum(coalesce(cs.kost_eur, 0))::numeric, 2) as totaal_kost,
  round(sum(case when cs.terugbetaald then 0 else coalesce(cs.kost_eur, 0) end)::numeric, 2) as open_kost
from public.charging_sessions cs
  join public.medewerkers m on m.id = cs.medewerker_id
group by 1, 2, 3, 4, 5, 6;

grant select on table public.v_fleet_charging_monthly_overview to authenticated;

