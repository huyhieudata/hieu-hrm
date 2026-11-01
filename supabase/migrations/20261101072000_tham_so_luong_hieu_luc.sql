-- Bảng tham số lương có ngày hiệu lực (thuế TNCN, giảm trừ gia cảnh, lương cơ sở, tỷ lệ/trần BH).
-- company_id null = mặc định hệ thống (theo luật, chỉ sửa bằng migration); company_id = tham số riêng
-- công ty do kế toán nhập (quyền payroll.manage). Kỳ lương dùng bản ghi có effective_date <= ngày đầu kỳ
-- mới nhất; bản ghi công ty được ưu tiên khi cùng ngày hoặc mới hơn bản hệ thống.
-- Mỗi bản ghi là bộ tham số ĐẦY ĐỦ (snapshot). Hàm SQL và payroll-calc.ts dùng chung bảng này.

create table if not exists public.payroll_parameters (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  effective_date date not null,
  personal_deduction numeric not null check (personal_deduction >= 0),
  dependent_deduction numeric not null check (dependent_deduction >= 0),
  base_wage numeric not null check (base_wage > 0),
  insurance_cap_multiplier numeric not null default 20 check (insurance_cap_multiplier > 0),
  employee_insurance_rate numeric not null default 0.105 check (employee_insurance_rate between 0 and 1),
  insurance_unpaid_days_exempt numeric not null default 14 check (insurance_unpaid_days_exempt >= 0),
  -- [{"up_to": 10000000, "rate": 0.05}, ..., {"up_to": null, "rate": 0.35}] tăng dần, bậc cuối up_to null
  pit_brackets jsonb not null,
  source text,
  note text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (company_id, effective_date)
);

create or replace function public.validate_payroll_parameters()
returns trigger language plpgsql set search_path = public as $$
declare
  n int; i int; prev numeric := 0; up numeric; r numeric;
begin
  if jsonb_typeof(new.pit_brackets) <> 'array' or jsonb_array_length(new.pit_brackets) = 0 then
    raise exception 'Biểu thuế phải có ít nhất một bậc.';
  end if;
  n := jsonb_array_length(new.pit_brackets);
  for i in 0 .. n - 1 loop
    up := (new.pit_brackets -> i ->> 'up_to')::numeric;
    r := (new.pit_brackets -> i ->> 'rate')::numeric;
    if r is null or r < 0 or r > 1 then raise exception 'Thuế suất bậc % không hợp lệ.', i + 1; end if;
    if i < n - 1 and (up is null or up <= prev) then
      raise exception 'Ngưỡng bậc % phải lớn hơn bậc trước.', i + 1;
    end if;
    if i = n - 1 and up is not null then raise exception 'Bậc cuối không có ngưỡng trên (để trống).'; end if;
    prev := coalesce(up, prev);
  end loop;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.validate_payroll_parameters() from public, anon, authenticated;
drop trigger if exists validate_payroll_parameters on public.payroll_parameters;
create trigger validate_payroll_parameters before insert or update on public.payroll_parameters
  for each row execute function public.validate_payroll_parameters();

insert into public.payroll_parameters (company_id, effective_date, personal_deduction, dependent_deduction, base_wage, pit_brackets, source)
values
  (null, '1900-01-01', 11000000, 4400000, 2340000,
   '[{"up_to":5000000,"rate":0.05},{"up_to":10000000,"rate":0.1},{"up_to":18000000,"rate":0.15},{"up_to":32000000,"rate":0.2},{"up_to":52000000,"rate":0.25},{"up_to":80000000,"rate":0.3},{"up_to":null,"rate":0.35}]',
   'Luật 04/2007/QH12, NQ 954/2020/UBTVQH14, NĐ 73/2024/NĐ-CP'),
  (null, '2026-01-01', 15500000, 6200000, 2340000,
   '[{"up_to":10000000,"rate":0.05},{"up_to":30000000,"rate":0.1},{"up_to":60000000,"rate":0.2},{"up_to":100000000,"rate":0.3},{"up_to":null,"rate":0.35}]',
   'Luật 109/2025/QH15, NQ 110/2025/UBTVQH15, NĐ 73/2024/NĐ-CP'),
  (null, '2026-07-01', 15500000, 6200000, 2530000,
   '[{"up_to":10000000,"rate":0.05},{"up_to":30000000,"rate":0.1},{"up_to":60000000,"rate":0.2},{"up_to":100000000,"rate":0.3},{"up_to":null,"rate":0.35}]',
   'Luật 109/2025/QH15, NQ 110/2025/UBTVQH15, NĐ 161/2026/NĐ-CP')
on conflict (company_id, effective_date) do nothing;

alter table public.payroll_parameters enable row level security;
drop policy if exists payroll_parameters_select on public.payroll_parameters;
create policy payroll_parameters_select on public.payroll_parameters for select to authenticated
  using (company_id is null or public.is_company_member(company_id));
drop policy if exists payroll_parameters_insert on public.payroll_parameters;
create policy payroll_parameters_insert on public.payroll_parameters for insert to authenticated
  with check (company_id is not null and public.has_permission(company_id, 'payroll.manage'));
drop policy if exists payroll_parameters_update on public.payroll_parameters;
create policy payroll_parameters_update on public.payroll_parameters for update to authenticated
  using (company_id is not null and public.has_permission(company_id, 'payroll.manage'))
  with check (company_id is not null and public.has_permission(company_id, 'payroll.manage'));
drop policy if exists payroll_parameters_delete on public.payroll_parameters;
create policy payroll_parameters_delete on public.payroll_parameters for delete to authenticated
  using (company_id is not null and public.has_permission(company_id, 'payroll.manage'));
