alter policy "invites_select_managers" on public.company_invites
  using (
    public.has_company_role(company_id, array['owner','admin','hr'])
    or public.has_permission(company_id, 'members.invite')
    or public.has_permission(company_id, 'members.manage')
  );

alter policy "company_role_permissions_select" on public.company_role_permissions
  using (public.has_company_role(company_id, array['owner','admin','hr']) or public.is_platform_admin());

alter policy "permission_groups_tenant_select" on public.permission_groups
  using (
    (company_id is null and auth.uid() is not null)
    or (company_id is not null and public.has_company_role(company_id, array['owner','admin','hr']))
  );