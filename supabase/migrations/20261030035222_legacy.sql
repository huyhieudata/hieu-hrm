create or replace function public.has_permission(target_company uuid, permission_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_company_role(target_company, array['owner','admin','hr'])
    or exists (
      select 1
      from public.employee_permissions ep
      join public.employees e on e.id = ep.employee_id
      where e.company_id = target_company
        and e.user_id = auth.uid()
        and permission_key = any (ep.permissions)
    );
$$;

create policy "employees_grant_insert" on public.employees for insert to authenticated
  with check (public.has_permission(company_id, 'employees.create'));
create policy "employees_grant_update" on public.employees for update to authenticated
  using (public.has_permission(company_id, 'employees.edit'))
  with check (public.has_permission(company_id, 'employees.edit'));
create policy "employees_grant_delete" on public.employees for delete to authenticated
  using (public.has_permission(company_id, 'employees.delete'));

create policy "requests_grant_update" on public.requests for update to authenticated
  using (public.has_permission(company_id, 'requests.edit'))
  with check (public.has_permission(company_id, 'requests.edit'));

create policy "attendance_grant_insert" on public.attendance_records for insert to authenticated
  with check (public.has_permission(company_id, 'attendance.create'));
create policy "attendance_grant_update" on public.attendance_records for update to authenticated
  using (public.has_permission(company_id, 'attendance.edit'))
  with check (public.has_permission(company_id, 'attendance.edit'));
create policy "attendance_grant_delete" on public.attendance_records for delete to authenticated
  using (public.has_permission(company_id, 'attendance.delete'));