revoke all on public.payroll_parameters from anon;
grant select, insert, update, delete on public.payroll_parameters to authenticated;

create or replace function public.payroll_params(p_period date, p_company uuid)
returns public.payroll_parameters language sql stable security definer set search_path = public as $$
  select p.* from public.payroll_parameters p
  where p.effective_date <= p_period
    and (p.company_id is null or (p_company is not null and p.company_id = p_company))
  order by p.effective_date desc, (p.company_id is not null) desc
  limit 1
$$;

create or replace function public.payroll_personal_deduction(p_period date, p_company uuid)
returns numeric language sql stable security invoker set search_path = public as $$
  select (public.payroll_params(p_period, p_company)).personal_deduction
$$;
create or replace function public.payroll_dependent_deduction(p_period date, p_company uuid)
returns numeric language sql stable security invoker set search_path = public as $$
  select (public.payroll_params(p_period, p_company)).dependent_deduction
$$;
create or replace function public.payroll_insurance_cap(p_period date, p_company uuid)
returns numeric language sql stable security invoker set search_path = public as $$
  select x.insurance_cap_multiplier * x.base_wage from public.payroll_params(p_period, p_company) x
$$;

create or replace function public.payroll_compute_pit(p_taxable numeric, p_period date, p_company uuid)
returns numeric language plpgsql stable security invoker set search_path = public as $$
declare
  brackets jsonb := (public.payroll_params(p_period, p_company)).pit_brackets;
  remaining numeric := greatest(coalesce(p_taxable, 0), 0);
  previous numeric := 0;
  tax numeric := 0;
  amount numeric;
  up numeric;
  i int;
begin
  for i in 0 .. jsonb_array_length(brackets) - 1 loop
    up := (brackets -> i ->> 'up_to')::numeric;
    amount := case when up is null then remaining else least(remaining, up - previous) end;
    exit when amount <= 0;
    tax := tax + amount * (brackets -> i ->> 'rate')::numeric;
    remaining := remaining - amount;
    previous := coalesce(up, previous);
  end loop;
  return round(tax);
end $$;

create or replace function public.payroll_employee_insurance(p_insurance_salary numeric, p_unpaid_days numeric, p_period date, p_company uuid)
returns numeric language sql stable security invoker set search_path = public as $$
  select case
    when coalesce(p_unpaid_days, 0) >= x.insurance_unpaid_days_exempt then 0::numeric
    else round(least(greatest(coalesce(p_insurance_salary, 0), 0), x.insurance_cap_multiplier * x.base_wage) * x.employee_insurance_rate)
  end
  from public.payroll_params(p_period, p_company) x
$$;

-- Hàm cũ (không có công ty) dùng tham số hệ thống, giữ để tương thích.
create or replace function public.payroll_personal_deduction(p_period date)
returns numeric language sql stable security invoker set search_path = public as $$ select public.payroll_personal_deduction(p_period, null::uuid) $$;
create or replace function public.payroll_dependent_deduction(p_period date)
returns numeric language sql stable security invoker set search_path = public as $$ select public.payroll_dependent_deduction(p_period, null::uuid) $$;
create or replace function public.payroll_insurance_cap(p_period date)
returns numeric language sql stable security invoker set search_path = public as $$ select public.payroll_insurance_cap(p_period, null::uuid) $$;
create or replace function public.payroll_compute_pit(p_taxable numeric, p_period date)
returns numeric language sql stable security invoker set search_path = public as $$ select public.payroll_compute_pit(p_taxable, p_period, null::uuid) $$;
create or replace function public.payroll_employee_insurance(p_insurance_salary numeric, p_unpaid_days numeric, p_period date)
returns numeric language sql stable security invoker set search_path = public as $$ select public.payroll_employee_insurance(p_insurance_salary, p_unpaid_days, p_period, null::uuid) $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.payroll_params(date, uuid)',
    'public.payroll_personal_deduction(date, uuid)',
    'public.payroll_dependent_deduction(date, uuid)',
    'public.payroll_insurance_cap(date, uuid)',
    'public.payroll_compute_pit(numeric, date, uuid)',
    'public.payroll_employee_insurance(numeric, numeric, date, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- Trigger kiểm tra phiếu lương dùng tham số của công ty.
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
    then public.payroll_employee_insurance(new.insurance_salary, greatest(v_standard - new.work_days, 0), v_period_date, new.company_id)
    else 0 end;
  if abs(new.insurance_employee - v_expected_ins) > tolerance
     and not (tg_op = 'UPDATE' and new.insurance_employee = old.insurance_employee
              and new.work_days = old.work_days and new.insurance_salary = old.insurance_salary) then
    raise exception 'Bảng lương không hợp lệ: bảo hiểm NLĐ phải là % (nhân sự %).', v_expected_ins, new.employee_name;
  end if;

  v_expected_taxable := greatest(new.gross_salary - new.insurance_employee
    - public.payroll_personal_deduction(v_period_date, new.company_id)
    - new.dependents_count * public.payroll_dependent_deduction(v_period_date, new.company_id), 0);
  if abs(new.taxable_income - v_expected_taxable) > tolerance then
    raise exception 'Bảng lương không hợp lệ: thu nhập tính thuế phải là % (nhân sự %).', v_expected_taxable, new.employee_name;
  end if;
  if abs(new.tax_amount - public.payroll_compute_pit(v_expected_taxable, v_period_date, new.company_id)) > tolerance then
    raise exception 'Bảng lương không hợp lệ: thuế TNCN phải là % (nhân sự %).',
      public.payroll_compute_pit(v_expected_taxable, v_period_date, new.company_id), new.employee_name;
  end if;

  return new;
end $$;

revoke all on function public.validate_payroll_item() from public, anon, authenticated;
