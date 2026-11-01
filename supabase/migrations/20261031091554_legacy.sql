create or replace function public.guard_payroll_items_draft()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  target_period uuid;
  target_status text;
begin
  target_period := case when tg_op = 'DELETE' then old.period_id else new.period_id end;
  select status into target_status from public.payroll_periods where id = target_period;
  if target_status is not null and target_status <> 'draft' then
    raise exception 'Kỳ lương đã chốt, không thể thay đổi bảng lương';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger payroll_items_guard
  before insert or update or delete on public.payroll_items
  for each row execute function public.guard_payroll_items_draft();

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
    target_company, target_period, r.employee_id, r.employee_name, r.employee_code, r.department,
    r.work_days, r.attendance_days, r.leave_days, r.base_salary, r.position_allowance,
    r.responsibility_allowance, r.other_allowance, r.gross_salary, r.insurance_salary,
    r.insurance_employee, r.taxable_income, r.tax_amount, r.other_deduction, r.net_salary, r.note
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