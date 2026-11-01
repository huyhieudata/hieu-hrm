-- Giới hạn "tối đa N ngày" của loại đơn: đơn nghỉ tính theo ngày làm việc (bỏ cuối tuần, ngày lễ, nửa ngày = 0,5);
-- loại khác tính theo ngày lịch. Chỉ kiểm khi tạo đơn hoặc đổi ngày/buổi/loại, không đụng đơn cũ. Idempotent.
create or replace function public.enforce_request_max_days()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_max integer; v_cat text; v_days numeric;
begin
  if tg_op = 'UPDATE' and new.start_date = old.start_date and new.end_date = old.end_date
     and new.session is not distinct from old.session and new.request_type_id = old.request_type_id then
    return new;
  end if;
  select max_days, category into v_max, v_cat from public.request_types where id = new.request_type_id;
  if v_max is null or v_max <= 0 then return new; end if;
  if v_cat = 'leave' then
    v_days := public.company_workday_count(new.company_id, new.start_date, new.end_date)
              * case when new.session in ('morning','afternoon') then 0.5 else 1 end;
  else
    v_days := new.end_date - new.start_date + 1;
  end if;
  if v_days > v_max then
    raise exception 'Loại đơn này tối đa % ngày (đơn đang tính % ngày).', v_max, v_days using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.enforce_request_max_days() from public, anon, authenticated;
drop trigger if exists enforce_request_max_days_t on public.requests;
create trigger enforce_request_max_days_t before insert or update on public.requests
  for each row execute function public.enforce_request_max_days();
