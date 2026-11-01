-- SEC-06: log_activity chống ghi giả; SEC-08: manager chỉ xem nhật ký nhân viên mình quản lý
alter table public.activity_logs add column if not exists source text not null default 'server';

create or replace function public.log_activity(target_company uuid, target_entity_type text, target_entity_id uuid, target_action text, target_summary text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or not public.has_company_role(target_company, array['owner','admin','hr']) then
    raise exception 'FORBIDDEN';
  end if;
  if target_action not in ('member_role_update','member_remove','member_employee_link','role_permission_update','permission_group_save','permission_update') then
    raise exception 'ACTION_NOT_ALLOWED';
  end if;
  -- activity_logs chỉ nhận candidate/employee/onboarding (check constraint); client chỉ được ghi 'employee'
  if target_entity_type <> 'employee' then
    raise exception 'ENTITY_NOT_ALLOWED';
  end if;
  if target_entity_type = 'employee' and not exists (select 1 from public.employees e where e.id = target_entity_id and e.company_id = target_company) then
    raise exception 'ENTITY_MISMATCH';
  end if;
  insert into public.activity_logs (company_id, entity_type, entity_id, action, summary, actor_id, actor_name, source)
  values (target_company, target_entity_type, target_entity_id, target_action,
          left(coalesce(target_summary,''), 300), auth.uid(),
          (select full_name from public.profiles where id = auth.uid()), 'client');
end; $$;

drop policy if exists activity_logs_select on public.activity_logs;
create policy activity_logs_select on public.activity_logs for select to authenticated using (
  public.has_company_role(company_id, array['owner','admin','hr'])
  or (entity_type = 'candidate' and public.can_view_recruitment(company_id))
  or (entity_type = 'employee' and public.can_access_employee(entity_id))
);
