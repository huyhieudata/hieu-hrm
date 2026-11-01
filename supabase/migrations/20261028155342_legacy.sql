alter table public.employee_salary_records add column if not exists end_date date;

-- Backfill: each salary level ends when the next one starts
with ordered as (
  select id,
         lead(effective_date) over (partition by employee_id order by effective_date, created_at) as next_date
  from public.employee_salary_records
)
update public.employee_salary_records s
set end_date = o.next_date
from ordered o
where s.id = o.id and s.end_date is null and o.next_date is not null;

create or replace function public.align_salary_dates()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  prev_id uuid;
  prev_end date;
  prev_effective date;
begin
  if new.effective_date is null then
    return new;
  end if;

  select id, end_date, effective_date
    into prev_id, prev_end, prev_effective
  from public.employee_salary_records
  where employee_id = new.employee_id
  order by effective_date desc, created_at desc
  limit 1;

  if prev_id is null then
    return new;
  end if;

  if prev_end is not null then
    new.effective_date := prev_end;
  elsif new.effective_date > prev_effective then
    update public.employee_salary_records set end_date = new.effective_date where id = prev_id;
  end if;

  return new;
end;
$$;

create trigger align_salary_dates_trigger
  before insert on public.employee_salary_records
  for each row execute function public.align_salary_dates();

create or replace function public.reopen_salary_after_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.employee_salary_records
  set end_date = null
  where employee_id = old.employee_id and end_date = old.effective_date;
  return old;
end;
$$;

create trigger reopen_salary_after_delete_trigger
  after delete on public.employee_salary_records
  for each row execute function public.reopen_salary_after_delete();