-- Lương (rà lỗi 31/10/2026) #12: server kiểm tra tính hợp lệ của từng dòng bảng lương do client tính.
-- Chưa chuyển toàn bộ việc tính lương về server; trigger này chặn số liệu sai lệch/tự ý:
--   * các khoản tiền và ngày công không âm;
--   * tổng thu nhập = lương + các phụ cấp; thực nhận = tổng - BH - thuế - khấu trừ (sai số 2 đồng);
--   * lương cơ bản / phụ cấp chức vụ / trách nhiệm không vượt mức trong hồ sơ lương hiệu lực của kỳ;
--   * BH NLĐ không vượt 10,5% lương đóng BH; thu nhập tính thuế không vượt tổng thu nhập; thuế <= 35% thu nhập tính thuế.
create or replace function public.validate_payroll_item()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_period_end date;
  v_salary public.employee_salary_records;
  tolerance constant numeric := 2;
begin
  if least(new.work_days, new.attendance_days, new.leave_days, new.base_salary, new.position_allowance,
           new.responsibility_allowance, new.other_allowance, new.gross_salary, new.insurance_salary,
           new.insurance_employee, new.taxable_income, new.tax_amount, new.other_deduction) < 0 then
    raise exception 'Bảng lương không hợp lệ: có giá trị âm (nhân sự %).', new.employee_name;
  end if;

  if abs(new.gross_salary - (new.base_salary + new.position_allowance + new.responsibility_allowance + new.other_allowance)) > tolerance then
    raise exception 'Bảng lương không hợp lệ: tổng thu nhập không khớp (nhân sự %).', new.employee_name;
  end if;

  if abs(new.net_salary - (new.gross_salary - new.insurance_employee - new.tax_amount - new.other_deduction)) > tolerance then
    raise exception 'Bảng lương không hợp lệ: thực nhận không khớp (nhân sự %).', new.employee_name;
  end if;

  if new.insurance_employee > new.insurance_salary * 0.105 + tolerance
     or new.taxable_income > new.gross_salary + tolerance
     or new.tax_amount > new.taxable_income * 0.35 + tolerance then
    raise exception 'Bảng lương không hợp lệ: bảo hiểm hoặc thuế vượt mức (nhân sự %).', new.employee_name;
  end if;

  select (make_date(p.year, p.month, 1) + interval '1 month' - interval '1 day')::date into v_period_end
  from public.payroll_periods p where p.id = new.period_id;

  select s.* into v_salary
  from public.employee_salary_records s
  where s.employee_id = new.employee_id and s.effective_date <= coalesce(v_period_end, current_date)
  order by s.effective_date desc, s.created_at desc
  limit 1;

  if not found then
    raise exception 'Bảng lương không hợp lệ: nhân sự % chưa có hồ sơ lương.', new.employee_name;
  end if;

  if new.base_salary > coalesce(v_salary.base_salary, 0) + tolerance
     or new.position_allowance > coalesce(v_salary.position_allowance, 0) + tolerance
     or new.responsibility_allowance > coalesce(v_salary.responsibility_allowance, 0) + tolerance then
    raise exception 'Bảng lương không hợp lệ: lương/phụ cấp vượt hồ sơ lương (nhân sự %).', new.employee_name;
  end if;

  return new;
end $$;

drop trigger if exists validate_payroll_item on public.payroll_items;
create trigger validate_payroll_item
  before insert or update of base_salary, position_allowance, responsibility_allowance, other_allowance,
    gross_salary, insurance_salary, insurance_employee, taxable_income, tax_amount, other_deduction, net_salary
  on public.payroll_items
  for each row execute function public.validate_payroll_item();
