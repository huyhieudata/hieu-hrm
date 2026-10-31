-- Kiểm tra mô hình quyền nền. Chạy thủ công bằng psql:
--   psql "$DATABASE_URL" -f supabase/tests/permission_matrix.sql
-- Không tạo hay xoá dữ liệu doanh nghiệp.
do $$
declare
  hr_keys text[] := public.default_role_permissions('hr');
  manager_keys text[] := public.default_role_permissions('manager');
  employee_keys text[] := public.default_role_permissions('employee');
begin
  if array_length(public.all_permission_keys(), 1) < 70 then
    raise exception 'all_permission_keys thiếu key';
  end if;

  if not ('employees.edit' = any(hr_keys)) then
    raise exception 'HR thiếu employees.edit';
  end if;
  if not ('settings.edit' = any(hr_keys)) then
    raise exception 'HR thiếu settings.edit';
  end if;
  if 'members.manage' = any(hr_keys) then
    raise exception 'HR không được có members.manage';
  end if;

  if not ('leave.approve' = any(manager_keys)) then
    raise exception 'Manager thiếu leave.approve';
  end if;
  if 'payroll.view' = any(manager_keys) then
    raise exception 'Manager không được có payroll.view';
  end if;
  if 'settings.edit' = any(manager_keys) then
    raise exception 'Manager không được có settings.edit';
  end if;

  if not ('employees.view' = any(employee_keys)) then
    raise exception 'Employee thiếu employees.view';
  end if;
  if 'employees.edit' = any(employee_keys) then
    raise exception 'Employee không được có employees.edit';
  end if;
  if 'members.view' = any(employee_keys) then
    raise exception 'Employee không được có members.view';
  end if;
end $$;
