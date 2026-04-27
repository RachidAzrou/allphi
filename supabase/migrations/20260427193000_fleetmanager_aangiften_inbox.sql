-- Fleet manager inbox for accident reports (ongeval_aangiften).
-- Allow fleet_manager/management to list submitted reports in-app.

alter table public.ongeval_aangiften enable row level security;

drop policy if exists "ongeval_aangiften_fleet_select" on public.ongeval_aangiften;
create policy "ongeval_aangiften_fleet_select"
  on public.ongeval_aangiften
  for select
  to authenticated
  using (
    public.is_fleet_or_management()
    and status in ('submitted', 'completed')
  );

