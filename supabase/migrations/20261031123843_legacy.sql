alter policy "permission_groups_select" on public.permission_groups
  using (company_id is null and auth.uid() is not null);