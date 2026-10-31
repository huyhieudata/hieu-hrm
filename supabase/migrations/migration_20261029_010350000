create table public.leave_policies (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  year integer not null,
  name text not null default 'Chính sách phép năm',
  days_per_year numeric(5,1) not null default 12,
  carry_over_max numeric(5,1) not null default 0,
  prorate_by_hire_date boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_policies_year_key unique (company_id, year)
);
create index leave_policies_company_idx on public.leave_policies (company_id);
alter table public.leave_policies enable row level security;
create trigger leave_policies_set_updated_at before update on public.leave_policies
  for each row execute function public.set_updated_at();
create policy "leave_policies_select" on public.leave_policies for select to authenticated using (public.has_company_role(company_id, array['owner','admin','hr','manager']));
create policy "leave_policies_insert" on public.leave_policies for insert to authenticated with check (public.can_manage_attendance(company_id));
create policy "leave_policies_update" on public.leave_policies for update to authenticated using (public.can_manage_attendance(company_id)) with check (public.can_manage_attendance(company_id));
create policy "leave_policies_delete" on public.leave_policies for delete to authenticated using (public.can_manage_attendance(company_id));

create table public.employee_leave_balances (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  year integer not null,
  adjustment_days numeric(5,1) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_leave_balances_key unique (employee_id, year)
);
create index employee_leave_balances_company_idx on public.employee_leave_balances (company_id, year);
alter table public.employee_leave_balances enable row level security;
create trigger employee_leave_balances_set_updated_at before update on public.employee_leave_balances
  for each row execute function public.set_updated_at();
create policy "employee_leave_balances_select" on public.employee_leave_balances for select to authenticated using (public.can_access_employee(employee_id));
create policy "employee_leave_balances_insert" on public.employee_leave_balances for insert to authenticated with check (public.can_manage_employee(employee_id));
create policy "employee_leave_balances_update" on public.employee_leave_balances for update to authenticated using (public.can_manage_employee(employee_id)) with check (public.can_manage_employee(employee_id));
create policy "employee_leave_balances_delete" on public.employee_leave_balances for delete to authenticated using (public.can_manage_employee(employee_id));

insert into public.leave_policies (company_id, year, name, days_per_year, carry_over_max, prorate_by_hire_date)
select c.id, extract(year from current_date)::int, 'Chính sách phép năm', 12, 5, true
from public.companies c
where exists (select 1 from public.employees e where e.company_id = c.id)
  and not exists (select 1 from public.leave_policies p where p.company_id = c.id);