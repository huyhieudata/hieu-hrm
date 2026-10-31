-- Close the first period, then a new period must be allowed
update public.employee_insurance_records
set status = 'closed', end_date = '2025-12-31'
where employee_id = 'd9000000-0000-4000-8000-000000000001';

insert into public.employee_insurance_records (employee_id, insurance_type, insurance_number, start_date, salary_base, employee_rate, employer_rate, status)
values ('d9000000-0000-4000-8000-000000000001', 'social', 'BHXH-TRG-2', '2026-01-01', 18000000, 8, 17.5, 'active');