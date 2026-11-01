alter policy "invites_select_managers" on public.company_invites
  using (
    public.has_company_role(company_id, array['owner','admin','hr'])
    or public.has_permission(company_id, 'members.create')
    or public.has_permission(company_id, 'members.invite')
    or public.has_permission(company_id, 'members.manage')
  );
alter policy "invites_insert_managers" on public.company_invites
  with check (
    (
      public.has_company_role(company_id, array['owner','admin','hr'])
      or public.has_permission(company_id, 'members.create')
      or public.has_permission(company_id, 'members.invite')
      or public.has_permission(company_id, 'members.manage')
    )
    and invited_by = auth.uid()
    and ((role <> 'owner') or public.company_role(company_id) = 'owner')
    and ((role <> 'admin') or public.company_role(company_id) in ('owner','admin'))
  );
alter policy "invites_update_managers" on public.company_invites
  using (
    public.has_company_role(company_id, array['owner','admin','hr'])
    or public.has_permission(company_id, 'members.create')
    or public.has_permission(company_id, 'members.invite')
    or public.has_permission(company_id, 'members.manage')
  )
  with check (
    public.has_company_role(company_id, array['owner','admin','hr'])
    or public.has_permission(company_id, 'members.create')
    or public.has_permission(company_id, 'members.invite')
    or public.has_permission(company_id, 'members.manage')
  );
alter policy "invites_delete_managers" on public.company_invites
  using (
    public.has_company_role(company_id, array['owner','admin','hr'])
    or public.has_permission(company_id, 'members.create')
    or public.has_permission(company_id, 'members.invite')
    or public.has_permission(company_id, 'members.manage')
  );