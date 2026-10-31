create table public.leave_policy_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  policy_id uuid not null references public.leave_policies(id) on delete cascade,
  scope_type text not null check (scope_type in ('company','department','position','employee')),
  scope_value text,
  created_at timestamptz not null default now(),
  constraint leave_policy_assignments_key unique (policy_id, scope_type, scope_value)
);
create index leave_policy_assignments_company_idx on public.leave_policy_assignments (company_id);
alter table public.leave_policy_assignments enable row level security;
create policy "leave_policy_assignments_select" on public.leave_policy_assignments for select to authenticated
  using (public.has_company_role(company_id, array['owner','admin','hr','manager']));
create policy "leave_policy_assignments_insert" on public.leave_policy_assignments for insert to authenticated
  with check (public.can_manage_attendance(company_id));
create policy "leave_policy_assignments_update" on public.leave_policy_assignments for update to authenticated
  using (public.can_manage_attendance(company_id)) with check (public.can_manage_attendance(company_id));
create policy "leave_policy_assignments_delete" on public.leave_policy_assignments for delete to authenticated
  using (public.can_manage_attendance(company_id));

create table public.leave_balance_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  year integer not null,
  change_days numeric(6,1) not null,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index leave_balance_logs_employee_idx on public.leave_balance_logs (employee_id, year, created_at desc);
alter table public.leave_balance_logs enable row level security;
create policy "leave_balance_logs_select" on public.leave_balance_logs for select to authenticated
  using (public.can_access_employee(employee_id));
create policy "leave_balance_logs_insert" on public.leave_balance_logs for insert to authenticated
  with check (public.can_manage_employee(employee_id));

insert into public.leave_policy_assignments (company_id, policy_id, scope_type)
select p.company_id, p.id, 'company'
from public.leave_policies p
where not exists (select 1 from public.leave_policy_assignments a where a.policy_id = p.id);