create or replace function public.employee_outstanding_assets(target_employee uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(count(*), 0)::int
  from public.employee_assets
  where employee_id = target_employee and status <> 'returned';
$$;

create or replace function public.prepare_employee_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  outstanding int;
begin
  if new.status = 'resigned' then
    if new.resignation_date is null then
      new.resignation_date = current_date;
    end if;

    if tg_op = 'UPDATE' then
      outstanding := public.employee_outstanding_assets(new.id);
      if outstanding > 0 then
        raise exception 'Không thể nghỉ việc: còn % tài sản chưa thu hồi. Hãy thu hồi tài sản trước.', outstanding;
      end if;
    end if;
  elsif new.status = 'active' then
    new.resignation_date = null;
  end if;
  return new;
end;
$$;

create or replace function public.apply_work_event_to_employee()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  outstanding int;
begin
  if coalesce(current_setting('nova.skip_work_sync', true), '') = '1' then
    return new;
  end if;

  perform set_config('nova.sync_from_history', '1', true);

  if new.event_type = 'resignation' then
    outstanding := public.employee_outstanding_assets(new.employee_id);
    if outstanding > 0 then
      raise exception 'Không thể nghỉ việc: còn % tài sản chưa thu hồi. Hãy thu hồi tài sản trước.', outstanding;
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