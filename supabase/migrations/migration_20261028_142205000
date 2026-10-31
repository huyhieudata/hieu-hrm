-- Nova HRM: employee profile 360 module

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  code text not null,
  full_name text not null,
  gender text check (gender in ('male','female','other')),
  date_of_birth date,
  national_id text,
  national_id_issue_date date,
  national_id_issue_place text,
  nationality text default 'Việt Nam',
  marital_status text check (marital_status in ('single','married','divorced','widowed')),
  phone text,
  personal_email text,
  work_email text,
  current_address text,
  permanent_address text,
  avatar_url text,
  department text,
  position text,
  job_level text,
  employment_type text check (employment_type in ('full_time','part_time','intern','contractor')),
  status text not null default 'active' check (status in ('probation','active','leave','resigned')),
  hire_date date,
  probation_end_date date,
  official_date date,
  resignation_date date,
  manager_id uuid references public.employees(id) on delete set null,
  work_location text,
  bank_name text,
  bank_account text,
  bank_branch text,
  tax_code text,
  dependents_count integer default 0 check (dependents_count >= 0),
  education_level text,
  major text,
  school text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relation text,
  notes text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code)
);
create index employees_company_idx on public.employees (company_id);
create index employees_user_idx on public.employees (user_id);
alter table public.employees enable row level security;

create table public.employee_work_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  event_type text not null default 'transfer' check (event_type in ('onboarding','transfer','promotion','title_change','location_change','leave','return','resignation')),
  title text not null,
  department text,
  position text,
  location text,
  start_date date,
  end_date date,
  decision_no text,
  note text,
  created_at timestamptz not null default now()
);
create index employee_work_history_employee_idx on public.employee_work_history (employee_id);
alter table public.employee_work_history enable row level security;

create table public.employee_contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  contract_no text,
  contract_type text not null default 'fixed_term' check (contract_type in ('probation','fixed_term','indefinite','service','internship')),
  start_date date,
  end_date date,
  position text,
  department text,
  base_salary numeric(14,2),
  allowance numeric(14,2),
  status text not null default 'active' check (status in ('active','expired','terminated')),
  note text,
  created_at timestamptz not null default now()
);
create index employee_contracts_employee_idx on public.employee_contracts (employee_id);
alter table public.employee_contracts enable row level security;

create table public.employee_salary_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  effective_date date not null,
  base_salary numeric(14,2) not null default 0,
  position_allowance numeric(14,2) default 0,
  responsibility_allowance numeric(14,2) default 0,
  other_allowance numeric(14,2) default 0,
  insurance_salary numeric(14,2) default 0,
  kpi_bonus numeric(14,2) default 0,
  decision_no text,
  note text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index employee_salary_records_employee_idx on public.employee_salary_records (employee_id);
alter table public.employee_salary_records enable row level security;

create table public.employee_insurance_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  insurance_type text not null default 'social' check (insurance_type in ('social','health','unemployment','accident')),
  insurance_number text,
  start_date date,
  end_date date,
  salary_base numeric(14,2),
  employee_rate numeric(5,2) default 8,
  employer_rate numeric(5,2) default 17.5,
  status text not null default 'active' check (status in ('active','paused','closed')),
  note text,
  created_at timestamptz not null default now()
);
create index employee_insurance_records_employee_idx on public.employee_insurance_records (employee_id);
alter table public.employee_insurance_records enable row level security;

create table public.employee_rewards (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  title text not null,
  category text not null default 'bonus' check (category in ('bonus','commendation','award','certificate')),
  reward_date date not null default current_date,
  amount numeric(14,2),
  decision_no text,
  description text,
  created_at timestamptz not null default now()
);
create index employee_rewards_employee_idx on public.employee_rewards (employee_id);
alter table public.employee_rewards enable row level security;

