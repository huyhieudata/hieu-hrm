create table public.leave_policy_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  policy_id uuid not null references public.leave_policies(id) on delete cascade,
  name text not null,
  days numeric(5,1) not null default 0,
  carries_over boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leave_policy_items_policy_idx on public.leave_policy_items (policy_id);
alter table public.leave_policy_items enable row level security;
create trigger leave_policy_items_set_updated_at before update on public.leave_policy_items
  for each row execute function public.set_updated_at();
create policy "leave_policy_items_select" on public.leave_policy_items for select to authenticated
  using (public.has_company_role(company_id, array['owner','admin','hr','manager']));
create policy "leave_policy_items_insert" on public.leave_policy_items for insert to authenticated
  with check (public.can_manage_attendance(company_id));
create policy "leave_policy_items_update" on public.leave_policy_items for update to authenticated
  using (public.can_manage_attendance(company_id)) with check (public.can_manage_attendance(company_id));
create policy "leave_policy_items_delete" on public.leave_policy_items for delete to authenticated
  using (public.can_manage_attendance(company_id));

insert into public.leave_policy_items (company_id, policy_id, name, days, carries_over, sort_order)
select p.company_id, p.id, 'Phép năm', p.days_per_year, true, 1
from public.leave_policies p
where not exists (select 1 from public.leave_policy_items i where i.policy_id = p.id);