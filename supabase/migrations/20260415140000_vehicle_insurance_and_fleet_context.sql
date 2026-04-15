-- Vehicle insurance profile (per VIN) + expose in v_fleet_assistant_context

create table if not exists public.vehicle_insurance (
  voertuig_vin text primary key,
  insurance_company text,
  policy_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_vehicle_insurance_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists vehicle_insurance_touch_updated on public.vehicle_insurance;
create trigger vehicle_insurance_touch_updated
  before update on public.vehicle_insurance
  for each row
  execute function public.touch_vehicle_insurance_updated_at();

alter table public.vehicle_insurance enable row level security;

-- Read-only for authenticated users (prefill in the app).
drop policy if exists "vehicle_insurance_read" on public.vehicle_insurance;
create policy "vehicle_insurance_read"
  on public.vehicle_insurance
  for select
  to authenticated
  using (true);

grant select on public.vehicle_insurance to authenticated;

-- Enforce unique policy number per company (skip null/empty).
create unique index if not exists vehicle_insurance_company_policy_unique
on public.vehicle_insurance (insurance_company, policy_number)
where policy_number is not null and policy_number <> '';

-- Seed default insurer for all known vehicles (only when empty).
insert into public.vehicle_insurance (voertuig_vin, insurance_company)
select fv.vin::text, 'P&V'
from public.fleet_vehicles fv
where fv.vin is not null
on conflict (voertuig_vin) do update
set insurance_company = excluded.insurance_company
where public.vehicle_insurance.insurance_company is null
   or public.vehicle_insurance.insurance_company = '';

-- Extend fleet assistant context with insurance info (if present).
create or replace view public.v_fleet_assistant_context as
select
  m.id as medewerker_id,
  m.voornaam,
  m.naam,
  m.emailadres,
  fv.vin,
  fv.nummerplaat,
  fv.afleverdatum,
  fv.contracteinddatum,
  fv.leasingmaatschappij,
  fv.categorie as wagen_categorie,
  fv.catalog_id,
  vc.brand,
  vc.edition,
  vc.merk_model,
  vc.aandrijving,
  vc.range_km,
  vc.cat_a,
  vc.cat_b,
  vc.cat_c,
  vc.optiebudget_a,
  vc.optiebudget_b,
  vc.optiebudget_c,
  vct.contract_id,
  vct.tco_plafond,
  vct.optiebudget,
  vct.goedkeuringsstatus,
  vd.document_type,
  vd.document_url,
  vi.insurance_company,
  vi.policy_number
from medewerkers m
  join fleet_vehicles fv on fv.medewerker_id = m.id
  join vehicle_catalog vc on fv.catalog_id = vc.catalog_id
  left join vehicle_contracts vct on vct.voertuig_vin::text = fv.vin::text
  left join vehicle_documents vd on vd.voertuig_vin::text = fv.vin::text
  left join vehicle_insurance vi on vi.voertuig_vin::text = fv.vin::text;