create table public.employee_discipline_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  title text not null,
  category text not null default 'reminder' check (category in ('reminder','warning','salary_delay','demotion','dismissal')),
  effective_date date not null default current_date,
  decision_no text,
  description text,
  created_at timestamptz not null default now()
);
create index employee_discipline_records_employee_idx on public.employee_discipline_records (employee_id);
alter table public.employee_discipline_records enable row level security;

create table public.employee_training_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  course_name text not null,
  provider text,
  category text not null default 'internal' check (category in ('internal','external','certification','orientation')),
  start_date date,
  end_date date,
  cost numeric(14,2),
  result text default 'in_progress' check (result in ('in_progress','passed','failed','cancelled')),
  note text,
  created_at timestamptz not null default now()
);
create index employee_training_records_employee_idx on public.employee_training_records (employee_id);
alter table public.employee_training_records enable row level security;

create table public.employee_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  name text not null,
  category text not null default 'other' check (category in ('contract','identity','degree','certificate','insurance','medical','other')),
  file_path text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index employee_documents_employee_idx on public.employee_documents (employee_id);
alter table public.employee_documents enable row level security;

-- ---------- access helpers ----------
create or replace function public.can_manage_employee(target_employee uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employees e
    where e.id = target_employee
      and public.has_company_role(e.company_id, array['owner','admin','hr'])
  );
$$;

create or replace function public.can_access_employee(target_employee uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employees e
    where e.id = target_employee
      and (
        public.has_company_role(e.company_id, array['owner','admin','hr','manager'])
        or e.user_id = auth.uid()
      )
  );
$$;

create or replace function public.can_view_sensitive_employee(target_employee uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employees e
    where e.id = target_employee
      and (
        public.has_company_role(e.company_id, array['owner','admin','hr'])
        or e.user_id = auth.uid()
      )
  );
$$;

-- ---------- triggers ----------
create trigger employees_set_updated_at before update on public.employees
  for each row execute function public.set_updated_at();

create or replace function public.stamp_employee_company()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select company_id into new.company_id from public.employees where id = new.employee_id;
  if new.company_id is null then
    raise exception 'EMPLOYEE_NOT_FOUND';
  end if;
  return new;
end;
$$;

create trigger stamp_company_work_history before insert on public.employee_work_history
  for each row execute function public.stamp_employee_company();
create trigger stamp_company_contracts before insert on public.employee_contracts
  for each row execute function public.stamp_employee_company();
create trigger stamp_company_salary before insert on public.employee_salary_records
  for each row execute function public.stamp_employee_company();
create trigger stamp_company_insurance before insert on public.employee_insurance_records
  for each row execute function public.stamp_employee_company();
create trigger stamp_company_rewards before insert on public.employee_rewards
  for each row execute function public.stamp_employee_company();
create trigger stamp_company_discipline before insert on public.employee_discipline_records
  for each row execute function public.stamp_employee_company();
create trigger stamp_company_training before insert on public.employee_training_records
  for each row execute function public.stamp_employee_company();
create trigger stamp_company_documents before insert on public.employee_documents
  for each row execute function public.stamp_employee_company();

-- ---------- RLS: employees ----------
create policy "employees_select_authorized" on public.employees
  for select to authenticated using (public.can_access_employee(id));

create policy "employees_insert_hr" on public.employees
  for insert to authenticated
  with check (public.has_company_role(company_id, array['owner','admin','hr']));

create policy "employees_update_hr" on public.employees
  for update to authenticated
  using (public.can_manage_employee(id))
  with check (public.has_company_role(company_id, array['owner','admin','hr']));

create policy "employees_delete_admins" on public.employees
  for delete to authenticated
  using (public.has_company_role(company_id, array['owner','admin']));

-- ---------- RLS: work history / contracts / rewards / discipline / training ----------
create policy "work_history_select" on public.employee_work_history
  for select to authenticated using (public.can_access_employee(employee_id));
create policy "work_history_write" on public.employee_work_history
  for insert to authenticated with check (public.can_manage_employee(employee_id));
