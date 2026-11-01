-- SEC-02: chỉ owner/admin được gán/sửa quyền riêng của hồ sơ; không ai (trừ owner) tự sửa quyền của chính mình.
create or replace function public.can_assign_employee_permissions(target_employee uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.employees e
    where e.id = target_employee
      and public.has_company_role(e.company_id, array['owner','admin'])
      and (e.user_id is distinct from auth.uid() or public.has_company_role(e.company_id, array['owner']))
  );
$$;
revoke all on function public.can_assign_employee_permissions(uuid) from public, anon;
grant execute on function public.can_assign_employee_permissions(uuid) to authenticated;

drop policy if exists employee_permissions_insert on public.employee_permissions;
drop policy if exists employee_permissions_update on public.employee_permissions;
drop policy if exists employee_permissions_delete on public.employee_permissions;
create policy employee_permissions_insert on public.employee_permissions for insert to authenticated
  with check (public.can_assign_employee_permissions(employee_id));
create policy employee_permissions_update on public.employee_permissions for update to authenticated
  using (public.can_assign_employee_permissions(employee_id))
  with check (public.can_assign_employee_permissions(employee_id));
create policy employee_permissions_delete on public.employee_permissions for delete to authenticated
  using (public.can_assign_employee_permissions(employee_id));

-- Lớp phòng thủ thứ hai (kể cả khi policy bị nới sau này). Service role / migration (auth.uid() null) được bỏ qua.
create or replace function public.guard_employee_permissions_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_emp uuid := coalesce(new.employee_id, old.employee_id);
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  if not public.can_assign_employee_permissions(v_emp) then
    raise exception 'PERMISSION_ASSIGN_FORBIDDEN' using hint = 'Chỉ Owner/Admin được gán quyền; không tự cấp quyền cho chính mình.';
  end if;
  insert into public.activity_logs (company_id, entity_type, entity_id, action, summary, actor_id, actor_name)
  select e.company_id, 'employee', e.id, 'permissions_changed', 'Thay đổi quyền riêng của hồ sơ', auth.uid(),
         (select full_name from public.profiles where id = auth.uid())
  from public.employees e where e.id = v_emp;
  return coalesce(new, old);
end $$;
drop trigger if exists guard_employee_permissions_change_t on public.employee_permissions;
create trigger guard_employee_permissions_change_t before insert or update or delete on public.employee_permissions
  for each row execute function public.guard_employee_permissions_change();
