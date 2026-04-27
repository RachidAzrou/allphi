-- Extend accident reports with medewerker linkage + multi-device join + PDF output.
-- Add separate medewerker profile extras for missing Crashform fields.

-- ──────────────────────────────────────────────
-- medewerker_profiel_extra
-- ──────────────────────────────────────────────

create table if not exists public.medewerker_profiel_extra (
  medewerker_id bigint primary key references public.medewerkers (id) on delete cascade,
  geboortedatum date,
  straat text,
  huisnummer text,
  bus text,
  postcode text,
  stad text,
  land text not null default 'België',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_medewerker_profiel_extra_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists medewerker_profiel_extra_touch_updated on public.medewerker_profiel_extra;
create trigger medewerker_profiel_extra_touch_updated
  before update on public.medewerker_profiel_extra
  for each row
  execute function public.touch_medewerker_profiel_extra_updated_at();

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

alter table public.medewerker_profiel_extra enable row level security;

drop policy if exists "medewerker_profiel_extra_own" on public.medewerker_profiel_extra;
create policy "medewerker_profiel_extra_own"
  on public.medewerker_profiel_extra
  for all
  to authenticated
  using (medewerker_id = public.current_medewerker_id())
  with check (medewerker_id = public.current_medewerker_id());

grant select, insert, update, delete
  on table public.medewerker_profiel_extra
  to authenticated;

-- ──────────────────────────────────────────────
-- ongeval_aangiften extensions
-- ──────────────────────────────────────────────

alter table public.ongeval_aangiften
  add column if not exists medewerker_id bigint references public.medewerkers (id),
  add column if not exists join_secret text,
  add column if not exists join_role text check (join_role in ('A', 'B')),
  add column if not exists pdf_path text,
  add column if not exists completed_at timestamptz;

-- Expand status values to include completed.
do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'ongeval_aangiften_status_check'
  ) then
    alter table public.ongeval_aangiften
      drop constraint ongeval_aangiften_status_check;
  end if;
exception when undefined_table then
  null;
end $$;

alter table public.ongeval_aangiften
  add constraint ongeval_aangiften_status_check
  check (status in ('draft', 'submitted', 'completed'));

create index if not exists ongeval_aangiften_medewerker_updated
  on public.ongeval_aangiften (medewerker_id, updated_at desc);

