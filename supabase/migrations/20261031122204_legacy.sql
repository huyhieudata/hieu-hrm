alter policy "departments_insert" on public.departments
  with check (public.has_permission(company_id, 'settings.create'));
alter policy "departments_update" on public.departments
  using (public.has_permission(company_id, 'settings.edit'))
  with check (public.has_permission(company_id, 'settings.edit'));
alter policy "departments_delete" on public.departments
  using (public.has_permission(company_id, 'settings.delete'));
alter policy "department_positions_insert" on public.department_positions
  with check (public.has_permission(company_id, 'settings.create'));
alter policy "department_positions_update" on public.department_positions
  using (public.has_permission(company_id, 'settings.edit'))
  with check (public.has_permission(company_id, 'settings.edit'));
alter policy "department_positions_delete" on public.department_positions
  using (public.has_permission(company_id, 'settings.delete'));
alter policy "document_checklist_insert" on public.document_checklist_templates
  with check (public.has_permission(company_id, 'settings.create'));
alter policy "document_checklist_update" on public.document_checklist_templates
  using (public.has_permission(company_id, 'settings.edit'))
  with check (public.has_permission(company_id, 'settings.edit'));
alter policy "document_checklist_delete" on public.document_checklist_templates
  using (public.has_permission(company_id, 'settings.delete'));
alter policy "onboarding_templates_insert" on public.onboarding_checklist_templates
  with check (public.has_permission(company_id, 'settings.create'));
alter policy "onboarding_templates_update" on public.onboarding_checklist_templates
  using (public.has_permission(company_id, 'settings.edit'))
  with check (public.has_permission(company_id, 'settings.edit'));
alter policy "onboarding_templates_delete" on public.onboarding_checklist_templates
  using (public.has_permission(company_id, 'settings.delete'));

alter policy "headcount_plans_insert" on public.headcount_plans
  with check (public.has_permission(company_id, 'planning.create'));
alter policy "headcount_plans_update" on public.headcount_plans
  using (public.has_permission(company_id, 'planning.edit'))
  with check (public.has_permission(company_id, 'planning.edit'));
alter policy "headcount_plans_delete" on public.headcount_plans
  using (public.has_permission(company_id, 'planning.delete'));

alter policy "onboarding_select" on public.onboarding_records
  using (public.has_permission(company_id, 'onboarding.view'));
alter policy "onboarding_insert" on public.onboarding_records
  with check (public.has_permission(company_id, 'onboarding.create'));
alter policy "onboarding_update" on public.onboarding_records
  using (public.has_permission(company_id, 'onboarding.edit'))
  with check (public.has_permission(company_id, 'onboarding.edit'));
alter policy "onboarding_delete" on public.onboarding_records
  using (public.has_permission(company_id, 'onboarding.delete'));
alter policy "onboarding_comments_select" on public.onboarding_comments
  using (public.has_permission(company_id, 'onboarding.view'));
alter policy "onboarding_comments_insert" on public.onboarding_comments
  with check (public.has_permission(company_id, 'onboarding.view') and author_id = auth.uid());
alter policy "onboarding_comments_delete" on public.onboarding_comments
  using (public.has_permission(company_id, 'onboarding.edit') or author_id = auth.uid());

alter policy "members_insert_admin" on public.company_members
  with check (
    (public.has_company_role(company_id, array['owner','admin']) or public.has_permission(company_id, 'members.create') or public.has_permission(company_id, 'members.manage'))
    and ((role <> 'owner') or public.company_role(company_id) = 'owner')
  );
alter policy "members_update_admin" on public.company_members
  using (public.has_company_role(company_id, array['owner','admin']) or public.has_permission(company_id, 'members.edit') or public.has_permission(company_id, 'members.manage'))
  with check (
    (public.has_company_role(company_id, array['owner','admin']) or public.has_permission(company_id, 'members.edit') or public.has_permission(company_id, 'members.manage'))
    and ((role <> 'owner') or public.company_role(company_id) = 'owner')
  );
alter policy "members_delete_admin_or_self" on public.company_members
  using (
    (
      ((user_id = auth.uid()) and role <> 'owner')
      or public.has_company_role(company_id, array['owner'])
      or (public.has_company_role(company_id, array['admin']) and role in ('hr','manager','employee'))
      or public.has_permission(company_id, 'members.delete')
      or public.has_permission(company_id, 'members.manage')
    )
    and not public.is_only_owner(company_id, user_id)
  );

alter policy "invites_select_managers" on public.company_invites
  using (public.has_company_role(company_id, array['owner','admin','hr']) or public.has_permission(company_id, 'members.view') or public.has_permission(company_id, 'members.invite') or public.has_permission(company_id, 'members.manage'));
alter policy "invites_insert_managers" on public.company_invites
  with check (
    (public.has_company_role(company_id, array['owner','admin','hr']) or public.has_permission(company_id, 'members.invite') or public.has_permission(company_id, 'members.manage'))
    and invited_by = auth.uid()
    and ((role <> 'owner') or public.company_role(company_id) = 'owner')
  );
alter policy "invites_update_managers" on public.company_invites
  using (public.has_company_role(company_id, array['owner','admin','hr']) or public.has_permission(company_id, 'members.invite') or public.has_permission(company_id, 'members.manage'))
  with check (public.has_company_role(company_id, array['owner','admin','hr']) or public.has_permission(company_id, 'members.invite') or public.has_permission(company_id, 'members.manage'));
alter policy "invites_delete_managers" on public.company_invites
  using (public.has_company_role(company_id, array['owner','admin','hr']) or public.has_permission(company_id, 'members.invite') or public.has_permission(company_id, 'members.manage'));