create policy "work_history_update" on public.employee_work_history
  for update to authenticated using (public.can_manage_employee(employee_id)) with check (public.can_manage_employee(employee_id));
create policy "work_history_delete" on public.employee_work_history
  for delete to authenticated using (public.can_manage_employee(employee_id));

create policy "contracts_select" on public.employee_contracts
  for select to authenticated using (public.can_view_sensitive_employee(employee_id));
create policy "contracts_write" on public.employee_contracts
  for insert to authenticated with check (public.can_manage_employee(employee_id));
create policy "contracts_update" on public.employee_contracts
  for update to authenticated using (public.can_manage_employee(employee_id)) with check (public.can_manage_employee(employee_id));
create policy "contracts_delete" on public.employee_contracts
  for delete to authenticated using (public.can_manage_employee(employee_id));

create policy "salary_select" on public.employee_salary_records
  for select to authenticated using (public.can_view_sensitive_employee(employee_id));
create policy "salary_write" on public.employee_salary_records
  for insert to authenticated with check (public.can_manage_employee(employee_id));
create policy "salary_update" on public.employee_salary_records
  for update to authenticated using (public.can_manage_employee(employee_id)) with check (public.can_manage_employee(employee_id));
create policy "salary_delete" on public.employee_salary_records
  for delete to authenticated using (public.can_manage_employee(employee_id));

create policy "insurance_select" on public.employee_insurance_records
  for select to authenticated using (public.can_view_sensitive_employee(employee_id));
create policy "insurance_write" on public.employee_insurance_records
  for insert to authenticated with check (public.can_manage_employee(employee_id));
create policy "insurance_update" on public.employee_insurance_records
  for update to authenticated using (public.can_manage_employee(employee_id)) with check (public.can_manage_employee(employee_id));
create policy "insurance_delete" on public.employee_insurance_records
  for delete to authenticated using (public.can_manage_employee(employee_id));

create policy "rewards_select" on public.employee_rewards
  for select to authenticated using (public.can_access_employee(employee_id));
create policy "rewards_write" on public.employee_rewards
  for insert to authenticated with check (public.can_manage_employee(employee_id));
create policy "rewards_update" on public.employee_rewards
  for update to authenticated using (public.can_manage_employee(employee_id)) with check (public.can_manage_employee(employee_id));
create policy "rewards_delete" on public.employee_rewards
  for delete to authenticated using (public.can_manage_employee(employee_id));

create policy "discipline_select" on public.employee_discipline_records
  for select to authenticated using (public.can_view_sensitive_employee(employee_id));
create policy "discipline_write" on public.employee_discipline_records
  for insert to authenticated with check (public.can_manage_employee(employee_id));
create policy "discipline_update" on public.employee_discipline_records
  for update to authenticated using (public.can_manage_employee(employee_id)) with check (public.can_manage_employee(employee_id));
create policy "discipline_delete" on public.employee_discipline_records
  for delete to authenticated using (public.can_manage_employee(employee_id));

create policy "training_select" on public.employee_training_records
  for select to authenticated using (public.can_access_employee(employee_id));
create policy "training_write" on public.employee_training_records
  for insert to authenticated with check (public.can_manage_employee(employee_id));
create policy "training_update" on public.employee_training_records
  for update to authenticated using (public.can_manage_employee(employee_id)) with check (public.can_manage_employee(employee_id));
create policy "training_delete" on public.employee_training_records
  for delete to authenticated using (public.can_manage_employee(employee_id));

create policy "documents_select" on public.employee_documents
  for select to authenticated using (public.can_view_sensitive_employee(employee_id));
create policy "documents_write" on public.employee_documents
  for insert to authenticated with check (public.can_manage_employee(employee_id) and uploaded_by = auth.uid());
create policy "documents_update" on public.employee_documents
  for update to authenticated using (public.can_manage_employee(employee_id)) with check (public.can_manage_employee(employee_id));
create policy "documents_delete" on public.employee_documents
  for delete to authenticated using (public.can_manage_employee(employee_id));