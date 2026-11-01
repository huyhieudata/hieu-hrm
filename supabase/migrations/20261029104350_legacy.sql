create table public.employee_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_name text,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index employee_notes_employee_idx on public.employee_notes (employee_id, created_at desc);
alter table public.employee_notes enable row level security;
create trigger employee_notes_set_updated_at before update on public.employee_notes
  for each row execute function public.set_updated_at();
create policy "employee_notes_select" on public.employee_notes for select to authenticated using (public.can_access_employee(employee_id));
create policy "employee_notes_insert" on public.employee_notes for insert to authenticated with check (public.can_manage_employee(employee_id) or author_id = auth.uid());
create policy "employee_notes_update" on public.employee_notes for update to authenticated using (author_id = auth.uid() or public.can_manage_employee(employee_id)) with check (author_id = auth.uid() or public.can_manage_employee(employee_id));
create policy "employee_notes_delete" on public.employee_notes for delete to authenticated using (author_id = auth.uid() or public.can_manage_employee(employee_id));

alter table public.employee_contacts
  add column if not exists author_name text;