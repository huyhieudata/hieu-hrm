alter policy "employees_insert_hr" on public.employees
  with check (public.has_permission(company_id, 'employees.create'));
alter policy "employees_update_hr" on public.employees
  using (public.has_permission(company_id, 'employees.edit'))
  with check (public.has_permission(company_id, 'employees.edit'));
alter policy "employees_delete_admins" on public.employees
  using (public.has_permission(company_id, 'employees.delete'));

alter policy "attendance_records_insert" on public.attendance_records
  with check (
    public.has_permission(company_id, 'attendance.create')
    or exists (select 1 from public.employees e where e.id = attendance_records.employee_id and e.user_id = auth.uid())
  );
alter policy "attendance_records_update" on public.attendance_records
  using (
    public.has_permission(company_id, 'attendance.edit')
    or exists (select 1 from public.employees e where e.id = attendance_records.employee_id and e.user_id = auth.uid())
  )
  with check (
    public.has_permission(company_id, 'attendance.edit')
    or exists (select 1 from public.employees e where e.id = attendance_records.employee_id and e.user_id = auth.uid())
  );
alter policy "attendance_records_delete" on public.attendance_records
  using (public.has_permission(company_id, 'attendance.delete'));

alter policy "debts_write" on public.employee_debts
  with check (public.can_employee_module(employee_id, 'employees', 'create'));
alter policy "debts_update" on public.employee_debts
  using (public.can_employee_module(employee_id, 'employees', 'edit'))
  with check (public.can_employee_module(employee_id, 'employees', 'edit'));
alter policy "debts_delete" on public.employee_debts
  using (public.can_employee_module(employee_id, 'employees', 'delete'));

alter policy "dependents_write" on public.employee_dependents
  with check (public.can_employee_module(employee_id, 'employees', 'create'));
alter policy "dependents_update" on public.employee_dependents
  using (public.can_employee_module(employee_id, 'employees', 'edit'))
  with check (public.can_employee_module(employee_id, 'employees', 'edit'));
alter policy "dependents_delete" on public.employee_dependents
  using (public.can_employee_module(employee_id, 'employees', 'delete'));

alter policy "discipline_write" on public.employee_discipline_records
  with check (public.can_employee_module(employee_id, 'employees', 'create'));
alter policy "discipline_update" on public.employee_discipline_records
  using (public.can_employee_module(employee_id, 'employees', 'edit'))
  with check (public.can_employee_module(employee_id, 'employees', 'edit'));
alter policy "discipline_delete" on public.employee_discipline_records
  using (public.can_employee_module(employee_id, 'employees', 'delete'));

alter policy "documents_write" on public.employee_documents
  with check (public.can_employee_module(employee_id, 'employees', 'create'));
alter policy "documents_update" on public.employee_documents
  using (public.can_employee_module(employee_id, 'employees', 'edit'))
  with check (public.can_employee_module(employee_id, 'employees', 'edit'));
alter policy "documents_delete" on public.employee_documents
  using (public.can_employee_module(employee_id, 'employees', 'delete'));

alter policy "rewards_write" on public.employee_rewards
  with check (public.can_employee_module(employee_id, 'employees', 'create'));
alter policy "rewards_update" on public.employee_rewards
  using (public.can_employee_module(employee_id, 'employees', 'edit'))
  with check (public.can_employee_module(employee_id, 'employees', 'edit'));
alter policy "rewards_delete" on public.employee_rewards
  using (public.can_employee_module(employee_id, 'employees', 'delete'));

alter policy "training_write" on public.employee_training_records
  with check (public.can_employee_module(employee_id, 'employees', 'create'));
alter policy "training_update" on public.employee_training_records
  using (public.can_employee_module(employee_id, 'employees', 'edit'))
  with check (public.can_employee_module(employee_id, 'employees', 'edit'));
alter policy "training_delete" on public.employee_training_records
  using (public.can_employee_module(employee_id, 'employees', 'delete'));

alter policy "work_history_write" on public.employee_work_history
  with check (public.can_employee_module(employee_id, 'employees', 'create'));
alter policy "work_history_update" on public.employee_work_history
  using (public.can_employee_module(employee_id, 'employees', 'edit'))
  with check (public.can_employee_module(employee_id, 'employees', 'edit'));
alter policy "work_history_delete" on public.employee_work_history
  using (public.can_employee_module(employee_id, 'employees', 'delete'));

alter policy "employee_leave_balances_insert" on public.employee_leave_balances
  with check (public.can_employee_module(employee_id, 'leave', 'create'));
alter policy "employee_leave_balances_update" on public.employee_leave_balances
  using (public.can_employee_module(employee_id, 'leave', 'edit'))
  with check (public.can_employee_module(employee_id, 'leave', 'edit'));
alter policy "employee_leave_balances_delete" on public.employee_leave_balances
  using (public.can_employee_module(employee_id, 'leave', 'delete'));
alter policy "leave_balance_logs_insert" on public.leave_balance_logs
  with check (public.can_employee_module(employee_id, 'leave', 'edit'));

alter policy "request_approvals_insert" on public.request_approvals
  with check (public.has_permission((select e.company_id from public.employees e where e.id = public.request_employee_id(request_id)), 'requests.edit'));
alter policy "request_approvals_update" on public.request_approvals
  using (public.is_request_approver(request_id) or public.has_permission((select e.company_id from public.employees e where e.id = public.request_employee_id(request_id)), 'requests.edit'))
  with check (public.is_request_approver(request_id) or public.has_permission((select e.company_id from public.employees e where e.id = public.request_employee_id(request_id)), 'requests.edit'));
alter policy "request_approvals_delete" on public.request_approvals
  using (public.has_permission((select e.company_id from public.employees e where e.id = public.request_employee_id(request_id)), 'requests.delete'));