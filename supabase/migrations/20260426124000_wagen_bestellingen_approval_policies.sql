-- Allow fleet/management to update orders for approval lifecycle.

alter table public.wagen_bestellingen enable row level security;

drop policy if exists "wagen_bestellingen_fleet_update" on public.wagen_bestellingen;
create policy "wagen_bestellingen_fleet_update"
  on public.wagen_bestellingen
  for update
  to authenticated
  using (public.is_fleet_or_management())
  with check (public.is_fleet_or_management());

