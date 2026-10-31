create or replace function public.guard_insurance_periods()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'closed' and new.end_date is null then
    raise exception 'Cần nhập tháng kết thúc khi chuyển sang trạng thái “Đã chốt sổ”.';
  end if;

  if new.end_date is not null and new.start_date is not null and new.end_date < new.start_date then
    raise exception 'Tháng kết thúc không được trước tháng bắt đầu.';
  end if;

  -- A new open period requires every previous period to be closed.
  if tg_op = 'INSERT' and (new.status <> 'closed' or new.end_date is null) then
    if exists (
      select 1 from public.employee_insurance_records r
      where r.employee_id = new.employee_id
        and r.insurance_type = new.insurance_type
        and (r.status <> 'closed' or r.end_date is null)
    ) then
      raise exception 'Còn giai đoạn bảo hiểm chưa chốt sổ. Hãy chốt giai đoạn trước (chọn trạng thái “Đã chốt sổ” và nhập tháng kết thúc) rồi mới tạo giai đoạn mới.';
    end if;
  end if;

  return new;
end;
$$;