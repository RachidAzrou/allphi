-- Fleet manager notifications: track unread accident reports.
-- We keep the state on the report row so UI can show a "red dot".

alter table public.ongeval_aangiften
  add column if not exists fleet_unread boolean not null default true,
  add column if not exists fleet_read_at timestamptz;

-- Security-definer helper to mark a report as read for fleet/management.
create or replace function public.fleet_mark_ongeval_read(rid uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not public.is_fleet_or_management() then
    raise exception 'forbidden';
  end if;

  update public.ongeval_aangiften
  set fleet_unread = false,
      fleet_read_at = now()
  where id = rid;
end;
$$;

grant execute on function public.fleet_mark_ongeval_read(uuid) to authenticated;

