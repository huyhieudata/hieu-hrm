create or replace function public.can_employee_module(target_employee uuid, module_key text, action_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employees e
    where e.id = target_employee
      and (
        public.has_permission(e.company_id, module_key || '.' || action_key)
        or (action_key = 'view' and e.user_id = auth.uid())
      )
  );
$$;

revoke all on function public.can_employee_module(uuid, text, text) from public;
grant execute on function public.can_employee_module(uuid, text, text) to authenticated;

alter policy "contracts_select" on public.employee_contracts
  using (public.can_employee_module(employee_id, 'contracts', 'view'));
alter policy "contracts_write" on public.employee_contracts
  with check (public.can_employee_module(employee_id, 'contracts', 'create'));
alter policy "contracts_update" on public.employee_contracts
  using (public.can_employee_module(employee_id, 'contracts', 'edit'))
  with check (public.can_employee_module(employee_id, 'contracts', 'edit'));
alter policy "contracts_delete" on public.employee_contracts
  using (public.can_employee_module(employee_id, 'contracts', 'delete'));

alter policy "insurance_select" on public.employee_insurance_records
  using (public.can_employee_module(employee_id, 'insurance', 'view'));
alter policy "insurance_write" on public.employee_insurance_records
  with check (public.can_employee_module(employee_id, 'insurance', 'create'));
alter policy "insurance_update" on public.employee_insurance_records
  using (public.can_employee_module(employee_id, 'insurance', 'edit'))
  with check (public.can_employee_module(employee_id, 'insurance', 'edit'));
alter policy "insurance_delete" on public.employee_insurance_records
  using (public.can_employee_module(employee_id, 'insurance', 'delete'));
alter policy "employee_insurance_grant_all" on public.employee_insurance_records
  using (false) with check (false);

alter policy "salary_select" on public.employee_salary_records
  using (public.can_employee_module(employee_id, 'payroll', 'view'));
alter policy "salary_write" on public.employee_salary_records
  with check (public.can_employee_module(employee_id, 'payroll', 'create'));
alter policy "salary_update" on public.employee_salary_records
  using (public.can_employee_module(employee_id, 'payroll', 'edit'))
  with check (public.can_employee_module(employee_id, 'payroll', 'edit'));
alter policy "salary_delete" on public.employee_salary_records
  using (public.can_employee_module(employee_id, 'payroll', 'delete'));

alter policy "assets_select" on public.employee_assets
  using (public.can_employee_module(employee_id, 'assets', 'view'));
alter policy "assets_write" on public.employee_assets
  with check (public.can_employee_module(employee_id, 'assets', 'create'));
alter policy "assets_update" on public.employee_assets
  using (public.can_employee_module(employee_id, 'assets', 'edit'))
  with check (public.can_employee_module(employee_id, 'assets', 'edit'));
alter policy "assets_delete" on public.employee_assets
  using (public.can_employee_module(employee_id, 'assets', 'delete'));

alter policy "employee_contacts_select" on public.employee_contacts
  using (public.can_employee_module(employee_id, 'employees', 'view'));
alter policy "employee_contacts_insert" on public.employee_contacts
  with check (public.can_employee_module(employee_id, 'employees', 'create'));
alter policy "employee_contacts_update" on public.employee_contacts
  using (public.can_employee_module(employee_id, 'employees', 'edit'))
  with check (public.can_employee_module(employee_id, 'employees', 'edit'));
alter policy "employee_contacts_delete" on public.employee_contacts
  using (public.can_employee_module(employee_id, 'employees', 'delete'));

alter policy "employee_notes_select" on public.employee_notes
  using (public.can_employee_module(employee_id, 'employees', 'view'));
alter policy "employee_notes_insert" on public.employee_notes
  with check (public.can_employee_module(employee_id, 'employees', 'edit') or author_id = auth.uid());
alter policy "employee_notes_update" on public.employee_notes
  using (public.can_employee_module(employee_id, 'employees', 'edit') or author_id = auth.uid())
  with check (public.can_employee_module(employee_id, 'employees', 'edit') or author_id = auth.uid());
alter policy "employee_notes_delete" on public.employee_notes
  using (public.can_employee_module(employee_id, 'employees', 'delete') or author_id = auth.uid());