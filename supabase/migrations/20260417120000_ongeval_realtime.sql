-- Enable Supabase realtime for ongeval_aangiften so Partij A can react to
-- Partij B joining (party_b_joined_at) and live wizard-payload updates from
-- the other device.

do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
end $$;

alter table public.ongeval_aangiften replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ongeval_aangiften'
  ) then
    alter publication supabase_realtime add table public.ongeval_aangiften;
  end if;
end $$;

-- RPC voor guest (partij B) die de payload kan ophalen met join-secret, zodat
-- de PDF-route ook voor niet-ingelogde Partij B werkt.
create or replace function public.ongeval_fetch_with_secret(rid uuid, secret text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row_payload jsonb;
  expected_secret text;
begin
  select oa.join_secret, oa.payload
    into expected_secret, row_payload
  from public.ongeval_aangiften oa
  where oa.id = rid
  limit 1;

  if expected_secret is null then
    raise exception 'not_found';
  end if;
  if expected_secret <> secret then
    raise exception 'invalid_secret';
  end if;

  return row_payload;
end;
$$;

grant execute on function public.ongeval_fetch_with_secret(uuid, text) to anon, authenticated;
