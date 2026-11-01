create table public.employee_dependents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  full_name text not null,
  relationship text not null default 'child' check (relationship in ('spouse','child','father','mother','sibling','other')),
  date_of_birth date,
  gender text check (gender in ('male','female','other')),
  national_id text,
  tax_code text,
  registered_for_deduction boolean not null default true,
  effective_from date,
  effective_to date,
  note text,
  created_at timestamptz not null default now()
);
create index employee_dependents_employee_idx on public.employee_dependents (employee_id);
alter table public.employee_dependents enable row level security;

create trigger stamp_company_dependents before insert on public.employee_dependents
  for each row execute function public.stamp_employee_company();

create policy "dependents_select" on public.employee_dependents
  for select to authenticated using (public.can_access_employee(employee_id));
create policy "dependents_write" on public.employee_dependents
  for insert to authenticated with check (public.can_manage_employee(employee_id));
create policy "dependents_update" on public.employee_dependents
  for update to authenticated using (public.can_manage_employee(employee_id)) with check (public.can_manage_employee(employee_id));
create policy "dependents_delete" on public.employee_dependents
  for delete to authenticated using (public.can_manage_employee(employee_id));