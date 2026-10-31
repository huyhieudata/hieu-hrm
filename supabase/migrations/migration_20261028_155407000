create or replace function public.reopen_salary_after_delete()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  prev_id uuid;
  prev_effective date;
  next_effective date;
begin
  select id, effective_date
    into prev_id, prev_effective
  from public.employee_salary_records
  where employee_id = old.employee_id and effective_date < old.effective_date
  order by effective_date desc
  limit 1;

  if prev_id is null then
    return old;
  end if;

  select effective_date
    into next_effective
  from public.employee_salary_records
  where employee_id = old.employee_id and effective_date > prev_effective
  order by effective_date asc
  limit 1;

  update public.employee_salary_records set end_date = next_effective where id = prev_id;
  return old;
end;
$$;

update public.employee_salary_records
set end_date = '2027-06-01'
where employee_id = 'd0000000-0000-4000-8000-0000000000f8' and effective_date = '2027-01-01';