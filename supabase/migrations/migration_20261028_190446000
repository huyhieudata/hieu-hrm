create table public.headcount_plans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  year integer not null,
  note text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, year)
);
create index headcount_plans_company_idx on public.headcount_plans (company_id);
alter table public.headcount_plans enable row level security;

create trigger headcount_plans_set_updated_at before update on public.headcount_plans
  for each row execute function public.set_updated_at();

create policy "headcount_plans_select" on public.headcount_plans
  for select to authenticated using (public.can_view_recruitment(company_id));
create policy "headcount_plans_insert" on public.headcount_plans
  for insert to authenticated with check (public.can_manage_recruitment(company_id));
create policy "headcount_plans_update" on public.headcount_plans
  for update to authenticated using (public.can_manage_recruitment(company_id)) with check (public.can_manage_recruitment(company_id));
create policy "headcount_plans_delete" on public.headcount_plans
  for delete to authenticated using (public.can_manage_recruitment(company_id));

create table public.headcount_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.headcount_plans(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  position_id uuid references public.department_positions(id) on delete cascade,
  position_title text,
  month_1 integer not null default 0,
  month_2 integer not null default 0,
  month_3 integer not null default 0,
  month_4 integer not null default 0,
  month_5 integer not null default 0,
  month_6 integer not null default 0,
  month_7 integer not null default 0,
  month_8 integer not null default 0,
  month_9 integer not null default 0,
  month_10 integer not null default 0,
  month_11 integer not null default 0,
  month_12 integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, department_id, position_id)
);
create index headcount_items_plan_idx on public.headcount_items (plan_id);
alter table public.headcount_items enable row level security;

create trigger headcount_items_set_updated_at before update on public.headcount_items
  for each row execute function public.set_updated_at();

create policy "headcount_items_select" on public.headcount_items
  for select to authenticated using (public.can_view_recruitment(company_id));
create policy "headcount_items_insert" on public.headcount_items
  for insert to authenticated with check (public.can_manage_recruitment(company_id));
create policy "headcount_items_update" on public.headcount_items
  for update to authenticated using (public.can_manage_recruitment(company_id)) with check (public.can_manage_recruitment(company_id));
create policy "headcount_items_delete" on public.headcount_items
  for delete to authenticated using (public.can_manage_recruitment(company_id));