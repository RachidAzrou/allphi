-- Fleet manager inbox: roles normalization + chat message sender + RLS.
-- Goal: fleet/management can access escalated threads and post manual replies
-- as "fleet_manager" messages (visually distinct in UI).

-- ──────────────────────────────────────────────
-- Normalize medewerker role column naming (role vs rol)
-- Some parts of the codebase and policies use `rol`, others use `role`.
-- We keep both and sync them.
-- ──────────────────────────────────────────────
alter table public.medewerkers
  add column if not exists role text;

alter table public.medewerkers
  add column if not exists rol text;

-- Backfill missing values (prefer non-null value when only one is set).
update public.medewerkers
set role = coalesce(role, rol)
where role is null and rol is not null;

update public.medewerkers
set rol = coalesce(rol, role)
where rol is null and role is not null;

-- Normalize common legacy values into canonical roles.
-- We only normalize when values clearly map to one of the supported roles.
update public.medewerkers
set role = 'fleet_manager'
where role is not null
  and lower(trim(role)) in ('fleet', 'fleetmanager', 'fleet_manager', 'fleet manager', 'fleet-management', 'fleetmanagement');

update public.medewerkers
set rol = 'fleet_manager'
where rol is not null
  and lower(trim(rol)) in ('fleet', 'fleetmanager', 'fleet_manager', 'fleet manager', 'fleet-management', 'fleetmanagement');

update public.medewerkers
set role = 'management'
where role is not null
  and lower(trim(role)) in ('mgmt', 'management', 'admin', 'administrator', 'beheer', 'beheerder', 'superadmin');

update public.medewerkers
set rol = 'management'
where rol is not null
  and lower(trim(rol)) in ('mgmt', 'management', 'admin', 'administrator', 'beheer', 'beheerder', 'superadmin');

update public.medewerkers
set role = 'medewerker'
where role is not null
  and lower(trim(role)) in ('employee', 'medewerker', 'user', 'gebruiker');

update public.medewerkers
set rol = 'medewerker'
where rol is not null
  and lower(trim(rol)) in ('employee', 'medewerker', 'user', 'gebruiker');

-- Keep allowed values consistent (idempotent best-effort).
-- Important: we constrain `role` (canonical) but keep `rol` as legacy/free-form,
-- since existing data may contain values we don't recognize.
do $$
begin
  begin
    alter table public.medewerkers
      drop constraint if exists medewerkers_role_check;
  exception when undefined_object then
    null;
  end;

  alter table public.medewerkers
    add constraint medewerkers_role_check
      check (role is null or role in ('medewerker', 'fleet_manager', 'management'));
end $$;

-- Trigger to keep both columns in sync on insert/update.
create or replace function public.sync_medewerkers_role_columns()
returns trigger
language plpgsql
as $$
begin
  if new.role is null and new.rol is not null then
    new.role := new.rol;
  elsif new.rol is null and new.role is not null then
    new.rol := new.role;
  end if;

  -- Normalize to supported roles whenever possible.
  if new.role is not null then
    if lower(trim(new.role)) in ('fleet', 'fleetmanager', 'fleet_manager', 'fleet manager', 'fleet-management', 'fleetmanagement') then
      new.role := 'fleet_manager';
    elsif lower(trim(new.role)) in ('mgmt', 'management', 'admin', 'administrator', 'beheer', 'beheerder', 'superadmin') then
      new.role := 'management';
    elsif lower(trim(new.role)) in ('employee', 'medewerker', 'user', 'gebruiker') then
      new.role := 'medewerker';
    end if;
  end if;

  if new.rol is null and new.role is not null then
    new.rol := new.role;
  end if;

  return new;
end;
$$;

drop trigger if exists medewerkers_sync_role_columns on public.medewerkers;
create trigger medewerkers_sync_role_columns
  before insert or update on public.medewerkers
  for each row
  execute function public.sync_medewerkers_role_columns();

-- Update helper to be resilient to either column.
create or replace function public.is_fleet_or_management()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.medewerkers m
    where m.id = public.current_medewerker_id()
      and coalesce(m.role, m.rol) in ('fleet_manager', 'management')
  )
$$;

-- ──────────────────────────────────────────────
-- Chat: add fleet_manager as sender role
-- ──────────────────────────────────────────────
do $$
begin
  -- Default naming for the inline check is usually `chat_messages_role_check`.
  begin
    alter table public.chat_messages
      drop constraint if exists chat_messages_role_check;
  exception when undefined_object then
    null;
  end;

  alter table public.chat_messages
    add constraint chat_messages_role_check
      check (role in ('user', 'assistant', 'fleet_manager'));
end $$;

-- ──────────────────────────────────────────────
-- RLS: fleet/management can read escalated threads and post manual replies
-- We keep the existing "own" policies and add additional, scoped policies.
-- Scope: only conversations that are linked from fleet_escalations.
-- ──────────────────────────────────────────────

-- Conversations: fleet can select escalated conversations.
drop policy if exists "chat_conversations_fleet_escalated_select" on public.chat_conversations;
create policy "chat_conversations_fleet_escalated_select"
  on public.chat_conversations
  for select
  to authenticated
  using (
    public.is_fleet_or_management()
    and exists (
      select 1
      from public.fleet_escalations fe
      where fe.conversation_id = chat_conversations.id
    )
  );

-- Messages: fleet can select messages for escalated conversations.
drop policy if exists "chat_messages_fleet_escalated_select" on public.chat_messages;
create policy "chat_messages_fleet_escalated_select"
  on public.chat_messages
  for select
  to authenticated
  using (
    public.is_fleet_or_management()
    and exists (
      select 1
      from public.fleet_escalations fe
      where fe.conversation_id = chat_messages.conversation_id
    )
  );

-- Messages: fleet can insert only fleet_manager messages into escalated conversations.
drop policy if exists "chat_messages_fleet_escalated_insert" on public.chat_messages;
create policy "chat_messages_fleet_escalated_insert"
  on public.chat_messages
  for insert
  to authenticated
  with check (
    public.is_fleet_or_management()
    and role = 'fleet_manager'
    and exists (
      select 1
      from public.fleet_escalations fe
      where fe.conversation_id = chat_messages.conversation_id
    )
  );

-- Fleet escalations: fleet/management can select all escalations.
drop policy if exists "fleet_escalations_fleet_select" on public.fleet_escalations;
create policy "fleet_escalations_fleet_select"
  on public.fleet_escalations
  for select
  to authenticated
  using (public.is_fleet_or_management());

-- Fleet escalations: fleet/management can update escalation status/assignment fields.
drop policy if exists "fleet_escalations_fleet_update" on public.fleet_escalations;
create policy "fleet_escalations_fleet_update"
  on public.fleet_escalations
  for update
  to authenticated
  using (public.is_fleet_or_management())
  with check (public.is_fleet_or_management());

