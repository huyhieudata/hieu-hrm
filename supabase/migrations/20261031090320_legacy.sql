create table public.payroll_periods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  year integer not null,
  month integer not null check (month between 1 and 12),
  status text not null default 'draft' check (status in ('draft','locked','paid')),
  standard_work_days numeric(5,1) not null default 26,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_periods_key unique (company_id, year, month)
);
create index payroll_periods_company_idx on public.payroll_periods (company_id, year desc, month desc);
alter table public.payroll_periods enable row level security;
create trigger payroll_periods_set_updated_at before update on public.payroll_periods
  for each row execute function public.set_updated_at();
create policy "payroll_periods_select" on public.payroll_periods for select to authenticated
  using (public.has_company_role(company_id, array['owner','admin','hr','manager']));
create policy "payroll_periods_write" on public.payroll_periods for insert to authenticated
  with check (public.has_permission(company_id, 'payroll.create'));
create policy "payroll_periods_update" on public.payroll_periods for update to authenticated
  using (public.has_permission(company_id, 'payroll.edit'))
  with check (public.has_permission(company_id, 'payroll.edit'));
create policy "payroll_periods_delete" on public.payroll_periods for delete to authenticated
  using (public.has_permission(company_id, 'payroll.delete'));

create table public.payroll_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  period_id uuid not null references public.payroll_periods(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  employee_name text not null,
  employee_code text,
  department text,
  work_days numeric(5,1) not null default 0,
  base_salary numeric(14,2) not null default 0,
  position_allowance numeric(14,2) not null default 0,
  responsibility_allowance numeric(14,2) not null default 0,
  other_allowance numeric(14,2) not null default 0,
  gross_salary numeric(14,2) not null default 0,
  insurance_salary numeric(14,2) not null default 0,
  insurance_employee numeric(14,2) not null default 0,
  taxable_income numeric(14,2) not null default 0,
  tax_amount numeric(14,2) not null default 0,
  other_deduction numeric(14,2) not null default 0,
  net_salary numeric(14,2) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  constraint payroll_items_key unique (period_id, employee_id)
);
create index payroll_items_period_idx on public.payroll_items (period_id);
create index payroll_items_employee_idx on public.payroll_items (employee_id);
alter table public.payroll_items enable row level security;
create policy "payroll_items_select" on public.payroll_items for select to authenticated
  using (public.can_access_employee(employee_id));
create policy "payroll_items_write" on public.payroll_items for insert to authenticated
  with check (public.has_permission(company_id, 'payroll.edit'));
create policy "payroll_items_update" on public.payroll_items for update to authenticated
  using (public.has_permission(company_id, 'payroll.edit'))
  with check (public.has_permission(company_id, 'payroll.edit'));
create policy "payroll_items_delete" on public.payroll_items for delete to authenticated
  using (public.has_permission(company_id, 'payroll.edit'));