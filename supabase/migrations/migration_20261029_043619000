update public.employee_salary_records s
set contract_id = c.id
from public.employee_contracts c
where s.employee_id = c.employee_id
  and s.effective_date = c.start_date
  and s.contract_id is null
  and not exists (
    select 1 from public.employee_salary_records x where x.contract_id = c.id
  );