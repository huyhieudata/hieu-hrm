create table public.request_approval_steps (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  request_type_id uuid not null references public.request_types(id) on delete cascade,
  step_order integer not null,
  name text,
  approver_type text not null check (approver_type in ('direct_manager','manager_of_manager','specific')),
  approver_employee_id uuid references public.employees(id) on delete set null,
  sla_hours integer not null default 24,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint request_approval_steps_key unique (request_type_id, step_order)
);
create index request_approval_steps_company_idx on public.request_approval_steps (company_id);
alter table public.request_approval_steps enable row level security;
create trigger request_approval_steps_set_updated_at before update on public.request_approval_steps
  for each row execute function public.set_updated_at();
create policy "request_approval_steps_select" on public.request_approval_steps for select to authenticated using (public.can_view_attendance(company_id));
create policy "request_approval_steps_insert" on public.request_approval_steps for insert to authenticated with check (public.can_manage_attendance(company_id));
create policy "request_approval_steps_update" on public.request_approval_steps for update to authenticated using (public.can_manage_attendance(company_id)) with check (public.can_manage_attendance(company_id));
create policy "request_approval_steps_delete" on public.request_approval_steps for delete to authenticated using (public.can_manage_attendance(company_id));

create table public.request_approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  request_id uuid not null references public.requests(id) on delete cascade,
  step_order integer not null,
  name text,
  approver_type text not null,
  approver_employee_id uuid references public.employees(id) on delete set null,
  sla_hours integer,
  due_at timestamptz,
  status text not null default 'pending' check (status in ('pending','approved','rejected','skipped')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);
create index request_approvals_request_idx on public.request_approvals (request_id, step_order);
create index request_approvals_approver_idx on public.request_approvals (approver_employee_id, status);
alter table public.request_approvals enable row level security;

create or replace function public.request_employee_id(target_request uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select employee_id from public.requests where id = target_request;
$$;

create or replace function public.is_request_approver(target_request uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.request_approvals a
    join public.employees e on e.id = a.approver_employee_id
    where a.request_id = target_request and e.user_id = auth.uid()
  );
$$;

create policy "request_approvals_select" on public.request_approvals for select to authenticated
  using (
    public.can_access_employee(public.request_employee_id(request_id))
    or public.is_request_approver(request_id)
  );
create policy "request_approvals_insert" on public.request_approvals for insert to authenticated
  with check (public.can_manage_employee(public.request_employee_id(request_id)));
create policy "request_approvals_update" on public.request_approvals for update to authenticated
  using (
    public.is_request_approver(request_id)
    or public.can_manage_employee(public.request_employee_id(request_id))
  )
  with check (
    public.is_request_approver(request_id)
    or public.can_manage_employee(public.request_employee_id(request_id))
  );
create policy "request_approvals_delete" on public.request_approvals for delete to authenticated
  using (public.can_manage_employee(public.request_employee_id(request_id)));

drop policy if exists "requests_select" on public.requests;
create policy "requests_select" on public.requests for select to authenticated
  using (public.can_access_employee(employee_id) or public.is_request_approver(id));

create or replace function public.build_request_approvals()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  step record;
  resolved uuid;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  for step in
    select * from public.request_approval_steps
    where request_type_id = new.request_type_id
    order by step_order
  loop
    resolved := null;

    if step.approver_type = 'direct_manager' then
      select e.manager_id into resolved from public.employees e where e.id = new.employee_id;
    elsif step.approver_type = 'manager_of_manager' then
      select e2.manager_id into resolved
      from public.employees e1
      join public.employees e2 on e2.id = e1.manager_id
      where e1.id = new.employee_id;
    else
      resolved := step.approver_employee_id;
    end if;

    if resolved = new.employee_id then
      resolved := null;
    end if;

    insert into public.request_approvals
      (company_id, request_id, step_order, name, approver_type, approver_employee_id, sla_hours, due_at, status)
    values
      (new.company_id, new.id, step.step_order, step.name, step.approver_type, resolved, step.sla_hours,
       now() + make_interval(hours => step.sla_hours), 'pending');
  end loop;

  return new;
end $$;

create trigger requests_build_approvals after insert on public.requests
  for each row execute function public.build_request_approvals();