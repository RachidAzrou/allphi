-- Seed / backfill green_card_number deterministically (based on VIN)
-- and ensure future inserts never keep it empty.

create or replace function public.make_green_card_number(vin text)
returns text
language sql
immutable
as $$
  select 'GC-' || upper(substr(md5(coalesce(vin, '')), 1, 12))
$$;

-- Backfill existing rows where the green card number is empty.
update public.vehicle_insurance
set green_card_number = public.make_green_card_number(voertuig_vin)
where trim(coalesce(green_card_number, '')) = '';

-- Ensure future inserts/updates never store empty string.
create or replace function public.vehicle_insurance_green_card_defaults()
returns trigger
language plpgsql
as $$
begin
  if trim(coalesce(new.green_card_number, '')) = '' then
    new.green_card_number := public.make_green_card_number(new.voertuig_vin);
  end if;

  return new;
end;
$$;

drop trigger if exists vehicle_insurance_green_card_defaults on public.vehicle_insurance;
create trigger vehicle_insurance_green_card_defaults
  before insert or update on public.vehicle_insurance
  for each row
  execute function public.vehicle_insurance_green_card_defaults();

