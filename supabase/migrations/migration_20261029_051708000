create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
create policy "platform_admins_select_self" on public.platform_admins for select to authenticated using (user_id = auth.uid());

create table public.service_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  price_monthly numeric(14,2) not null default 0,
  price_yearly numeric(14,2) not null default 0,
  max_members integer,
  features text[] not null default array[]::text[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.service_plans enable row level security;
create trigger service_plans_set_updated_at before update on public.service_plans
  for each row execute function public.set_updated_at();

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins a where a.user_id = auth.uid());
$$;

create policy "service_plans_select" on public.service_plans for select to authenticated using (auth.uid() is not null);
create policy "service_plans_insert" on public.service_plans for insert to authenticated with check (public.is_platform_admin());
create policy "service_plans_update" on public.service_plans for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "service_plans_delete" on public.service_plans for delete to authenticated using (public.is_platform_admin());

alter table public.companies
  add column if not exists plan_id uuid references public.service_plans(id) on delete set null,
  add column if not exists subscription_expires_at date,
  add column if not exists workspace_status text not null default 'active';

alter table public.companies drop constraint if exists companies_workspace_status_check;
alter table public.companies
  add constraint companies_workspace_status_check check (workspace_status in ('active','trial','suspended'));

create policy "companies_platform_select" on public.companies for select to authenticated using (public.is_platform_admin());
create policy "companies_platform_insert" on public.companies for insert to authenticated with check (public.is_platform_admin());
create policy "companies_platform_update" on public.companies for update to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "companies_platform_delete" on public.companies for delete to authenticated using (public.is_platform_admin());

create policy "company_invites_platform_select" on public.company_invites for select to authenticated using (public.is_platform_admin());
create policy "company_invites_platform_insert" on public.company_invites for insert to authenticated with check (public.is_platform_admin());

insert into public.platform_admins (user_id, note)
select distinct m.user_id, 'Bootstrap từ chủ sở hữu workspace'
from public.company_members m
where m.role = 'owner'
on conflict (user_id) do nothing;

insert into public.service_plans (name, code, price_monthly, price_yearly, max_members, features)
select v.name, v.code, v.monthly, v.yearly, v.max_members, v.features::text[]
from (values
  ('Khởi nghiệp', 'STARTER', 990000, 9900000, 25, '{Quản lý nhân sự cơ bản,Chấm công,Nghỉ phép}'),
  ('Doanh nghiệp', 'BUSINESS', 2490000, 24900000, 200, '{Toàn bộ tính năng nhân sự,Tuyển dụng,Bảo hiểm,Báo cáo}'),
  ('Tập đoàn', 'ENTERPRISE', 5990000, 59900000, null, '{Không giới hạn nhân sự,Đa công ty,SSO,Hỗ trợ 24/7}')
) as v(name, code, monthly, yearly, max_members, features)
where not exists (select 1 from public.service_plans p where p.code = v.code);