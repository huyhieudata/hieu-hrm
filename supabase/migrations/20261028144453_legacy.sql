-- Reset the single throwaway trigger-test employee (created minutes ago for this check) and re-run the sync cycle

delete from public.employees where code = 'TRG-001';

insert into public.employees (id, company_id, code, full_name, department, position, status, hire_date)
values ('d0000000-0000-4000-8000-0000000000ff', (select id from public.companies order by created_at asc limit 1),
        'TRG-001', 'Trigger Test', 'Kỹ thuật', 'Nhân viên', 'active', '2024-01-05');

insert into public.employee_contracts (employee_id, contract_type, contract_no, start_date, base_salary, status)
values ('d0000000-0000-4000-8000-0000000000ff', 'fixed_term', 'TRG-HD-1', '2024-01-05', 15000000, 'active');

insert into public.employee_work_history (employee_id, event_type, title, start_date)
values ('d0000000-0000-4000-8000-0000000000ff', 'resignation', 'Nghỉ việc', '2026-10-20');

update public.employees set status = 'active' where code = 'TRG-001';

update public.employees set status = 'resigned', resignation_date = null where code = 'TRG-001';