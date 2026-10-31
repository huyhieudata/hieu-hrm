alter table public.employees add column if not exists resignation_reason text;

-- Auto-record an onboarding milestone when a new employee record is created
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
  return new;
end;
$$;

create trigger log_employee_onboarding_after_insert
  after insert on public.employees
  for each row execute function public.log_employee_onboarding();

-- The auto-created onboarding row must not overwrite the status chosen at creation
create or replace function public.apply_work_event_to_employee()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('nova.skip_work_sync', true), '') = '1' then
    return new;
  end if;

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