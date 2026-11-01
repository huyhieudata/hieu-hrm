alter policy "requests_insert" on public.requests
  with check (
    public.can_employee_module(employee_id, 'requests', 'create')
    or exists (select 1 from public.employees e where e.id = requests.employee_id and e.user_id = auth.uid())
  );
alter policy "requests_update" on public.requests
  using (
    public.can_employee_module(employee_id, 'requests', 'edit')
    or public.has_permission(company_id, 'leave.approve')
    or public.is_request_approver(id)
    or (status in ('pending','cancelled') and exists (select 1 from public.employees e where e.id = requests.employee_id and e.user_id = auth.uid()))
  )
  with check (
    public.can_employee_module(employee_id, 'requests', 'edit')
    or public.has_permission(company_id, 'leave.approve')
    or public.is_request_approver(id)
    or (status in ('pending','cancelled') and exists (select 1 from public.employees e where e.id = requests.employee_id and e.user_id = auth.uid()))
  );
alter policy "requests_delete" on public.requests
  using (
    public.can_employee_module(employee_id, 'requests', 'delete')
    or (status in ('pending','cancelled') and exists (select 1 from public.employees e where e.id = requests.employee_id and e.user_id = auth.uid()))
  );

alter policy "request_types_insert" on public.request_types
  with check (public.has_permission(company_id, 'requests.create'));
alter policy "request_types_update" on public.request_types
  using (public.has_permission(company_id, 'requests.edit'))
  with check (public.has_permission(company_id, 'requests.edit'));
alter policy "request_types_delete" on public.request_types
  using (public.has_permission(company_id, 'requests.delete'));

alter policy "leave_policies_insert" on public.leave_policies
  with check (public.has_permission(company_id, 'leave.create'));
alter policy "leave_policies_update" on public.leave_policies
  using (public.has_permission(company_id, 'leave.edit'))
  with check (public.has_permission(company_id, 'leave.edit'));
alter policy "leave_policies_delete" on public.leave_policies
  using (public.has_permission(company_id, 'leave.delete'));
alter policy "leave_policy_items_insert" on public.leave_policy_items
  with check (public.has_permission(company_id, 'leave.create'));
alter policy "leave_policy_items_update" on public.leave_policy_items
  using (public.has_permission(company_id, 'leave.edit'))
  with check (public.has_permission(company_id, 'leave.edit'));
alter policy "leave_policy_items_delete" on public.leave_policy_items
  using (public.has_permission(company_id, 'leave.delete'));

alter policy "work_shifts_insert" on public.work_shifts
  with check (public.has_permission(company_id, 'shifts.create'));
alter policy "work_shifts_update" on public.work_shifts
  using (public.has_permission(company_id, 'shifts.edit'))
  with check (public.has_permission(company_id, 'shifts.edit'));
alter policy "work_shifts_delete" on public.work_shifts
  using (public.has_permission(company_id, 'shifts.delete'));
alter policy "shift_assignments_insert" on public.shift_assignments
  with check (public.has_permission(company_id, 'shifts.create'));
alter policy "shift_assignments_update" on public.shift_assignments
  using (public.has_permission(company_id, 'shifts.edit'))
  with check (public.has_permission(company_id, 'shifts.edit'));
alter policy "shift_assignments_delete" on public.shift_assignments
  using (public.has_permission(company_id, 'shifts.delete'));

alter policy "attendance_settings_insert" on public.attendance_settings
  with check (public.has_permission(company_id, 'attendance.create'));
alter policy "attendance_settings_update" on public.attendance_settings
  using (public.has_permission(company_id, 'attendance.edit'))
  with check (public.has_permission(company_id, 'attendance.edit'));
alter policy "attendance_settings_delete" on public.attendance_settings
  using (public.has_permission(company_id, 'attendance.delete'));

alter policy "approval_workflows_insert" on public.approval_workflows
  with check (public.has_permission(company_id, 'requests.create'));
alter policy "approval_workflows_update" on public.approval_workflows
  using (public.has_permission(company_id, 'requests.edit'))
  with check (public.has_permission(company_id, 'requests.edit'));
alter policy "approval_workflows_delete" on public.approval_workflows
  using (public.has_permission(company_id, 'requests.delete'));
alter policy "approval_workflow_steps_insert" on public.approval_workflow_steps
  with check (exists (
    select 1 from public.approval_workflows w
    where w.id = approval_workflow_steps.workflow_id and public.has_permission(w.company_id, 'requests.create')
  ));
alter policy "approval_workflow_steps_delete" on public.approval_workflow_steps
  using (exists (
    select 1 from public.approval_workflows w
    where w.id = approval_workflow_steps.workflow_id and public.has_permission(w.company_id, 'requests.delete')
  ));