alter policy "approval_workflow_types_write" on public.approval_workflow_types
  with check (exists (
    select 1 from public.approval_workflows w
    where w.id = approval_workflow_types.workflow_id and public.has_permission(w.company_id, 'requests.create')
  ));
alter policy "approval_workflow_types_delete" on public.approval_workflow_types
  using (exists (
    select 1 from public.approval_workflows w
    where w.id = approval_workflow_types.workflow_id and public.has_permission(w.company_id, 'requests.delete')
  ));

alter policy "comments_delete" on public.candidate_comments
  using (public.has_permission(company_id, 'recruitment.delete') or author_id = auth.uid());
alter policy "evaluations_delete" on public.candidate_evaluations
  using (public.has_permission(company_id, 'recruitment.delete') or reviewer_id = auth.uid());
alter policy "evaluations_update" on public.candidate_evaluations
  using (public.has_permission(company_id, 'recruitment.edit') or reviewer_id = auth.uid())
  with check (public.can_view_recruitment(company_id));

alter policy "headcount_items_insert" on public.headcount_items
  with check (public.has_permission(company_id, 'planning.create'));
alter policy "headcount_items_update" on public.headcount_items
  using (public.has_permission(company_id, 'planning.edit'))
  with check (public.has_permission(company_id, 'planning.edit'));
alter policy "headcount_items_delete" on public.headcount_items
  using (public.has_permission(company_id, 'planning.delete'));

alter policy "leave_policy_assignments_insert" on public.leave_policy_assignments
  with check (public.has_permission(company_id, 'leave.create'));
alter policy "leave_policy_assignments_update" on public.leave_policy_assignments
  using (public.has_permission(company_id, 'leave.edit'))
  with check (public.has_permission(company_id, 'leave.edit'));
alter policy "leave_policy_assignments_delete" on public.leave_policy_assignments
  using (public.has_permission(company_id, 'leave.delete'));

alter policy "request_approval_steps_insert" on public.request_approval_steps
  with check (public.has_permission(company_id, 'requests.create'));
alter policy "request_approval_steps_update" on public.request_approval_steps
  using (public.has_permission(company_id, 'requests.edit'))
  with check (public.has_permission(company_id, 'requests.edit'));
alter policy "request_approval_steps_delete" on public.request_approval_steps
  using (public.has_permission(company_id, 'requests.delete'));