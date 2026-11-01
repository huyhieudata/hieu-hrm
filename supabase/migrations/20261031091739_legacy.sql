create or replace function public.guard_payroll_period_state()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' and old.status <> 'draft' then
    raise exception 'Chỉ xoá được kỳ lương nháp';
  end if;
  if tg_op = 'UPDATE' and old.status = 'paid' and new.status not in ('paid', 'locked') then
    raise exception 'Kỳ lương đã chi trả chỉ có thể hoàn tác về trạng thái đã chốt';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger payroll_periods_guard
  before update or delete on public.payroll_periods
  for each row execute function public.guard_payroll_period_state();