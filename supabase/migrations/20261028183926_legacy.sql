update public.employee_insurance_records
set status = 'closed', end_date = '2025-12-31'
where employee_id = 'd9000000-0000-4000-8000-000000000002';

insert into public.employee_insurance_records (employee_id, insurance_type, start_date, status)
values ('d9000000-0000-4000-8000-000000000002', 'social', '2026-01-01', 'active');