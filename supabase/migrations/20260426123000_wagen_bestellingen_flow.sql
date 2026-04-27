-- New car ordering flow: drafts, approvals, documents and uploads.

-- ──────────────────────────────────────────────
-- Roles (minimal, backwards-compatible)
-- ──────────────────────────────────────────────
alter table public.medewerkers
  add column if not exists role text
    not null default 'medewerker'
    check (role in ('medewerker', 'fleet_manager', 'management'));

create or replace function public.is_fleet_or_management()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.medewerkers m
    where m.id = public.current_medewerker_id()
      and m.role in ('fleet_manager', 'management')
  )
$$;

-- ──────────────────────────────────────────────
-- company_profile config (single-tenant)
-- ──────────────────────────────────────────────
alter table public.company_profile
  add column if not exists car_order_overspend_threshold_eur numeric not null default 3000;

-- ──────────────────────────────────────────────
-- wagen_bestellingen
-- ──────────────────────────────────────────────
create table if not exists public.wagen_bestellingen (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  medewerker_id bigint references public.medewerkers (id),
  status text not null default 'draft'
    check (status in (
      'draft',
      'submitted',
      'approved',
      'rejected',
      'ordered',
      'delivered'
    )),
  payload jsonb not null default '{}'::jsonb,

  -- Offer + checks
  offer_storage_path text,
  offer_uploaded_at timestamptz,
  offer_validation jsonb,
  overspend_amount_eur numeric,
  personal_contribution_amount_eur numeric,

  -- Contribution doc (generated + signed)
  contribution_doc_path text,
  contribution_doc_generated_at timestamptz,
  contribution_signed_at timestamptz,
  contribution_signature jsonb,

  -- Approvals
  fleet_approved_at timestamptz,
  fleet_approved_by uuid references auth.users (id),
  management_approved_at timestamptz,
  management_approved_by uuid references auth.users (id),
  approval_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wagen_bestellingen_user_updated
  on public.wagen_bestellingen (user_id, updated_at desc);

create index if not exists wagen_bestellingen_medewerker_updated
  on public.wagen_bestellingen (medewerker_id, updated_at desc);

create or replace function public.touch_wagen_bestellingen_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists wagen_bestellingen_touch_updated on public.wagen_bestellingen;
create trigger wagen_bestellingen_touch_updated
  before update on public.wagen_bestellingen
  for each row
  execute function public.touch_wagen_bestellingen_updated_at();

alter table public.wagen_bestellingen enable row level security;

-- Employees can manage their own rows.
drop policy if exists "wagen_bestellingen_own" on public.wagen_bestellingen;
create policy "wagen_bestellingen_own"
  on public.wagen_bestellingen
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Fleet/management can read all for approvals.
drop policy if exists "wagen_bestellingen_fleet_read" on public.wagen_bestellingen;
create policy "wagen_bestellingen_fleet_read"
  on public.wagen_bestellingen
  for select
  to authenticated
  using (public.is_fleet_or_management());

grant select, insert, update, delete on table public.wagen_bestellingen to authenticated;

-- ──────────────────────────────────────────────
-- wagen_bestelling_events (audit trail)
-- ──────────────────────────────────────────────
create table if not exists public.wagen_bestelling_events (
  id bigint generated always as identity primary key,
  bestelling_id uuid not null references public.wagen_bestellingen (id) on delete cascade,
  actor_user_id uuid references auth.users (id),
  type text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists wagen_bestelling_events_bestelling_created
  on public.wagen_bestelling_events (bestelling_id, created_at desc);

alter table public.wagen_bestelling_events enable row level security;

drop policy if exists "wagen_bestelling_events_own_or_fleet" on public.wagen_bestelling_events;
create policy "wagen_bestelling_events_own_or_fleet"
  on public.wagen_bestelling_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.wagen_bestellingen wb
      where wb.id = bestelling_id
        and (wb.user_id = auth.uid() or public.is_fleet_or_management())
    )
  );

drop policy if exists "wagen_bestelling_events_insert_own" on public.wagen_bestelling_events;
create policy "wagen_bestelling_events_insert_own"
  on public.wagen_bestelling_events
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.wagen_bestellingen wb
      where wb.id = bestelling_id
        and wb.user_id = auth.uid()
    )
  );

grant select, insert on table public.wagen_bestelling_events to authenticated;

-- ──────────────────────────────────────────────
-- Storage buckets + RLS
-- ──────────────────────────────────────────────
-- Layout:
--   wagen-offertes/{user_id}/{bestelling_id}/offerte.*
--   wagen-bijdrage-docs/{user_id}/{bestelling_id}/bijdrage.pdf

insert into storage.buckets (id, name, public)
values ('wagen-offertes', 'wagen-offertes', false)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('wagen-bijdrage-docs', 'wagen-bijdrage-docs', false)
on conflict (id) do update set public = excluded.public;

-- Helper predicate for storage object name ownership: first segment is user_id.
-- We keep this inline in policies (same as ongeval-scans).

-- wagen-offertes policies
drop policy if exists "wagen_offertes_insert_own" on storage.objects;
create policy "wagen_offertes_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'wagen-offertes'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "wagen_offertes_update_own" on storage.objects;
create policy "wagen_offertes_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'wagen-offertes'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'wagen-offertes'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "wagen_offertes_select_own_or_fleet" on storage.objects;
create policy "wagen_offertes_select_own_or_fleet"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'wagen-offertes'
    and (
      split_part(name, '/', 1) = auth.uid()::text
      or public.is_fleet_or_management()
    )
  );

drop policy if exists "wagen_offertes_delete_own" on storage.objects;
create policy "wagen_offertes_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'wagen-offertes'
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- wagen-bijdrage-docs policies
drop policy if exists "wagen_bijdrage_docs_insert_own" on storage.objects;
create policy "wagen_bijdrage_docs_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'wagen-bijdrage-docs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "wagen_bijdrage_docs_update_own" on storage.objects;
create policy "wagen_bijdrage_docs_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'wagen-bijdrage-docs'
    and split_part(name, '/', 1) = auth.uid()::text
  )
  with check (
    bucket_id = 'wagen-bijdrage-docs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

drop policy if exists "wagen_bijdrage_docs_select_own_or_fleet" on storage.objects;
create policy "wagen_bijdrage_docs_select_own_or_fleet"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'wagen-bijdrage-docs'
    and (
      split_part(name, '/', 1) = auth.uid()::text
      or public.is_fleet_or_management()
    )
  );

drop policy if exists "wagen_bijdrage_docs_delete_own" on storage.objects;
create policy "wagen_bijdrage_docs_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'wagen-bijdrage-docs'
    and split_part(name, '/', 1) = auth.uid()::text
  );

