-- #12 (bước 1): đưa công thức lương về máy chủ và bắt trigger tính lại thay vì chỉ chặn "vượt mức".
-- Hàm thuần khớp với src/lib/payroll-calc.ts (PIT_RULES, BASE_WAGE_RULES, computePit, computeEmployeeInsurance):
--   payroll_personal_deduction / payroll_dependent_deduction / payroll_compute_pit / payroll_insurance_cap /
--   payroll_employee_insurance. Đổi tham số thuế/lương cơ sở phải sửa CẢ hai nơi (test: pnpm test:payroll
--   và supabase/tests/payroll_server_calc.sql).
-- validate_payroll_item giờ tính lại phía server và từ chối khi lệch quá 2 đồng:
--   * lương cơ bản/phụ cấp chức vụ/trách nhiệm = mức hồ sơ lương hiệu lực x công tính lương / công chuẩn;
--   * lương đóng BH = hồ sơ lương; BH NLĐ = 10,5% có trần 20 x lương cơ sở, miễn khi nghỉ không lương >= 14 ngày;
--   * người phụ thuộc = hồ sơ nhân sự (khi tạo) / không đổi (khi điều chỉnh);
--   * thu nhập tính thuế và thuế TNCN theo biểu thuế của kỳ.
-- Còn do client gửi: công tính lương (từ chấm công/phép) và phụ cấp khác/khấu trừ khác (điều chỉnh thủ công).

-- payroll-calc.ts làm tròn công đến 2 chữ số (vd 13,42), cột cũ numeric(5,1) cắt còn 13,4 làm lệch lương khi server tính lại.
-- Chỉ nới độ chính xác, không mất dữ liệu.
alter table public.payroll_items
  alter column work_days type numeric(6,2),
  alter column attendance_days type numeric(6,2),
  alter column leave_days type numeric(6,2);

create or replace function public.payroll_personal_deduction(p_period date)
returns numeric language sql immutable security invoker set search_path = public as $$
  select case when p_period >= date '2026-01-01' then 15500000::numeric else 11000000::numeric end
$$;

create or replace function public.payroll_dependent_deduction(p_period date)
returns numeric language sql immutable security invoker set search_path = public as $$
  select case when p_period >= date '2026-01-01' then 6200000::numeric else 4400000::numeric end
$$;

-- Thuế TNCN lũy tiến từng phần (biểu tháng), làm tròn đến đồng.
create or replace function public.payroll_compute_pit(p_taxable numeric, p_period date)
returns numeric language plpgsql immutable security invoker set search_path = public as $$
declare
  ups numeric[];
  rates numeric[];
  remaining numeric := greatest(coalesce(p_taxable, 0), 0);
  previous numeric := 0;
  tax numeric := 0;
  amount numeric;
  i int;
begin
  if p_period >= date '2026-01-01' then
    ups := array[10000000, 30000000, 60000000, 100000000, null];
    rates := array[0.05, 0.1, 0.2, 0.3, 0.35];
  else
    ups := array[5000000, 10000000, 18000000, 32000000, 52000000, 80000000, null];
    rates := array[0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35];
  end if;
  for i in 1 .. array_length(rates, 1) loop
    amount := case when ups[i] is null then remaining else least(remaining, ups[i] - previous) end;
    exit when amount <= 0;
    tax := tax + amount * rates[i];
    remaining := remaining - amount;
    previous := coalesce(ups[i], previous);
  end loop;
  return round(tax);
end $$;

-- Trần lương đóng BH = 20 x lương cơ sở (2.340.000 đ; từ 01/07/2026: 2.530.000 đ).
create or replace function public.payroll_insurance_cap(p_period date)
returns numeric language sql immutable security invoker set search_path = public as $$
  select 20 * case when p_period >= date '2026-07-01' then 2530000::numeric else 2340000::numeric end
$$;

create or replace function public.payroll_employee_insurance(p_insurance_salary numeric, p_unpaid_days numeric, p_period date)
returns numeric language sql immutable security invoker set search_path = public as $$
  select case
    when coalesce(p_unpaid_days, 0) >= 14 then 0::numeric
    else round(least(greatest(coalesce(p_insurance_salary, 0), 0), public.payroll_insurance_cap(p_period)) * 0.105)
  end
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.payroll_personal_deduction(date)',
    'public.payroll_dependent_deduction(date)',
    'public.payroll_compute_pit(numeric, date)',
    'public.payroll_insurance_cap(date)',
    'public.payroll_employee_insurance(numeric, numeric, date)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

create or replace function public.validate_payroll_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_period public.payroll_periods;
  v_period_date date;
  v_period_end date;
  v_standard numeric;
  v_latest date;
  v_dependents integer;
  v_expected_ins numeric;
  v_expected_taxable numeric;
  tolerance constant numeric := 2;
