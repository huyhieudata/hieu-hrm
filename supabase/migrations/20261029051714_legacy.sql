create policy "company_members_platform_select" on public.company_members
  for select to authenticated using (public.is_platform_admin());