alter table public.departments
  add column if not exists parent_id uuid references public.departments(id) on delete set null;

create table public.department_positions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  title text not null,
  level text,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index department_positions_department_idx on public.department_positions (department_id);
create index department_positions_company_idx on public.department_positions (company_id);
alter table public.department_positions enable row level security;

create trigger department_positions_set_updated_at before update on public.department_positions
  for each row execute function public.set_updated_at();

create policy "department_positions_select" on public.department_positions
  for select to authenticated using (public.can_view_recruitment(company_id));
create policy "department_positions_insert" on public.department_positions
  for insert to authenticated with check (public.can_manage_recruitment(company_id));
create policy "department_positions_update" on public.department_positions
  for update to authenticated using (public.can_manage_recruitment(company_id)) with check (public.can_manage_recruitment(company_id));
create policy "department_positions_delete" on public.department_positions
  for delete to authenticated using (public.can_manage_recruitment(company_id));

-- Demo org hierarchy + positions
update public.departments set parent_id = (select id from public.departments p where p.company_id = departments.company_id and p.name = 'Kinh doanh' limit 1)
where name = 'Chăm sóc khách hàng';
update public.departments set parent_id = (select id from public.departments p where p.company_id = departments.company_id and p.name = 'Nhân sự' limit 1)
where name = 'Pháp chế';
update public.departments set parent_id = (select id from public.departments p where p.company_id = departments.company_id and p.name = 'Kỹ thuật' limit 1)
where name = 'Vận hành';

insert into public.department_positions (company_id, department_id, title, level, sort_order)
select d.company_id, d.id, v.title, v.level, v.ord
from public.departments d
join (values
  ('Kỹ thuật', 'Backend Engineer', 'Chuyên viên', 1),
  ('Kỹ thuật', 'Frontend Engineer', 'Chuyên viên', 2),
  ('Kỹ thuật', 'QA Engineer', 'Nhân viên', 3),
  ('Kỹ thuật', 'DevOps Engineer', 'Chuyên viên', 4),
  ('Kinh doanh', 'Sales Executive', 'Nhân viên', 1),
  ('Kinh doanh', 'Account Manager', 'Chuyên viên', 2),
  ('Marketing', 'Product Designer', 'Chuyên viên', 1),
  ('Marketing', 'Content Specialist', 'Nhân viên', 2),
  ('Nhân sự', 'HR Executive', 'Nhân viên', 1),
  ('Nhân sự', 'Recruiter', 'Chuyên viên', 2),
  ('Tài chính', 'Kế toán tổng hợp', 'Chuyên viên', 1)
) as v(dept, title, level, ord) on v.dept = d.name
where not exists (
  select 1 from public.department_positions p where p.department_id = d.id and p.title = v.title
);