-- Sync work-history events with the employee record (status, dates, position, department, contracts)

create or replace function public.apply_work_event_to_employee()
returns trigger language plpgsql security definer set search_path = public as $$
begin
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

  return new;
end;
$$;

create trigger apply_work_event_after_insert
  after insert on public.employee_work_history
  for each row execute function public.apply_work_event_to_employee();

-- Keep resignation_date consistent when the status is changed from the employee form
create or replace function public.prepare_employee_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'resigned' then
    if new.resignation_date is null then
      new.resignation_date = current_date;
    end if;
  elsif new.status = 'active' then
    new.resignation_date = null;
  end if;
  return new;
end;
$$;

create trigger prepare_employee_status_before_update
  before update on public.employees
  for each row execute function public.prepare_employee_status();

create trigger prepare_employee_status_before_insert
  before insert on public.employees
  for each row execute function public.prepare_employee_status();

-- Status changes made on the employee record are written back to the work history
create or replace function public.log_employee_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'resigned' then
      insert into public.employee_work_history (employee_id, event_type, title, start_date, note)
      values (
        new.id, 'resignation', 'Nghỉ việc',
        coalesce(new.resignation_date, current_date),
        'Tự động ghi nhận khi chuyển trạng thái nhân sự sang nghỉ việc.'
      );
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

create trigger log_employee_status_change_after_update
  after update of status on public.employees
  for each row execute function public.log_employee_status_change();