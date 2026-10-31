-- Phân quyền quản lý (role manager) theo phòng ban.
-- Trước đây manager xem được toàn bộ nhân viên của công ty (và các bảng dùng can_access_employee:
-- chấm công, nghỉ phép, nhật ký...). Nay manager chỉ xem:
--   * chính mình;
--   * nhân viên báo cáo trực tiếp (employees.manager_id = hồ sơ của manager);
--   * nhân viên thuộc phòng ban mà manager là trưởng phòng (departments.manager_employee_id),
--     kể cả các phòng ban con (departments.parent_id), so khớp theo tên phòng ban (employees.department).
-- owner/admin/hr giữ nguyên quyền xem toàn công ty.

create or replace function public.is_manager_of_employee(target_employee uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select m.id, m.company_id
    from public.employees m
    join public.employees t on t.id = target_employee and t.company_id = m.company_id
    where m.user_id = auth.uid()
      and public.has_company_role(m.company_id, array['manager'])
  )
  select exists (
    select 1
    from me
    join public.employees t on t.id = target_employee
    where t.manager_id = me.id
       or exists (
         with recursive tree as (
           select d.id, d.name
           from public.departments d
           where d.company_id = me.company_id and d.manager_employee_id = me.id
           union
           select c.id, c.name
           from public.departments c
           join tree p on c.parent_id = p.id
           where c.company_id = me.company_id
         )
         select 1 from tree
         where lower(btrim(tree.name)) = lower(btrim(coalesce(t.department, '')))
       )
  );
$$;

revoke all on function public.is_manager_of_employee(uuid) from public, anon;
grant execute on function public.is_manager_of_employee(uuid) to authenticated;

create or replace function public.can_access_employee(target_employee uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.employees e
    where e.id = target_employee
      and (
        public.has_company_role(e.company_id, array['owner','admin','hr'])
        or e.user_id = auth.uid()
      )
  ) or public.is_manager_of_employee(target_employee);
$$;

drop policy if exists employees_select_authorized on public.employees;
create policy employees_select_authorized on public.employees
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_company_role(company_id, array['owner','admin','hr'])
    or public.is_manager_of_employee(id)
  );
