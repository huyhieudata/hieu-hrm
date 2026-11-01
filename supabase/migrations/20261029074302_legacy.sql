create table public.permission_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  permissions text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.permission_groups enable row level security;
create trigger permission_groups_set_updated_at before update on public.permission_groups
  for each row execute function public.set_updated_at();
create policy "permission_groups_select" on public.permission_groups for select to authenticated using (auth.uid() is not null);
create policy "permission_groups_insert" on public.permission_groups for insert to authenticated with check (public.is_platform_admin());
create policy "permission_groups_update" on public.permission_groups for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "permission_groups_delete" on public.permission_groups for delete to authenticated using (public.is_platform_admin());

create table public.employee_permissions (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  group_id uuid references public.permission_groups(id) on delete set null,
  permissions text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index employee_permissions_company_idx on public.employee_permissions (company_id);
alter table public.employee_permissions enable row level security;
create trigger employee_permissions_set_updated_at before update on public.employee_permissions
  for each row execute function public.set_updated_at();
create policy "employee_permissions_select" on public.employee_permissions for select to authenticated using (public.can_access_employee(employee_id));
create policy "employee_permissions_insert" on public.employee_permissions for insert to authenticated with check (public.can_manage_employee(employee_id));
create policy "employee_permissions_update" on public.employee_permissions for update to authenticated using (public.can_manage_employee(employee_id)) with check (public.can_manage_employee(employee_id));
create policy "employee_permissions_delete" on public.employee_permissions for delete to authenticated using (public.can_manage_employee(employee_id));

insert into public.permission_groups (name, description, permissions)
select v.name, v.description, v.permissions::text[]
from (values
  ('Quản trị nhân sự', 'Toàn quyền quản lý hồ sơ, chấm công, đơn từ và lương', '{employees.view,employees.manage,attendance.view,attendance.manage,leave.view,leave.approve,payroll.view,recruitment.view}'),
  ('Quản lý', 'Xem hồ sơ nhân sự, chấm công và duyệt đơn', '{employees.view,attendance.view,leave.view,leave.approve}'),
  ('Nhân viên', 'Tự xem hồ sơ, chấm công và gửi đơn', '{employees.view,attendance.view,leave.view}')
) as v(name, description, permissions)
where not exists (select 1 from public.permission_groups g where g.name = v.name);