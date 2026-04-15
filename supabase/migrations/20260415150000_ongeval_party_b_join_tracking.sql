-- Track when Party B successfully joins a report, and provide a secure join RPC.

alter table public.ongeval_aangiften
  add column if not exists party_b_user_id uuid references auth.users (id),
  add column if not exists party_b_joined_at timestamptz;

create or replace function public.ongeval_join_with_secret(rid uuid, secret text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_secret text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select oa.join_secret
    into expected_secret
  from public.ongeval_aangiften oa
  where oa.id = rid
  limit 1;

  if expected_secret is null then
    raise exception 'not_found';
  end if;

  if expected_secret <> secret then
    raise exception 'invalid_secret';
  end if;

  update public.ongeval_aangiften
    set party_b_user_id = auth.uid(),
        party_b_joined_at = now(),
        join_role = 'B',
        updated_at = now()
  where id = rid;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.ongeval_join_with_secret(uuid, text) to authenticated;

