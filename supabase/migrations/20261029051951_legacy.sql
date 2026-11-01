create or replace function public.handle_new_company()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null and not public.is_platform_admin() then
    insert into public.company_members (company_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict (company_id, user_id) do update set role = 'owner', status = 'active';
  end if;
  return new;
end;
$$;