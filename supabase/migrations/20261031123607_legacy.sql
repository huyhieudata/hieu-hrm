create or replace function public.effective_permission_keys(target_company uuid, target_user uuid default auth.uid())
returns text[] language plpgsql stable security definer set search_path = public as $$
 declare
  v_role text;
  v_base text[];
  v_extra text[];
  v_denied text[];
  v_all text[];
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

  v_all := coalesce(v_base,'{}'::text[]) || coalesce(v_extra,'{}'::text[]);

  select coalesce(array_agg(distinct key), '{}'::text[]) into v_all
  from (
    select unnest(v_all) as key
    union
    select split_part(key, '.', 1) || '.view'
    from unnest(v_all) as key
    where key ~ '\.(create|edit|delete)$'
  ) as expanded;

  select coalesce(array_agg(distinct key), '{}'::text[]) into v_result
  from unnest(coalesce(v_all,'{}'::text[])) as key
  where key <> all(coalesce(v_denied,'{}'::text[]));

  return coalesce(v_result, '{}'::text[]);
end;
$$;