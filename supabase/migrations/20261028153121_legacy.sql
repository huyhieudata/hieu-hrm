-- New status: pending (Chờ cập nhật) when an employee has no work-history records
alter table public.employees drop constraint if exists employees_status_check;
alter table public.employees
  add constraint employees_status_check check (status in ('pending','active','maternity','long_leave','resigned'));
alter table public.employees alter column status set default 'pending';

-- Creating a record auto-writes the onboarding event and activates the employee
create or replace function public.log_employee_onboarding()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('nova.skip_work_sync', '1', true);

  insert into public.employee_work_history (
    employee_id, event_type, title, department, position, location, start_date, note
  ) values (
    new.id, 'onboarding', 'Tiếp nhận nhân sự mới', new.department, new.position, new.work_location,
    coalesce(new.hire_date, current_date),
    'Tự động ghi nhận khi tạo hồ sơ nhân viên.'
  );

  perform set_config('nova.skip_work_sync', '', true);
  perform set_config('nova.sync_from_history', '1', true);
  update public.employees set status = 'active' where id = new.id and status = 'pending';
  perform set_config('nova.sync_from_history', '', true);

  return new;
end;
$$;

-- Re-derive the status from the latest remaining work-history event
create or replace function public.recompute_employee_status(target_employee uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  last_event text;
begin
  select event_type into last_event
  from public.employee_work_history
  where employee_id = target_employee
  order by start_date desc nulls last, created_at desc
  limit 1;

  perform set_config('nova.sync_from_history', '1', true);

  if last_event is null then
    update public.employees set status = 'pending', resignation_date = null where id = target_employee;
  elsif last_event = 'resignation' then
    update public.employees set status = 'resigned' where id = target_employee;
  elsif last_event = 'maternity' then
    update public.employees set status = 'maternity' where id = target_employee;
  elsif last_event = 'leave' then
    update public.employees set status = 'long_leave' where id = target_employee;
  else
    update public.employees set status = 'active', resignation_date = null where id = target_employee;
  end if;

  perform set_config('nova.sync_from_history', '', true);
end;
$$;

create or replace function public.sync_status_after_history_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.recompute_employee_status(old.employee_id);
  return old;
end;
$$;

drop trigger if exists sync_status_after_history_delete_trigger on public.employee_work_history;
create trigger sync_status_after_history_delete_trigger
  after delete on public.employee_work_history
  for each row execute function public.sync_status_after_history_delete();

-- Backfill: employees without any work-history record become "Chờ cập nhật"
do $$
begin
  perform set_config('nova.sync_from_history', '1', true);
  update public.employees e
  set status = 'pending', resignation_date = null
  where not exists (
    select 1 from public.employee_work_history w where w.employee_id = e.id
  );
  perform set_config('nova.sync_from_history', '', true);
end $$;