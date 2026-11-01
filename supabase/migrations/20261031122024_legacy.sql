create table if not exists public.company_role_permissions (
  company_id uuid not null references public.companies(id) on delete cascade,
  role text not null check (role in ('owner','admin','hr','manager','employee')),
  permissions text[] not null default '{}'::text[],
  updated_at timestamptz not null default now(),
  primary key (company_id, role)
);

alter table public.company_role_permissions enable row level security;

create or replace trigger company_role_permissions_updated_at before update on public.company_role_permissions
  for each row execute function public.set_updated_at();

create policy "company_role_permissions_select" on public.company_role_permissions
  for select to authenticated using (public.is_company_member(company_id) or public.is_platform_admin());
create policy "company_role_permissions_insert" on public.company_role_permissions
  for insert to authenticated with check (public.has_company_role(company_id, array['owner','admin']));
create policy "company_role_permissions_update" on public.company_role_permissions
  for update to authenticated using (public.has_company_role(company_id, array['owner','admin']))
  with check (public.has_company_role(company_id, array['owner','admin']));
create policy "company_role_permissions_delete" on public.company_role_permissions
  for delete to authenticated using (public.has_company_role(company_id, array['owner','admin']));

create or replace function public.all_permission_keys()
returns text[] language sql immutable as $$
  select array_cat(
    array(
      select m || '.' || a
      from unnest(array[
        'employees','contracts','insurance','attendance','shifts','requests','leave',
        'payroll','recruitment','planning','members','settings','assets','onboarding'
      ]) as m
      cross join unnest(array['view','create','edit','delete']) as a
    ),
    array[
      'company.manage','members.view','members.invite','members.manage',
      'employees.view','employees.manage','recruitment.view','recruitment.manage',
      'attendance.view','attendance.manage','leave.view','leave.approve',
      'payroll.view','payroll.manage'
    ]::text[]
  );
$$;

create or replace function public.default_role_permissions(target_role text)
returns text[] language sql immutable as $$
  select case target_role
    when 'owner' then public.all_permission_keys()
    when 'admin' then public.all_permission_keys()
    when 'hr' then (
      select array_agg(key)
      from unnest(public.all_permission_keys()) as key
      where key not in (
        'company.manage','members.manage',
        'members.create','members.edit','members.delete'
      )
    )
    when 'manager' then array[
      'employees.view','attendance.view','shifts.view','requests.view','requests.edit',
      'leave.view','leave.approve','recruitment.view','recruitment.edit',
      'onboarding.view','assets.view','members.view',
      'members.view','employees.view','attendance.view','leave.view','recruitment.view'
    ]::text[]
    when 'employee' then array[
      'employees.view','attendance.view','requests.view','leave.view','assets.view','members.view',
      'members.view','employees.view','attendance.view','leave.view'
    ]::text[]
    else '{}'::text[]
  end;
$$;

insert into public.company_role_permissions (company_id, role, permissions)
select c.id, r.role, public.default_role_permissions(r.role)
from public.companies c
cross join (values ('owner'),('admin'),('hr'),('manager'),('employee')) as r(role)
on conflict (company_id, role) do nothing;

create or replace function public.seed_company_role_permissions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.company_role_permissions (company_id, role, permissions)
  select new.id, r.role, public.default_role_permissions(r.role)
  from (values ('owner'),('admin'),('hr'),('manager'),('employee')) as r(role)
  on conflict (company_id, role) do nothing;
  return new;
end;
$$;

create or replace trigger companies_seed_role_permissions after insert on public.companies
  for each row execute function public.seed_company_role_permissions();

alter table public.employee_permissions add column if not exists denied_permissions text[] not null default '{}'::text[];

alter table public.permission_groups add column if not exists company_id uuid references public.companies(id) on delete cascade;
create index if not exists permission_groups_company_idx on public.permission_groups (company_id);

create policy "permission_groups_tenant_select" on public.permission_groups
  for select to authenticated using (company_id is null or public.is_company_member(company_id));
create policy "permission_groups_tenant_insert" on public.permission_groups
  for insert to authenticated with check (company_id is not null and public.has_company_role(company_id, array['owner','admin']));
create policy "permission_groups_tenant_update" on public.permission_groups
  for update to authenticated using (company_id is not null and public.has_company_role(company_id, array['owner','admin']))
  with check (company_id is not null and public.has_company_role(company_id, array['owner','admin']));
