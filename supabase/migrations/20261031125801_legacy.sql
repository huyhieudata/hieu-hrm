alter policy "employee_permissions_select" on public.employee_permissions
  using (
    public.can_manage_employee(employee_id)
    or exists (select 1 from public.employees e where e.id = employee_permissions.employee_id and e.user_id = auth.uid())
  );