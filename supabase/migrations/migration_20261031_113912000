create or replace function public.can_view_attendance(target_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_company_role(target_company, array['owner','admin','hr','manager'])
    or public.has_permission(target_company, 'attendance.view')
    or public.has_permission(target_company, 'attendance.manage');
$$;

create or replace function public.can_manage_attendance(target_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_permission(target_company, 'attendance.create')
    or public.has_permission(target_company, 'attendance.edit')
    or public.has_permission(target_company, 'attendance.delete')
    or public.has_permission(target_company, 'attendance.manage');
$$;