create policy "permission_groups_tenant_delete" on public.permission_groups
  for delete to authenticated using (company_id is not null and public.has_company_role(company_id, array['owner','admin']));

create or replace function public.effective_permission_keys(target_company uuid, target_user uuid default auth.uid())
returns text[] language plpgsql stable security definer set search_path = public as $$
 declare
  v_role text;
  v_base text[];
  v_extra text[];
  v_denied text[];
  v_result text[];
begin
  if target_user is null then return '{}'::text[]; end if;
  if target_user <> auth.uid() and not public.has_company_role(target_company, array['owner','admin','hr']) then
    return '{}'::text[];
  end if;

  select role into v_role from public.company_members
  where company_id = target_company and user_id = target_user and status = 'active';
  if v_role is null then return '{}'::text[]; end if;
  if v_role = 'owner' then return public.all_permission_keys(); end if;

  select permissions into v_base from public.company_role_permissions
  where company_id = target_company and role = v_role;
  if not found then v_base := public.default_role_permissions(v_role); end if;

  select ep.permissions, ep.denied_permissions into v_extra, v_denied
  from public.employee_permissions ep
  join public.employees e on e.id = ep.employee_id
  where e.company_id = target_company and e.user_id = target_user
  limit 1;

  select coalesce(array_agg(distinct key), '{}'::text[]) into v_result
  from unnest(coalesce(v_base,'{}'::text[]) || coalesce(v_extra,'{}'::text[])) as key
  where key <> all(coalesce(v_denied,'{}'::text[]));

  return coalesce(v_result, '{}'::text[]);
end;
$$;

create or replace function public.my_permissions(target_company uuid)
returns text[] language sql stable security definer set search_path = public as $$
  select public.effective_permission_keys(target_company, auth.uid());
$$;

create or replace function public.has_permission(target_company uuid, permission_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select permission_key = any(public.effective_permission_keys(target_company, auth.uid()));
$$;

revoke all on function public.effective_permission_keys(uuid, uuid) from public;
revoke all on function public.my_permissions(uuid) from public;
grant execute on function public.effective_permission_keys(uuid, uuid) to authenticated;
grant execute on function public.my_permissions(uuid) to authenticated;

create or replace function public.log_activity(
  target_company uuid,
  target_entity_type text,
  target_entity_id uuid,
  target_action text,
  target_summary text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_company_member(target_company) then
    raise exception 'FORBIDDEN';
  end if;
  insert into public.activity_logs (company_id, entity_type, entity_id, action, summary, actor_id, actor_name)
  values (
    target_company, target_entity_type, target_entity_id, target_action,
    target_summary, auth.uid(), (select full_name from public.profiles where id = auth.uid())
  );
end;
$$;

revoke all on function public.log_activity(uuid, text, uuid, text, text) from public;
grant execute on function public.log_activity(uuid, text, uuid, text, text) to authenticated;

create or replace function public.accept_company_invite(invite_token text)
returns uuid language plpgsql security definer set search_path = public as $$
 declare
  inv public.company_invites;
  actor uuid := auth.uid();
  actor_email text;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into inv from public.company_invites where token = invite_token for update;
  if not found then raise exception 'INVITE_NOT_FOUND'; end if;
  if inv.revoked then raise exception 'INVITE_REVOKED'; end if;
  if inv.accepted_at is not null then raise exception 'INVITE_USED'; end if;
  if inv.expires_at < now() then raise exception 'INVITE_EXPIRED'; end if;

  select lower(email) into actor_email from auth.users where id = actor;
  if inv.email is not null and lower(inv.email) <> coalesce(actor_email, '') then
    raise exception 'INVITE_EMAIL_MISMATCH';
  end if;

  insert into public.company_members (company_id, user_id, role, job_title, department, invited_by)
  values (inv.company_id, actor, inv.role, inv.job_title, inv.department, inv.invited_by)
  on conflict (company_id, user_id) do update set status = 'active';

  if actor_email is not null and not exists (
    select 1 from public.employees where company_id = inv.company_id and user_id = actor
  ) then
    update public.employees e
    set user_id = actor
    where e.id = (
      select id from public.employees
      where company_id = inv.company_id
        and user_id is null
        and lower(coalesce(work_email, personal_email, '')) = actor_email
      order by created_at asc
      limit 1
    );
  end if;

  update public.company_invites set accepted_at = now(), accepted_by = actor where id = inv.id;
  return inv.company_id;
end;
$$;