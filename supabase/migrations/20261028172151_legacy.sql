-- Org structure + onboarding checklist settings
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  manager_employee_id uuid references public.employees(id) on delete set null,
  manager_name text,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);
create index departments_company_idx on public.departments (company_id);
alter table public.departments enable row level security;

create trigger departments_set_updated_at before update on public.departments
  for each row execute function public.set_updated_at();

create policy "departments_select" on public.departments
  for select to authenticated using (public.can_view_recruitment(company_id));
create policy "departments_insert" on public.departments
  for insert to authenticated with check (public.can_manage_recruitment(company_id));
create policy "departments_update" on public.departments
  for update to authenticated using (public.can_manage_recruitment(company_id)) with check (public.can_manage_recruitment(company_id));
create policy "departments_delete" on public.departments
  for delete to authenticated using (public.can_manage_recruitment(company_id));

create table public.onboarding_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  label text not null,
  description text,
  required boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index onboarding_templates_company_idx on public.onboarding_checklist_templates (company_id);
alter table public.onboarding_checklist_templates enable row level security;

create trigger onboarding_templates_set_updated_at before update on public.onboarding_checklist_templates
  for each row execute function public.set_updated_at();

create policy "onboarding_templates_select" on public.onboarding_checklist_templates
  for select to authenticated using (public.can_view_recruitment(company_id));
create policy "onboarding_templates_insert" on public.onboarding_checklist_templates
  for insert to authenticated with check (public.can_manage_recruitment(company_id));
create policy "onboarding_templates_update" on public.onboarding_checklist_templates
  for update to authenticated using (public.can_manage_recruitment(company_id)) with check (public.can_manage_recruitment(company_id));
create policy "onboarding_templates_delete" on public.onboarding_checklist_templates
  for delete to authenticated using (public.can_manage_recruitment(company_id));

alter table public.onboarding_records
  add column if not exists manager_employee_id uuid references public.employees(id) on delete set null,
  add column if not exists manager_name text,
  add column if not exists checklist jsonb;

-- Seed defaults for the existing company
insert into public.departments (company_id, name, sort_order)
select c.id, d.name, d.ord
from public.companies c
cross join (values
  ('Kỹ thuật', 1), ('Kinh doanh', 2), ('Vận hành', 3), ('Marketing', 4),
  ('Tài chính', 5), ('Nhân sự', 6), ('Chăm sóc khách hàng', 7), ('Pháp chế', 8)
) as d(name, ord)
where not exists (select 1 from public.departments x where x.company_id = c.id);

insert into public.onboarding_checklist_templates (company_id, label, description, sort_order)
select c.id, t.label, t.descr, t.ord
from public.companies c
cross join (values
  ('Ký hợp đồng lao động', 'Ký HĐLĐ và bản cam kết bảo mật', 1),
  ('Bàn giao thiết bị', 'Laptop, màn hình, thẻ nhân viên', 2),
  ('Tạo tài khoản hệ thống', 'Email công ty, Nova HRM, các công cụ nội bộ', 3),
  ('Giới thiệu đội ngũ', 'Gặp quản lý trực tiếp và đồng nghiệp trong phòng ban', 4),
  ('Đào tạo định hướng', 'Nội quy công ty, quy trình làm việc, văn hoá', 5),
  ('Mục tiêu 30-60-90 ngày', 'Thống nhất mục tiêu thử việc với quản lý', 6)
) as t(label, descr, ord)
where not exists (select 1 from public.onboarding_checklist_templates x where x.company_id = c.id);