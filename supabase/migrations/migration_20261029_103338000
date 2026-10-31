create or replace function public.guard_employee_contact_unique()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_phone text;
begin
  if new.work_email is not null and btrim(new.work_email) <> '' then
    if exists (
      select 1 from public.employees e
      where e.company_id = new.company_id
        and e.id <> new.id
        and lower(e.work_email) = lower(new.work_email)
    ) then
      raise exception 'Email đã tồn tại trong workspace.';
    end if;
  end if;

  v_phone := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
  if v_phone <> '' then
    if exists (
      select 1 from public.employees e
      where e.company_id = new.company_id
        and e.id <> new.id
        and regexp_replace(coalesce(e.phone, ''), '\D', '', 'g') = v_phone
    ) then
      raise exception 'Số điện thoại đã tồn tại trong workspace.';
    end if;
  end if;

  return new;
end $$;

create trigger employees_contact_unique
before insert or update of work_email, phone on public.employees
for each row execute function public.guard_employee_contact_unique();