begin
  if least(new.work_days, new.attendance_days, new.leave_days, new.base_salary, new.position_allowance,
           new.responsibility_allowance, new.other_allowance, new.gross_salary, new.insurance_salary,
           new.insurance_employee, new.taxable_income, new.tax_amount, new.other_deduction, new.dependents_count) < 0 then
    raise exception 'Bảng lương không hợp lệ: có giá trị âm (nhân sự %).', new.employee_name;
  end if;

  if abs(new.gross_salary - (new.base_salary + new.position_allowance + new.responsibility_allowance + new.other_allowance)) > tolerance then
    raise exception 'Bảng lương không hợp lệ: tổng thu nhập không khớp (nhân sự %).', new.employee_name;
  end if;

  if abs(new.net_salary - (new.gross_salary - new.insurance_employee - new.tax_amount - new.other_deduction)) > tolerance then
    raise exception 'Bảng lương không hợp lệ: thực nhận không khớp (nhân sự %).', new.employee_name;
  end if;

  select * into v_period from public.payroll_periods p where p.id = new.period_id;
  if not found then
    raise exception 'Bảng lương không hợp lệ: kỳ lương không tồn tại.';
  end if;
  v_period_date := make_date(v_period.year, v_period.month, 1);
  v_period_end := (v_period_date + interval '1 month' - interval '1 day')::date;
  v_standard := case when coalesce(v_period.standard_work_days, 0) > 0 then v_period.standard_work_days else 26 end;

  if new.work_days > v_standard + 0.01 then
    raise exception 'Bảng lương không hợp lệ: công tính lương vượt công chuẩn % (nhân sự %).', v_standard, new.employee_name;
  end if;

  -- Hồ sơ lương hiệu lực mới nhất của kỳ; nếu cùng ngày hiệu lực có nhiều bản ghi thì chấp nhận khớp một trong số đó.
  select max(s.effective_date) into v_latest
  from public.employee_salary_records s
  where s.employee_id = new.employee_id and s.effective_date <= v_period_end;
  if v_latest is null then
    raise exception 'Bảng lương không hợp lệ: nhân sự % chưa có hồ sơ lương.', new.employee_name;
  end if;

  if not exists (
    select 1 from public.employee_salary_records s
    where s.employee_id = new.employee_id and s.effective_date = v_latest
      and abs(new.base_salary - round(coalesce(s.base_salary, 0) * new.work_days / v_standard)) <= tolerance
      and abs(new.position_allowance - round(coalesce(s.position_allowance, 0) * new.work_days / v_standard)) <= tolerance
      and abs(new.responsibility_allowance - round(coalesce(s.responsibility_allowance, 0) * new.work_days / v_standard)) <= tolerance
      and abs(new.insurance_salary - coalesce(s.insurance_salary, s.base_salary, 0)) <= tolerance
  ) then
    raise exception 'Bảng lương không hợp lệ: lương/phụ cấp không khớp hồ sơ lương và ngày công (nhân sự %). Nếu hồ sơ lương vừa thay đổi, hãy tính lại bảng lương.', new.employee_name;
  end if;

  if tg_op = 'INSERT' then
    select greatest(coalesce(e.dependents_count, 0), 0) into v_dependents from public.employees e where e.id = new.employee_id;
    if coalesce(v_dependents, 0) <> new.dependents_count then
      raise exception 'Bảng lương không hợp lệ: số người phụ thuộc không khớp hồ sơ nhân sự (nhân sự %).', new.employee_name;
    end if;
  elsif new.dependents_count is distinct from old.dependents_count then
    raise exception 'Bảng lương không hợp lệ: không được sửa số người phụ thuộc trên phiếu lương, hãy tính lại bảng lương (nhân sự %).', new.employee_name;
  end if;

  v_expected_ins := case when new.gross_salary > 0
    then public.payroll_employee_insurance(new.insurance_salary, greatest(v_standard - new.work_days, 0), v_period_date)
    else 0 end;
  if abs(new.insurance_employee - v_expected_ins) > tolerance
     and not (tg_op = 'UPDATE' and new.insurance_employee = old.insurance_employee
              and new.work_days = old.work_days and new.insurance_salary = old.insurance_salary) then
    raise exception 'Bảng lương không hợp lệ: bảo hiểm NLĐ phải là % (nhân sự %).', v_expected_ins, new.employee_name;
  end if;

  v_expected_taxable := greatest(new.gross_salary - new.insurance_employee
    - public.payroll_personal_deduction(v_period_date)
    - new.dependents_count * public.payroll_dependent_deduction(v_period_date), 0);
  if abs(new.taxable_income - v_expected_taxable) > tolerance then
    raise exception 'Bảng lương không hợp lệ: thu nhập tính thuế phải là % (nhân sự %).', v_expected_taxable, new.employee_name;
  end if;
  if abs(new.tax_amount - public.payroll_compute_pit(v_expected_taxable, v_period_date)) > tolerance then
    raise exception 'Bảng lương không hợp lệ: thuế TNCN phải là % (nhân sự %).',
      public.payroll_compute_pit(v_expected_taxable, v_period_date), new.employee_name;
  end if;

  return new;
end $$;

revoke all on function public.validate_payroll_item() from public, anon, authenticated;

drop trigger if exists validate_payroll_item on public.payroll_items;
create trigger validate_payroll_item
  before insert or update of work_days, base_salary, position_allowance, responsibility_allowance, other_allowance,
    gross_salary, insurance_salary, insurance_employee, taxable_income, tax_amount, other_deduction, net_salary,
    dependents_count
  on public.payroll_items
  for each row execute function public.validate_payroll_item();
