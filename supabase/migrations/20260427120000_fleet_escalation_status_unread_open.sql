-- fleet_escalations: duidelijk statusmodel voor fleet manager
-- unread = nieuw/ongelezen, open = gelezen/nog te behandelen, resolved = afgehandeld
-- (vervangt legacy queued/sending/sent/failed)

do $$
declare
  cname text;
begin
  for cname in
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    where t.relname = 'fleet_escalations'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format('alter table public.fleet_escalations drop constraint %I', cname);
  end loop;
end$$;

-- legacy → nieuwe waarden
update public.fleet_escalations
set status = 'unread'
where status in ('queued');

update public.fleet_escalations
set status = 'open'
where status in ('sending', 'sent', 'failed');

-- resolved blijft

alter table public.fleet_escalations
  add constraint fleet_escalations_status_check
  check (status in ('unread', 'open', 'resolved'));

alter table public.fleet_escalations
  alter column status set default 'unread';
