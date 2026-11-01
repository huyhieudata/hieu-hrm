create or replace function public.validate_employee_contacts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.work_email is not null and btrim(new.work_email) <> '' then
    if exists (
      select 1 from public.employees e
      where e.company_id = new.company_id
        and e.id <> new.id
        and lower(e.work_email) = lower(btrim(new.work_email))
    ) then
      raise exception 'Email đã tồn tại trong hồ sơ nhân sự của công ty.';
    end if;
  end if;

  if new.phone is not null and btrim(new.phone) <> '' then
    if exists (
      select 1 from public.employees e
      where e.company_id = new.company_id
        and e.id <> new.id
        and regexp_replace(e.phone, '[^0-9]', '', 'g') = regexp_replace(btrim(new.phone), '[^0-9]', '', 'g')
    ) then
      raise exception 'Số điện thoại đã tồn tại trong hồ sơ nhân sự của công ty.';
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_employee_contacts_t
  before insert or update of work_email, phone on public.employees
  for each row execute function public.validate_employee_contacts();