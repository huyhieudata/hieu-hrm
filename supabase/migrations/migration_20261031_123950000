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
      'employees.view','attendance.view','shifts.view','requests.view',
      'leave.view','leave.approve','recruitment.view',
      'onboarding.view','assets.view','members.view',
      'members.view','employees.view','attendance.view','leave.view','recruitment.view'
    ]::text[]
    when 'employee' then array[
      'employees.view','attendance.view','requests.view','leave.view','assets.view',
      'employees.view','attendance.view','leave.view'
    ]::text[]
    else '{}'::text[]
  end;
$$;

update public.company_role_permissions
set permissions = public.default_role_permissions(role), updated_at = now()
where role = 'employee';