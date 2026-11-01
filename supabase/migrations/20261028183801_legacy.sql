alter table public.employee_contracts
  add column if not exists insurance_salary numeric(14,2);

alter table public.employees
  add column if not exists insurance_number text;

-- Backfill contract insurance salary from the latest salary record
update public.employee_contracts c
set insurance_salary = (
  select s.insurance_salary from public.employee_salary_records s
  where s.employee_id = c.employee_id
  order by s.effective_date desc
  limit 1
)
where c.insurance_salary is null;

create or replace function public.sync_insurance_period()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  prev_number text;
  contract_salary numeric;
begin
  select insurance_number into prev_number
  from public.employee_insurance_records
  where employee_id = new.employee_id
    and insurance_type = new.insurance_type
    and insurance_number is not null
    and btrim(insurance_number) <> ''
  order by start_date desc nulls last, created_at desc
  limit 1;

  if prev_number is not null then
    new.insurance_number := prev_number;
  elsif new.insurance_number is null or btrim(new.insurance_number) = '' then
    raise exception 'Số sổ BHXH là bắt buộc khi tạo giai đoạn mới.';
  end if;

  if new.salary_base is null then
    select insurance_salary into contract_salary
    from public.employee_contracts
    where employee_id = new.employee_id and insurance_salary is not null
    order by start_date desc nulls last, created_at desc
    limit 1;
    if contract_salary is not null then
      new.salary_base := contract_salary;
    end if;
  end if;

  return new;
end;
$$;

create trigger sync_insurance_period_t
  before insert on public.employee_insurance_records
  for each row execute function public.sync_insurance_period();

create or replace function public.sync_employee_insurance_number()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.insurance_type = 'social' and new.insurance_number is not null and btrim(new.insurance_number) <> '' then
    update public.employees
    set insurance_number = new.insurance_number
    where id = new.employee_id and insurance_number is distinct from new.insurance_number;
  end if;
  return new;
end;
$$;

create trigger sync_employee_insurance_number_t
  after insert or update of insurance_number on public.employee_insurance_records
  for each row execute function public.sync_employee_insurance_number();

-- Backfill employees.insurance_number from their social insurance records
update public.employees e
set insurance_number = (
  select i.insurance_number from public.employee_insurance_records i
  where i.employee_id = e.id and i.insurance_type = 'social' and i.insurance_number is not null
  order by i.start_date desc
  limit 1
)
where e.insurance_number is null;