alter table public.attendance_records
  add column if not exists session text;

update public.attendance_records
set session = case
  when check_in is not null and (check_in at time zone 'Asia/Ho_Chi_Minh')::time >= time '12:00' then 'afternoon'
  else 'morning'
end
where session is null;

alter table public.attendance_records alter column session set default 'morning';
alter table public.attendance_records alter column session set not null;

alter table public.attendance_records drop constraint if exists attendance_records_employee_id_work_date_key;
alter table public.attendance_records drop constraint if exists attendance_records_employee_date_session_key;
alter table public.attendance_records
  add constraint attendance_records_employee_date_session_key unique (employee_id, work_date, session);

alter table public.attendance_records drop constraint if exists attendance_records_session_check;
alter table public.attendance_records
  add constraint attendance_records_session_check check (session in ('morning','afternoon'));

create or replace function public.guard_attendance_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if public.can_manage_employee(new.employee_id) then
      return new;
    end if;
    if new.work_date <> current_date then
      raise exception 'Chỉ được chấm công cho ngày hôm nay.';
    end if;
    if new.check_in is not null and abs(extract(epoch from (now() - new.check_in))) > 900 then
      raise exception 'Giờ chấm công không hợp lệ.';
    end if;
    return new;
  end if;

  if public.can_manage_employee(old.employee_id) then
    return new;
  end if;

  if new.employee_id <> old.employee_id
     or new.company_id <> old.company_id
     or new.work_date <> old.work_date
     or new.session <> old.session
     or new.check_in is distinct from old.check_in
     or new.shift_id is distinct from old.shift_id then
    raise exception 'Bạn chỉ được chấm công ra, không được sửa giờ vào hoặc ngày công.';
  end if;

  return new;
end $$;

create trigger attendance_records_guard
  before insert or update on public.attendance_records
  for each row execute function public.guard_attendance_changes();