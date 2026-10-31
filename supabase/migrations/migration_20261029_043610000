insert into public.employee_salary_records
  (company_id, employee_id, contract_id, effective_date, base_salary, other_allowance, insurance_salary, decision_no, note)
select c.company_id, c.employee_id, c.id, coalesce(c.start_date, current_date),
       coalesce(c.base_salary, 0), coalesce(c.allowance, 0), coalesce(c.insurance_salary, 0),
       c.contract_no, 'Tạo từ hợp đồng lao động'
from public.employee_contracts c
where not exists (select 1 from public.employee_salary_records s where s.contract_id = c.id)
  and not exists (select 1 from public.employee_salary_records s2 where s2.employee_id = c.employee_id);