alter table public.employee_salary_records
  add column if not exists contract_id uuid references public.employee_contracts(id) on delete set null;

create unique index if not exists employee_salary_records_contract_key
  on public.employee_salary_records (contract_id)
  where contract_id is not null;

create index if not exists employee_salary_records_contract_idx
  on public.employee_salary_records (contract_id);