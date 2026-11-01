create table public.employee_assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  asset_code text,
  name text not null,
  category text not null default 'laptop' check (category in ('laptop','monitor','phone','vehicle','tool','furniture','other')),
  serial_number text,
  assigned_date date not null default current_date,
  return_date date,
  value numeric(14,2),
  condition text not null default 'good' check (condition in ('new','good','fair','damaged')),
  status text not null default 'assigned' check (status in ('assigned','returned','lost','damaged')),
  note text,
  created_at timestamptz not null default now()
);

create index employee_assets_employee_idx on public.employee_assets (employee_id);
alter table public.employee_assets enable row level security;

create trigger stamp_company_assets before insert on public.employee_assets
  for each row execute function public.stamp_employee_company();

create policy "assets_select" on public.employee_assets
  for select to authenticated using (public.can_access_employee(employee_id));
create policy "assets_write" on public.employee_assets
  for insert to authenticated with check (public.can_manage_employee(employee_id));
create policy "assets_update" on public.employee_assets
  for update to authenticated using (public.can_manage_employee(employee_id)) with check (public.can_manage_employee(employee_id));
create policy "assets_delete" on public.employee_assets
  for delete to authenticated using (public.can_manage_employee(employee_id));