alter policy "members_insert_admin" on public.company_members
  with check (
    public.has_company_role(company_id, array['owner','admin'])
    and ((role <> 'owner') or public.company_role(company_id) = 'owner')
  );
alter policy "members_update_admin" on public.company_members
  using (public.has_company_role(company_id, array['owner','admin']))
  with check (
    public.has_company_role(company_id, array['owner','admin'])
    and ((role <> 'owner') or public.company_role(company_id) = 'owner')
  );
alter policy "members_delete_admin_or_self" on public.company_members
  using (
    (
      ((user_id = auth.uid()) and role <> 'owner')
      or public.has_company_role(company_id, array['owner'])
      or (public.has_company_role(company_id, array['admin']) and role in ('hr','manager','employee'))
    )
    and not public.is_only_owner(company_id, user_id)
  );

alter policy "invites_insert_managers" on public.company_invites
  with check (
    public.has_company_role(company_id, array['owner','admin','hr'])
    and invited_by = auth.uid()
    and ((role <> 'owner') or public.company_role(company_id) = 'owner')
    and ((role <> 'admin') or public.company_role(company_id) in ('owner','admin'))
  );
alter policy "invites_update_managers" on public.company_invites
  using (public.has_company_role(company_id, array['owner','admin','hr']))
  with check (
    public.has_company_role(company_id, array['owner','admin','hr'])
    and ((role <> 'owner') or public.company_role(company_id) = 'owner')
    and ((role <> 'admin') or public.company_role(company_id) in ('owner','admin'))
  );