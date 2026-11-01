create or replace function public.can_employee_module(target_employee uuid, module_key text, action_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employees e
    where e.id = target_employee
      and (
        (action_key = 'view' and e.user_id = auth.uid())
        or (action_key = 'view' and public.has_company_role(e.company_id, array['owner','admin','hr']))
        or (
          action_key = 'view'
          and module_key in ('employees','assets','attendance','onboarding','requests','leave')
          and public.has_company_role(e.company_id, array['manager'])
        )
        or (action_key <> 'view' and public.has_permission(e.company_id, module_key || '.' || action_key))
      )
  );
$$;