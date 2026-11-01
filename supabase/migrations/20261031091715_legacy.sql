create or replace function public.replace_payroll_items(target_period uuid, payload jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  target_company uuid;
  target_status text;
  inserted integer;
begin
  select company_id, status into target_company, target_status
  from public.payroll_periods where id = target_period;

  if target_company is null then
    raise exception 'Kỳ lương không tồn tại';
  end if;
  if not public.has_permission(target_company, 'payroll.edit') then
    raise exception 'Bạn không có quyền tính lương cho công ty này';
  end if;
  if target_status <> 'draft' then
    raise exception 'Kỳ lương đã chốt, không thể tính lại';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(payload, '[]'::jsonb)) as r(employee_id uuid)
    left join public.employees e on e.id = r.employee_id
    where e.company_id is distinct from target_company
  ) then
    raise exception 'Có nhân sự không thuộc công ty của kỳ lương';
  end if;

  delete from public.payroll_items where period_id = target_period;

  insert into public.payroll_items (
    company_id, period_id, employee_id, employee_name, employee_code, department,
    work_days, attendance_days, leave_days, base_salary, position_allowance,
    responsibility_allowance, other_allowance, gross_salary, insurance_salary,
    insurance_employee, taxable_income, tax_amount, other_deduction, net_salary, note
  )
  select
    target_company, target_period, r.employee_id, coalesce(r.employee_name, 'Nhân sự'), r.employee_code, r.department,
    coalesce(r.work_days, 0), coalesce(r.attendance_days, 0), coalesce(r.leave_days, 0),
    coalesce(r.base_salary, 0), coalesce(r.position_allowance, 0),
    coalesce(r.responsibility_allowance, 0), coalesce(r.other_allowance, 0),
    coalesce(r.gross_salary, 0), coalesce(r.insurance_salary, 0),
    coalesce(r.insurance_employee, 0), coalesce(r.taxable_income, 0), coalesce(r.tax_amount, 0),
    coalesce(r.other_deduction, 0), coalesce(r.net_salary, 0), r.note
  from jsonb_to_recordset(coalesce(payload, '[]'::jsonb)) as r(
    employee_id uuid, employee_name text, employee_code text, department text,
    work_days numeric, attendance_days numeric, leave_days numeric,
    base_salary numeric, position_allowance numeric, responsibility_allowance numeric,
    other_allowance numeric, gross_salary numeric, insurance_salary numeric,
    insurance_employee numeric, taxable_income numeric, tax_amount numeric,
    other_deduction numeric, net_salary numeric, note text
  );

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

revoke all on function public.replace_payroll_items(uuid, jsonb) from public;
revoke all on function public.replace_payroll_items(uuid, jsonb) from anon;
grant execute on function public.replace_payroll_items(uuid, jsonb) to authenticated;