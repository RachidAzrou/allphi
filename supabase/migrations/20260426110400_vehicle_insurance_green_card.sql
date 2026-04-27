-- Add green card fields to vehicle_insurance (required) and expose in context view.

alter table public.vehicle_insurance
  add column if not exists green_card_number text,
  add column if not exists green_card_valid_from date,
  add column if not exists green_card_valid_to date;

-- Backfill existing rows (so we can enforce NOT NULL safely).
update public.vehicle_insurance
set
  green_card_number = case
    when trim(coalesce(green_card_number, '')) = '' then ''
    when trim(upper(green_card_number)) = 'UNKNOWN' then ''
    else green_card_number
  end,
  green_card_valid_from = coalesce(green_card_valid_from, current_date),
  green_card_valid_to = coalesce(green_card_valid_to, (current_date + interval '1 year')::date)
where
  green_card_number is null
  or trim(green_card_number) = ''
  or trim(upper(green_card_number)) = 'UNKNOWN'
  or green_card_valid_from is null
  or green_card_valid_to is null;

-- Enforce date logic (idempotent via DO block because ADD CONSTRAINT has no IF NOT EXISTS).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.vehicle_insurance'::regclass
      and conname = 'vehicle_insurance_green_card_dates_chk'
  ) then
    alter table public.vehicle_insurance
      add constraint vehicle_insurance_green_card_dates_chk
      check (green_card_valid_to >= green_card_valid_from);
  end if;
end $$;

-- Require all insurance rows to have a green card.
alter table public.vehicle_insurance
  alter column green_card_number set not null,
  alter column green_card_valid_from set not null,
  alter column green_card_valid_to set not null;

