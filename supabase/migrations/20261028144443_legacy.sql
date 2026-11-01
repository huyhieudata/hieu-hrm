create or replace function public.apply_work_event_to_employee()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform set_config('nova.sync_from_history', '1', true);

  if new.event_type = 'resignation' then
    update public.employees
    set status = 'resigned',
        resignation_date = coalesce(new.start_date, current_date)
    where id = new.employee_id;

    update public.employee_contracts
    set status = 'terminated',
        end_date = coalesce(end_date, new.start_date, current_date)
    where employee_id = new.employee_id and status = 'active';

  elsif new.event_type in ('onboarding', 'return') then
    update public.employees
    set status = 'active', resignation_date = null
    where id = new.employee_id and status <> 'active';

  elsif new.event_type = 'leave' then
    update public.employees
    set status = 'leave'
    where id = new.employee_id and status not in ('resigned', 'leave');

  elsif new.event_type in ('promotion', 'title_change', 'transfer') then
    update public.employees
    set position = coalesce(new.position, position),
        department = coalesce(new.department, department),
        work_location = coalesce(nullif(btrim(coalesce(new.location, '')), ''), work_location)
    where id = new.employee_id and status <> 'resigned';

  elsif new.event_type = 'location_change' then
    update public.employees
    set work_location = coalesce(nullif(btrim(coalesce(new.location, '')), ''), work_location)
    where id = new.employee_id and status <> 'resigned';
  end if;

  perform set_config('nova.sync_from_history', '', true);
  return new;
end;
$$;

create or replace function public.log_employee_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('nova.sync_from_history', true), '') = '1' then
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'resigned' then
      insert into public.employee_work_history (employee_id, event_type, title, start_date, note)
      values (new.id, 'resignation', 'Nghỉ việc', coalesce(new.resignation_date, current_date),
        'Tự động ghi nhận khi chuyển trạng thái nhân sự sang nghỉ việc.');
    elsif new.status = 'leave' then
      insert into public.employee_work_history (employee_id, event_type, title, start_date, note)
      values (new.id, 'leave', 'Nghỉ phép dài hạn', current_date,
        'Tự động ghi nhận khi chuyển trạng thái nhân sự sang nghỉ phép.');
    elsif new.status = 'active' and old.status in ('resigned', 'leave') then
      insert into public.employee_work_history (employee_id, event_type, title, start_date, note)
      values (new.id, 'return', 'Quay lại làm việc', current_date,
        'Tự động ghi nhận khi chuyển trạng thái nhân sự sang đang làm việc.');
    end if;
  end if;
  return new;
end;
$$;