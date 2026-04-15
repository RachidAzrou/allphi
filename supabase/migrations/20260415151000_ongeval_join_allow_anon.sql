-- Allow unauthenticated Party B join via QR/link (guest mode).

create or replace function public.ongeval_join_with_secret(rid uuid, secret text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  expected_secret text;
  join_user uuid;
begin
  join_user := auth.uid();

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
    set party_b_user_id = join_user,
        party_b_joined_at = now(),
        join_role = 'B',
        updated_at = now()
  where id = rid;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.ongeval_join_with_secret(uuid, text) to anon, authenticated;

