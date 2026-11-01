create table public.work_shifts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  code text,
  start_time time not null default '08:00',
  end_time time not null default '17:30',
  break_minutes integer not null default 60,
  late_grace_minutes integer not null default 5,
  work_days text[] not null default array['mon','tue','wed','thu','fri'],
  color text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index work_shifts_company_idx on public.work_shifts (company_id);
alter table public.work_shifts enable row level security;
create trigger work_shifts_set_updated_at before update on public.work_shifts
  for each row execute function public.set_updated_at();

create or replace function public.can_view_attendance(target_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_company_role(target_company, array['owner','admin','hr','manager']);
$$;
create or replace function public.can_manage_attendance(target_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_company_role(target_company, array['owner','admin','hr']);
$$;

create policy "work_shifts_select" on public.work_shifts for select to authenticated using (public.can_view_attendance(company_id));
create policy "work_shifts_insert" on public.work_shifts for insert to authenticated with check (public.can_manage_attendance(company_id));
create policy "work_shifts_update" on public.work_shifts for update to authenticated using (public.can_manage_attendance(company_id)) with check (public.can_manage_attendance(company_id));
create policy "work_shifts_delete" on public.work_shifts for delete to authenticated using (public.can_manage_attendance(company_id));

create table public.attendance_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null default 'Cấu hình mặc định',
  methods text[] not null default array['phone'],
  scope_type text not null default 'company' check (scope_type in ('company','department','position','employee')),
  scope_value text,
  gps_latitude numeric(10,6),
  gps_longitude numeric(10,6),
  gps_radius_meters integer default 200,
  wifi_ssid text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index attendance_settings_company_idx on public.attendance_settings (company_id);
alter table public.attendance_settings enable row level security;
create trigger attendance_settings_set_updated_at before update on public.attendance_settings
  for each row execute function public.set_updated_at();

create policy "attendance_settings_select" on public.attendance_settings for select to authenticated using (public.can_view_attendance(company_id));
create policy "attendance_settings_insert" on public.attendance_settings for insert to authenticated with check (public.can_manage_attendance(company_id));
create policy "attendance_settings_update" on public.attendance_settings for update to authenticated using (public.can_manage_attendance(company_id)) with check (public.can_manage_attendance(company_id));
create policy "attendance_settings_delete" on public.attendance_settings for delete to authenticated using (public.can_manage_attendance(company_id));

create table public.shift_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  shift_id uuid not null references public.work_shifts(id) on delete cascade,
  scope_type text not null default 'company' check (scope_type in ('company','department','position','employee')),
  scope_value text,
  effective_from date,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shift_assignments_company_idx on public.shift_assignments (company_id);
alter table public.shift_assignments enable row level security;
create trigger shift_assignments_set_updated_at before update on public.shift_assignments
  for each row execute function public.set_updated_at();

create policy "shift_assignments_select" on public.shift_assignments for select to authenticated using (public.can_view_attendance(company_id));
create policy "shift_assignments_insert" on public.shift_assignments for insert to authenticated with check (public.can_manage_attendance(company_id));
create policy "shift_assignments_update" on public.shift_assignments for update to authenticated using (public.can_manage_attendance(company_id)) with check (public.can_manage_attendance(company_id));
create policy "shift_assignments_delete" on public.shift_assignments for delete to authenticated using (public.can_manage_attendance(company_id));

create table public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null default current_date,
  check_in timestamptz,
  check_out timestamptz,
  method text,
  latitude numeric(10,6),
  longitude numeric(10,6),
  shift_id uuid references public.work_shifts(id) on delete set null,
  status text not null default 'on_time' check (status in ('on_time','late','early_leave','absent','leave','holiday')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, work_date)
);
create index attendance_records_company_date_idx on public.attendance_records (company_id, work_date);
create index attendance_records_employee_idx on public.attendance_records (employee_id, work_date desc);
alter table public.attendance_records enable row level security;
create trigger attendance_records_set_updated_at before update on public.attendance_records
  for each row execute function public.set_updated_at();

create policy "attendance_records_select" on public.attendance_records
  for select to authenticated using (public.can_access_employee(employee_id));
create policy "attendance_records_insert" on public.attendance_records
  for insert to authenticated
  with check (
    public.can_manage_employee(employee_id)
    or exists (select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid())
  );
create policy "attendance_records_update" on public.attendance_records
  for update to authenticated
  using (
    public.can_manage_employee(employee_id)
    or exists (select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid())
  )
  with check (
    public.can_manage_employee(employee_id)
    or exists (select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid())
  );
create policy "attendance_records_delete" on public.attendance_records
  for delete to authenticated using (public.can_manage_employee(employee_id));