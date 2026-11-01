-- Tăng ca (OT) + công thức lương OT theo Điều 98 BLLĐ 2019:
--   ngày thường 150%, ngày nghỉ hằng tuần 200%, ngày lễ/Tết 300% lương giờ.
--   Lương giờ = lương cơ bản / ngày công chuẩn / 8.
--   Thuế TNCN: phần chênh lệch cao hơn lương giờ bình thường được miễn (Điều 4 TT 111/2013) -> chỉ 100% chịu thuế.
-- Server tự tính số giờ OT từ start_time/end_time (không tin client). Không seed vào công ty hiện có.
alter table public.request_types drop constraint if exists request_types_category_check;
alter table public.request_types add constraint request_types_category_check
  check (category in ('late','early_leave','leave','remote','attendance_fix','outside','other','overtime'));

alter table public.requests add column if not exists ot_kind text;
alter table public.requests add column if not exists ot_hours numeric(5,2) not null default 0;
alter table public.requests drop constraint if exists requests_ot_kind_check;
alter table public.requests add constraint requests_ot_kind_check check (ot_kind is null or ot_kind in ('weekday','weekend','holiday'));

alter table public.payroll_items add column if not exists overtime_hours numeric(7,2) not null default 0;
alter table public.payroll_items add column if not exists overtime_pay numeric(14,0) not null default 0;
-- Phần OT chịu thuế (100% lương giờ); phần chênh lệch miễn thuế.
alter table public.payroll_items add column if not exists overtime_taxable numeric(14,0) not null default 0;

create or replace function public.compute_request_leave_days()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cat text; v_days int; v_min numeric;
begin
  select category into v_cat from public.request_types where id = new.request_type_id;
  new.ot_hours := 0;
  if v_cat = 'overtime' then
    new.leave_days := 0;
    new.ot_kind := coalesce(new.ot_kind, 'weekday');
    new.end_date := new.start_date;
    if new.start_time is null or new.end_time is null then
      raise exception 'Đơn tăng ca cần có giờ bắt đầu và giờ kết thúc';
    end if;
    v_min := extract(epoch from (new.end_time - new.start_time)) / 60;
    if v_min <= 0 then v_min := v_min + 1440; end if;
    new.ot_hours := least(12, round(v_min / 15) * 0.25);
    return new;
  end if;
  new.ot_kind := null;
  if v_cat is distinct from 'leave' or new.start_date is null or new.end_date is null then
    new.leave_days := 0;
    return new;
  end if;
  v_days := greatest(0, least(62, (new.end_date - new.start_date) + 1));
  new.leave_days := round(v_days * case when new.session is null or new.session = 'full_day' then 1 else 0.5 end, 1);
  return new;
end $$;
revoke all on function public.compute_request_leave_days() from public, anon, authenticated;
drop trigger if exists a_requests_compute_leave_days on public.requests;
create trigger a_requests_compute_leave_days before insert or update of start_date, end_date, session, request_type_id, leave_days, start_time, end_time, ot_kind, ot_hours
  on public.requests for each row execute function public.compute_request_leave_days();

-- Công ty mới có sẵn loại đơn "Tăng ca".
create or replace function public.seed_default_request_types(_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sửa tên không dấu cũ.
  update public.request_types
     set name = 'Nghỉ phép'
   where company_id = _company_id
     and category = 'leave'
     and lower(btrim(name)) in ('phep', 'nghi phep', 'nghi phép');

  insert into public.request_types (company_id, name, category, deduct_leave, requires_attachment, max_days, sort_order)
  select _company_id, v.name, v.category, v.deduct, v.attach, v.max_days, v.sort_order
  from (values
    ('Nghỉ phép', 'leave', true, false, null::numeric, 1),
    ('Nghỉ ốm', 'leave', false, false, 30::numeric, 2),
    ('Nghỉ việc riêng không lương', 'leave', false, false, null::numeric, 3),
    ('Đi muộn', 'late', false, false, null::numeric, 10),
    ('Về sớm', 'early_leave', false, false, null::numeric, 11),
    ('Làm từ xa', 'remote', false, false, null::numeric, 12),
    ('Ra ngoài', 'outside', false, false, null::numeric, 13),
    ('Sửa chấm công', 'attendance_fix', false, false, null::numeric, 14),
    ('Tăng ca', 'overtime', false, false, null::numeric, 15)
  ) as v(name, category, deduct, attach, max_days, sort_order)
  where not exists (
    select 1 from public.request_types t
     where t.company_id = _company_id
       and lower(btrim(t.name)) = lower(v.name)
  )
  -- "Nghỉ phép năm" (seed cũ) coi như đã có Nghỉ phép.
  and not (v.name = 'Nghỉ phép' and exists (
    select 1 from public.request_types t
     where t.company_id = _company_id and t.category = 'leave' and t.deduct_leave
  ));
end;
$$;

revoke all on function public.seed_default_request_types(uuid) from public, anon, authenticated;

-- Lưu thêm giờ/tiền OT.
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
    insurance_employee, taxable_income, tax_amount, other_deduction, net_salary,
    dependents_count, note, overtime_hours, overtime_pay, overtime_taxable
  )
  select
    target_company, target_period, r.employee_id, coalesce(r.employee_name, 'Nhân sự'), r.employee_code, r.department,
    coalesce(r.work_days, 0), coalesce(r.attendance_days, 0), coalesce(r.leave_days, 0),
    coalesce(r.base_salary, 0), coalesce(r.position_allowance, 0),
    coalesce(r.responsibility_allowance, 0), coalesce(r.other_allowance, 0),
    coalesce(r.gross_salary, 0), coalesce(r.insurance_salary, 0),
    coalesce(r.insurance_employee, 0), coalesce(r.taxable_income, 0), coalesce(r.tax_amount, 0),
    coalesce(r.other_deduction, 0), coalesce(r.net_salary, 0),
    coalesce(r.dependents_count, 0)::smallint, r.note,
    coalesce(r.overtime_hours, 0), coalesce(r.overtime_pay, 0), coalesce(r.overtime_taxable, 0)
  from jsonb_to_recordset(coalesce(payload, '[]'::jsonb)) as r(
    employee_id uuid, employee_name text, employee_code text, department text,
    work_days numeric, attendance_days numeric, leave_days numeric,
    base_salary numeric, position_allowance numeric, responsibility_allowance numeric,
    other_allowance numeric, gross_salary numeric, insurance_salary numeric,
    insurance_employee numeric, taxable_income numeric, tax_amount numeric,
    other_deduction numeric, net_salary numeric, dependents_count numeric, note text,
    overtime_hours numeric, overtime_pay numeric, overtime_taxable numeric
  );

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;
revoke all on function public.replace_payroll_items(uuid, jsonb) from public, anon;
grant execute on function public.replace_payroll_items(uuid, jsonb) to authenticated;
