create table public.employee_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  contact_date date not null default current_date,
  channel text not null default 'email',
  state text not null default 'appointment',
  result text,
  note text,
  attachment_path text,
  attachment_name text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index employee_contacts_employee_idx on public.employee_contacts (employee_id, contact_date desc);
alter table public.employee_contacts enable row level security;
create trigger employee_contacts_set_updated_at before update on public.employee_contacts
  for each row execute function public.set_updated_at();
create policy "employee_contacts_select" on public.employee_contacts for select to authenticated using (public.can_access_employee(employee_id));
create policy "employee_contacts_insert" on public.employee_contacts for insert to authenticated with check (public.can_manage_employee(employee_id));
create policy "employee_contacts_update" on public.employee_contacts for update to authenticated using (public.can_manage_employee(employee_id)) with check (public.can_manage_employee(employee_id));
create policy "employee_contacts_delete" on public.employee_contacts for delete to authenticated using (public.can_manage_employee(employee_id));