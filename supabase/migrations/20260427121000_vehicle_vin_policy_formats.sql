-- Enforce/normalize VIN + policy_number + green_card_number formats.
--
-- VIN requirements (user spec):
-- - exactly 17 chars
-- - letters + digits
-- - no I, O, Q
-- Examples: WVWZZZ1JZXW000001, VF1RFB00965432109
--
-- Policy number requirements (user spec):
-- - 6..20 chars
-- - alnum plus separators (common: -, /)
-- Examples: 1234567890, 20260012345, AUTO-12345678, POL-2026-000987, AG123456789, AXA-98-456321
--
-- Green card number:
-- - already seeded deterministically in 20260426112200_seed_green_card_numbers.sql as `GC-...`
-- - here we just normalize and constrain allowed characters (and avoid empty strings).

do $$
begin
  -- Temporarily drop FK that blocks VIN normalization on fleet_vehicles.
  -- Some DBs have `vehicle_insurance(voertuig_vin) -> fleet_vehicles(vin)` without ON UPDATE CASCADE.
  if to_regclass('public.vehicle_insurance') is not null then
    execute $sql$
      alter table public.vehicle_insurance
        drop constraint if exists vehicle_insurance_voertuig_vin_fk
    $sql$;
  end if;

  -- ──────────────────────────────────────────────
  -- Helpers
  -- ──────────────────────────────────────────────
  execute $sql$
    create or replace function public.normalize_vin(v text)
    returns text
    language sql
    immutable
    as $fn$
      select nullif(regexp_replace(upper(trim(coalesce(v, ''))), '[^A-Z0-9]', '', 'g'), '')
    $fn$;
  $sql$;

  execute $sql$
    create or replace function public.is_valid_vin(v text)
    returns boolean
    language sql
    immutable
    as $fn$
      select
        public.normalize_vin(v) is not null
        and length(public.normalize_vin(v)) = 17
        and public.normalize_vin(v) ~ '^[A-HJ-NPR-Z0-9]{17}$'
    $fn$;
  $sql$;

  execute $sql$
    create or replace function public.make_fake_vin(seed text)
    returns text
    language sql
    immutable
    as $fn$
      -- Deterministic 17-char VIN-like value using only 0-9A-F (no I/O/Q possible).
      select upper(substr(md5(coalesce(seed, '')), 1, 17))
    $fn$;
  $sql$;

  execute $sql$
    create or replace function public.normalize_policy_number(v text)
    returns text
    language sql
    immutable
    as $fn$
      select nullif(upper(trim(coalesce(v, ''))), '')
    $fn$;
  $sql$;

  execute $sql$
    create or replace function public.is_valid_policy_number(v text)
    returns boolean
    language sql
    immutable
    as $fn$
      select
        public.normalize_policy_number(v) is not null
        and public.normalize_policy_number(v) ~ '^[A-Z0-9][A-Z0-9\\-/]{5,19}$'
    $fn$;
  $sql$;

  execute $sql$
    create or replace function public.make_policy_number(vin text)
    returns text
    language sql
    immutable
    as $fn$
      -- Deterministic, demo-safe, within 6..20 chars, matches is_valid_policy_number.
      select
        'POL-' ||
        to_char(current_date, 'YYYY') ||
        '-' ||
        upper(substr(md5(coalesce(vin, '')), 1, 6))
    $fn$;
  $sql$;

  execute $sql$
    create or replace function public.vehicle_insurance_policy_defaults()
    returns trigger
    language plpgsql
    as $fn$
    begin
      -- Normalize casing/spacing.
      new.voertuig_vin := public.normalize_vin(new.voertuig_vin);
      new.policy_number := public.normalize_policy_number(new.policy_number);
      new.green_card_number := upper(trim(coalesce(new.green_card_number, '')));

      -- If policy is empty, seed deterministically from VIN.
      if trim(coalesce(new.policy_number, '')) = '' then
        new.policy_number := public.make_policy_number(new.voertuig_vin);
      end if;

      return new;
    end;
    $fn$;
  $sql$;

  if to_regclass('public.vehicle_insurance') is not null then
    execute $sql$
      drop trigger if exists vehicle_insurance_policy_defaults on public.vehicle_insurance;
      create trigger vehicle_insurance_policy_defaults
        before insert or update on public.vehicle_insurance
        for each row
        execute function public.vehicle_insurance_policy_defaults();
    $sql$;
  end if;

  -- ──────────────────────────────────────────────
  -- Normalize existing data (avoid migration failing on constraints)
  -- ──────────────────────────────────────────────
  if to_regclass('public.fleet_vehicles') is not null then
    -- Normalize VIN; if invalid, replace with deterministic fake VIN (column can be NOT NULL).
    execute $sql$
      update public.fleet_vehicles
      set vin = public.normalize_vin(vin)
      where vin is not null
        and trim(vin) <> ''
    $sql$;

    execute $sql$
      update public.fleet_vehicles
      set vin = case
        when public.is_valid_vin(vin) then public.normalize_vin(vin)
        when btrim(coalesce(vin, '')) = '' then public.make_fake_vin('FV-EMPTY-' || coalesce(nummerplaat, ''))
        else public.make_fake_vin(vin)
      end
      where not public.is_valid_vin(vin)
    $sql$;
  end if;

  if to_regclass('public.vehicle_documents') is not null then
    execute $sql$
      update public.vehicle_documents
      set voertuig_vin = public.normalize_vin(voertuig_vin)
      where voertuig_vin is not null
        and trim(voertuig_vin) <> ''
    $sql$;

    execute $sql$
      update public.vehicle_documents
      set voertuig_vin = case
        when public.is_valid_vin(voertuig_vin) then public.normalize_vin(voertuig_vin)
        else public.make_fake_vin(voertuig_vin)
      end
      where voertuig_vin is not null
        and not public.is_valid_vin(voertuig_vin)
    $sql$;
  end if;

  if to_regclass('public.vehicle_insurance') is not null then
    execute $sql$
      update public.vehicle_insurance
      set
        voertuig_vin = case
          when public.is_valid_vin(voertuig_vin) then public.normalize_vin(voertuig_vin)
          else public.make_fake_vin(voertuig_vin)
        end,
        policy_number = public.normalize_policy_number(policy_number),
        green_card_number = upper(trim(coalesce(green_card_number, '')))
      where true
    $sql$;

    -- After normalization/fake VIN replacement, invalid VINs should not remain.

    -- Seed missing/empty policy numbers.
    execute $sql$
      update public.vehicle_insurance
      set policy_number = public.make_policy_number(voertuig_vin)
      where trim(coalesce(policy_number, '')) = ''
    $sql$;
  end if;

  -- ──────────────────────────────────────────────
  -- Constraints
  -- ──────────────────────────────────────────────
  if to_regclass('public.fleet_vehicles') is not null then
    execute $sql$
      alter table public.fleet_vehicles
        drop constraint if exists fleet_vehicles_vin_format_chk
    $sql$;
    execute $sql$
      alter table public.fleet_vehicles
        add constraint fleet_vehicles_vin_format_chk
        check (
          vin is null
          or btrim(vin) = ''
          or public.is_valid_vin(vin)
        )
    $sql$;
  end if;

  if to_regclass('public.vehicle_documents') is not null then
    execute $sql$
      alter table public.vehicle_documents
        drop constraint if exists vehicle_documents_vin_format_chk
    $sql$;
    execute $sql$
      alter table public.vehicle_documents
        add constraint vehicle_documents_vin_format_chk
        check (public.is_valid_vin(voertuig_vin))
    $sql$;
  end if;

  if to_regclass('public.vehicle_insurance') is not null then
    execute $sql$
      alter table public.vehicle_insurance
        drop constraint if exists vehicle_insurance_vin_format_chk
    $sql$;
    execute $sql$
      alter table public.vehicle_insurance
        add constraint vehicle_insurance_vin_format_chk
        check (public.is_valid_vin(voertuig_vin))
    $sql$;

    execute $sql$
      alter table public.vehicle_insurance
        drop constraint if exists vehicle_insurance_policy_number_format_chk
    $sql$;
    execute $sql$
      alter table public.vehicle_insurance
        add constraint vehicle_insurance_policy_number_format_chk
        check (
          policy_number is null
          or btrim(policy_number) = ''
          or public.is_valid_policy_number(policy_number)
        )
    $sql$;

    -- Keep green_card_number flexible but safe: allow A-Z0-9 plus - and /, 4..32.
    execute $sql$
      alter table public.vehicle_insurance
        drop constraint if exists vehicle_insurance_green_card_number_format_chk
    $sql$;
    execute $sql$
      alter table public.vehicle_insurance
        add constraint vehicle_insurance_green_card_number_format_chk
        check (
          green_card_number is not null
          and upper(trim(green_card_number)) ~ '^[A-Z0-9][A-Z0-9\\-/]{3,31}$'
        )
    $sql$;
  end if;

  -- Re-add FK with ON UPDATE CASCADE (so future VIN normalization is safe).
  if to_regclass('public.vehicle_insurance') is not null
     and to_regclass('public.fleet_vehicles') is not null
  then
    if not exists (
      select 1
      from pg_constraint
      where conrelid = 'public.vehicle_insurance'::regclass
        and conname = 'vehicle_insurance_voertuig_vin_fk'
    ) then
      execute $sql$
        alter table public.vehicle_insurance
          add constraint vehicle_insurance_voertuig_vin_fk
          foreign key (voertuig_vin)
          references public.fleet_vehicles (vin)
          on update cascade
          on delete set null
      $sql$;
    end if;
  end if;
end $$;

