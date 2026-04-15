-- Single-company profile used to prefill policyholder (company) fields in the accident wizard.

create table if not exists public.company_profile (
  id bigint generated always as identity primary key,
  name text not null,
  contact_first_name text,
  enterprise_number text,
  street text,
  house_number text,
  box text,
  postal_code text,
  city text,
  country text not null default 'Belgium',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_company_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists company_profile_touch_updated on public.company_profile;
create trigger company_profile_touch_updated
  before update on public.company_profile
  for each row
  execute function public.touch_company_profile_updated_at();

alter table public.company_profile enable row level security;

drop policy if exists "company_profile_read" on public.company_profile;
create policy "company_profile_read"
  on public.company_profile
  for select
  to authenticated
  using (true);

grant select on public.company_profile to authenticated;

-- Seed ALLPHI NV (only if table is empty)
insert into public.company_profile
  (name, street, house_number, postal_code, city, country, enterprise_number)
select
  'ALLPHI NV',
  'Nijverheidsstraat',
  '13',
  '2260',
  'Oevel',
  'Belgium',
  '0838576480'
where not exists (select 1 from public.company_profile);

