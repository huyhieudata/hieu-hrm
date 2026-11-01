create or replace function public.provision_workspace_admin_profile(
  p_company uuid,
  p_user uuid,
  p_name text,
  p_email text,
  p_phone text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_department uuid;
  v_employee uuid;
  v_code text;
begin
  if auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'Chỉ quản trị viên hệ thống được cấp tài khoản workspace.';
  end if;

  select id into v_department
  from public.departments
  where company_id = p_company and lower(name) = lower('Ban quản lý')
  limit 1;

  if v_department is null then
    insert into public.departments (company_id, name, description, sort_order)
    values (p_company, 'Ban quản lý', 'Phòng ban quản trị workspace', 0)
    returning id into v_department;
  end if;

  insert into public.department_positions (company_id, department_id, title, is_management, sort_order)
  select p_company, v_department, 'Quản lý', true, 0
  where not exists (
    select 1 from public.department_positions
    where company_id = p_company and lower(title) = lower('Quản lý')
  );

  insert into public.company_members (company_id, user_id, role, status)
  values (p_company, p_user, 'owner', 'active')
  on conflict (company_id, user_id) do update set role = 'owner', status = 'active';

  select id into v_employee
  from public.employees
  where company_id = p_company
    and (
      user_id = p_user
      or code = 'NV001'
      or (p_email is not null and (work_email = p_email or personal_email = p_email))
      or (p_phone is not null and phone = p_phone)
    )
  order by created_at
  limit 1;

  if v_employee is null then
    select 'NV' || lpad((count(*) + 1)::text, 3, '0') into v_code
    from public.employees where company_id = p_company;

    insert into public.employees
      (company_id, user_id, code, full_name, position, department, status, work_email, personal_email, phone)
    values
      (p_company, p_user, v_code, coalesce(p_name, split_part(p_email, '@', 1)), 'Quản lý', 'Ban quản lý', 'active', p_email, p_email, p_phone)
    returning id into v_employee;
  else
    update public.employees
    set user_id = p_user,
        full_name = coalesce(p_name, full_name),
        position = 'Quản lý',
        department = 'Ban quản lý',
        work_email = coalesce(p_email, work_email),
        personal_email = coalesce(p_email, personal_email),
        phone = coalesce(p_phone, phone)
    where id = v_employee;
  end if;

  return v_employee;
end $$;

revoke all on function public.provision_workspace_admin_profile(uuid, uuid, text, text, text) from public;
grant execute on function public.provision_workspace_admin_profile(uuid, uuid, text, text, text) to service_role;

create or replace function public.provision_trial_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_plan uuid;
  v_company uuid;
  v_name text;
begin
  select id into v_plan from public.service_plans where code = 'TRIAL' limit 1;
  v_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(coalesce(new.email, 'Người dùng'), '@', 1)
  );

  insert into public.companies (name, plan_id, workspace_status, subscription_expires_at, created_by)
  values (v_name || ' Workspace', v_plan, 'trial', current_date + 30, new.id)
  returning id into v_company;

  perform public.provision_workspace_admin_profile(
    v_company, new.id, v_name, new.email, new.raw_user_meta_data ->> 'phone'
  );

  return new;
end $$;