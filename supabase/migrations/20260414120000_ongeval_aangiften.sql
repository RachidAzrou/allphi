-- Draft/submitted European-style accident reports per user (wizard payload in JSON).

create table if not exists public.ongeval_aangiften (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'submitted')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ongeval_aangiften_user_updated
  on public.ongeval_aangiften (user_id, updated_at desc);

create or replace function public.touch_ongeval_aangiften_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ongeval_aangiften_touch_updated on public.ongeval_aangiften;
create trigger ongeval_aangiften_touch_updated
  before update on public.ongeval_aangiften
  for each row
  execute function public.touch_ongeval_aangiften_updated_at();

alter table public.ongeval_aangiften enable row level security;

drop policy if exists "ongeval_aangiften_own" on public.ongeval_aangiften;
create policy "ongeval_aangiften_own"
  on public.ongeval_aangiften
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on table public.ongeval_aangiften to authenticated;
