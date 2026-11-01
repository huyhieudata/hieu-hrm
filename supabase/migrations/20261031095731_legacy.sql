create or replace function public.can_view_recruitment(target_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_company_role(target_company, array['owner','admin','hr','manager'])
    or public.has_permission(target_company, 'recruitment.view');
$$;

create or replace function public.can_manage_recruitment(target_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_permission(target_company, 'recruitment.create')
    or public.has_permission(target_company, 'recruitment.edit')
    or public.has_permission(target_company, 'recruitment.delete');
$$;