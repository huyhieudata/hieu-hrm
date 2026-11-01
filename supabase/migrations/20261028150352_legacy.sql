update public.employee_debts set settled_amount = amount, status = 'settled'
where employee_id = 'd0000000-0000-4000-8000-0000000000fd' and status = 'open';

update public.employees set status = 'resigned', resignation_date = '2026-10-28', resignation_reason = 'Kiểm tra luồng'
where code = 'TRG-003' and status = 'active';