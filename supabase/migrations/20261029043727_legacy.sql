create or replace function public.sync_contract_salary_record()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_salary uuid;
begin
  select id into v_salary
  from public.employee_salary_records
  where contract_id = new.id
  limit 1;

  if v_salary is null then
    select id into v_salary
    from public.employee_salary_records
    where employee_id = new.employee_id
      and contract_id is null
      and effective_date = coalesce(new.start_date, current_date)
    limit 1;
  end if;

  if v_salary is not null then
    update public.employee_salary_records
    set base_salary = coalesce(new.base_salary, 0),
        other_allowance = coalesce(new.allowance, 0),
        insurance_salary = coalesce(new.insurance_salary, 0),
        effective_date = coalesce(new.start_date, effective_date),
        decision_no = new.contract_no,
        note = coalesce(nullif(new.contract_no, ''), 'Hợp đồng lao động'),
        contract_id = new.id
    where id = v_salary;
  else
    insert into public.employee_salary_records
      (company_id, employee_id, contract_id, effective_date, base_salary, other_allowance, insurance_salary, decision_no, note)
    values
      (new.company_id, new.employee_id, new.id, coalesce(new.start_date, current_date),
       coalesce(new.base_salary, 0), coalesce(new.allowance, 0), coalesce(new.insurance_salary, 0),
       new.contract_no, 'Tạo từ hợp đồng lao động');
  end if;

  return new;
end $$;

create trigger employee_contracts_sync_salary
after insert or update of base_salary, allowance, insurance_salary, start_date, contract_no
on public.employee_contracts
for each row execute function public.sync_contract_salary_record();

with candidates as (
  select c.id as contract_id,
         (select s.id
          from public.employee_salary_records s
          where s.employee_id = c.employee_id and s.contract_id is null
          order by abs(s.effective_date - coalesce(c.start_date, current_date))
          limit 1) as salary_id
  from public.employee_contracts c
  where not exists (select 1 from public.employee_salary_records x where x.contract_id = c.id)
)
update public.employee_salary_records s
set contract_id = candidates.contract_id
from candidates
where s.id = candidates.salary_id
  and not exists (select 1 from public.employee_salary_records y where y.contract_id = candidates.contract_id);