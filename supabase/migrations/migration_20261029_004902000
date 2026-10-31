create or replace function public.guard_attendance_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;

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

update public.attendance_records
set check_in = ((check_in at time zone 'UTC') at time zone 'Asia/Ho_Chi_Minh'),
    check_out = case when check_out is null then null else ((check_out at time zone 'UTC') at time zone 'Asia/Ho_Chi_Minh') end,
    session = 'morning'
where session = 'afternoon'
  and check_in is not null
  and (check_in at time zone 'UTC')::time < time '12:00';