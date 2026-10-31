-- Employee status simplified to three values: active / maternity / resigned.
-- (constraint swap on our own table; probation folds into active, leave becomes maternity)
alter table public.employees drop constraint if exists employees_status_check;

update public.employees set status = 'active' where status = 'probation';
update public.employees set status = 'maternity' where status = 'leave';

alter table public.employees
  add constraint employees_status_check check (status in ('active','resigned','maternity'));

create or replace function public.apply_work_event_to_employee()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  outstanding int;
  debt numeric;
  detail text;
begin
  if coalesce(current_setting('nova.skip_work_sync', true), '') = '1' then
    return new;
  end if;

  perform set_config('nova.sync_from_history', '1', true);

  if new.event_type = 'resignation' then
    outstanding := public.employee_outstanding_assets(new.employee_id);
    debt := public.employee_debt_outstanding(new.employee_id);
    if outstanding > 0 or debt > 0 then
      detail := concat_ws(' và ',
        case when outstanding > 0 then outstanding || ' tài sản chưa thu hồi' end,
        case when debt > 0 then 'công nợ ' || to_char(debt, 'FM999G999G999G999') || 'đ chưa tất toán' end);
      raise exception 'Không thể nghỉ việc: còn %.', detail;
    end if;

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
    set status = 'maternity'
    where id = new.employee_id and status not in ('resigned', 'maternity');

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
    elsif new.status = 'maternity' then
      insert into public.employee_work_history (employee_id, event_type, title, start_date, note)
      values (new.id, 'leave', 'Nghỉ thai sản', current_date,
        'Tự động ghi nhận khi chuyển trạng thái nhân sự sang nghỉ thai sản.');
    elsif new.status = 'active' and old.status in ('resigned', 'maternity') then
      insert into public.employee_work_history (employee_id, event_type, title, start_date, note)
      values (new.id, 'return', 'Quay lại làm việc', current_date,
        'Tự động ghi nhận khi chuyển trạng thái nhân sự sang đang làm việc.');
    end if;
  end if;
  return new;
end;
$$;