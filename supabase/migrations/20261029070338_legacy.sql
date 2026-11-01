create table public.approval_workflows (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  scope_type text not null default 'company' check (scope_type in ('company','department','position','employee')),
  scope_value text,
  effective_from date,
  effective_to date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index approval_workflows_company_idx on public.approval_workflows (company_id);
alter table public.approval_workflows enable row level security;
create trigger approval_workflows_set_updated_at before update on public.approval_workflows
  for each row execute function public.set_updated_at();
create policy "approval_workflows_select" on public.approval_workflows for select to authenticated using (public.can_view_attendance(company_id));
create policy "approval_workflows_insert" on public.approval_workflows for insert to authenticated with check (public.can_manage_attendance(company_id));
create policy "approval_workflows_update" on public.approval_workflows for update to authenticated using (public.can_manage_attendance(company_id)) with check (public.can_manage_attendance(company_id));
create policy "approval_workflows_delete" on public.approval_workflows for delete to authenticated using (public.can_manage_attendance(company_id));

create table public.approval_workflow_types (
  workflow_id uuid not null references public.approval_workflows(id) on delete cascade,
  request_type_id uuid not null references public.request_types(id) on delete cascade,
  primary key (workflow_id, request_type_id)
);
alter table public.approval_workflow_types enable row level security;
create policy "approval_workflow_types_select" on public.approval_workflow_types for select to authenticated
  using (exists (select 1 from public.approval_workflows w where w.id = workflow_id and public.can_view_attendance(w.company_id)));
create policy "approval_workflow_types_write" on public.approval_workflow_types for insert to authenticated
  with check (exists (select 1 from public.approval_workflows w where w.id = workflow_id and public.can_manage_attendance(w.company_id)));
create policy "approval_workflow_types_delete" on public.approval_workflow_types for delete to authenticated
  using (exists (select 1 from public.approval_workflows w where w.id = workflow_id and public.can_manage_attendance(w.company_id)));

create table public.approval_workflow_steps (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.approval_workflows(id) on delete cascade,
  step_order integer not null,
  name text,
  approver_type text not null check (approver_type in ('direct_manager','manager_of_manager','specific')),
  approver_employee_id uuid references public.employees(id) on delete set null,
  sla_hours integer not null default 24,
  created_at timestamptz not null default now(),
  unique (workflow_id, step_order)
);
alter table public.approval_workflow_steps enable row level security;
create policy "approval_workflow_steps_select" on public.approval_workflow_steps for select to authenticated
  using (exists (select 1 from public.approval_workflows w where w.id = workflow_id and public.can_view_attendance(w.company_id)));
create policy "approval_workflow_steps_insert" on public.approval_workflow_steps for insert to authenticated
  with check (exists (select 1 from public.approval_workflows w where w.id = workflow_id and public.can_manage_attendance(w.company_id)));
create policy "approval_workflow_steps_delete" on public.approval_workflow_steps for delete to authenticated
  using (exists (select 1 from public.approval_workflows w where w.id = workflow_id and public.can_manage_attendance(w.company_id)));

create or replace function public.build_request_approvals()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  step record;
  resolved uuid;
  v_workflow uuid;
  v_department text;
  v_position text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select department, position into v_department, v_position
  from public.employees where id = new.employee_id;

  select w.id into v_workflow
  from public.approval_workflows w
  join public.approval_workflow_types t on t.workflow_id = w.id
  where w.company_id = new.company_id
    and w.active
    and t.request_type_id = new.request_type_id
    and (w.effective_from is null or w.effective_from <= new.start_date)
    and (w.effective_to is null or w.effective_to >= new.start_date)
    and (
      w.scope_type = 'company'
      or (w.scope_type = 'department' and w.scope_value = v_department)
      or (w.scope_type = 'position' and w.scope_value = v_position)
      or (w.scope_type = 'employee' and w.scope_value = new.employee_id::text)
    )
  order by case w.scope_type
             when 'employee' then 3
             when 'position' then 2
             when 'department' then 1
             else 0
           end desc,
           w.created_at desc
  limit 1;

  for step in
    select step_order, name, approver_type, approver_employee_id, sla_hours
    from (
      select step_order, name, approver_type, approver_employee_id, sla_hours
      from public.approval_workflow_steps
      where v_workflow is not null and workflow_id = v_workflow
      union all
      select step_order, name, approver_type, approver_employee_id, sla_hours
      from public.request_approval_steps
      where v_workflow is null and request_type_id = new.request_type_id
    ) combined
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