-- Chuyển hồ sơ nhân viên sang khóa ngoại tới bảng phòng ban.
-- employees.department_id -> departments.id (on delete set null).
-- Cột text employees.department giữ lại làm tên hiển thị, được trigger đồng bộ:
--   * đặt department_id -> department = tên phòng ban;
--   * chỉ đổi department (text, giao diện cũ / import) -> tự dò department_id theo tên trong cùng công ty;
--   * đổi tên phòng ban -> cập nhật tên trên hồ sơ nhân viên.
-- Phạm vi manager (is_manager_of_employee) nay so theo department_id thay vì so tên.

alter table public.employees
  add column if not exists department_id uuid references public.departments(id) on delete set null;
create index if not exists employees_department_id_idx on public.employees(department_id);

update public.employees e
   set department_id = d.id
  from public.departments d
 where e.department_id is null
   and d.company_id = e.company_id
   and lower(btrim(d.name)) = lower(btrim(coalesce(e.department, '')));

create or replace function public.sync_employee_department()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_company uuid;
begin
  if new.department_id is not null
     and (tg_op = 'INSERT' or new.department_id is distinct from old.department_id) then
    select name, company_id into v_name, v_company from public.departments where id = new.department_id;
    if v_company is distinct from new.company_id then
      raise exception 'Phòng ban không thuộc công ty của nhân viên';
    end if;
    new.department := v_name;
  elsif tg_op = 'INSERT' or new.department is distinct from old.department then
    if nullif(btrim(coalesce(new.department, '')), '') is null then
      new.department_id := null;
    else
      select id into new.department_id from public.departments
       where company_id = new.company_id
         and lower(btrim(name)) = lower(btrim(new.department))
       order by created_at nulls last limit 1;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_employee_department() from public, anon, authenticated;

drop trigger if exists trg_sync_employee_department on public.employees;
create trigger trg_sync_employee_department
  before insert or update of department, department_id, company_id on public.employees
  for each row execute function public.sync_employee_department();

create or replace function public.sync_department_name_to_employees()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.name is distinct from old.name then
    update public.employees set department = new.name where department_id = new.id;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_department_name_to_employees() from public, anon, authenticated;

drop trigger if exists trg_sync_department_name on public.departments;
create trigger trg_sync_department_name
  after update of name on public.departments
  for each row execute function public.sync_department_name_to_employees();

create or replace function public.is_manager_of_employee(target_employee uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select m.id, m.company_id
    from public.employees m
    join public.employees t on t.id = target_employee and t.company_id = m.company_id
    where m.user_id = auth.uid()
      and public.has_company_role(m.company_id, array['manager'])
  )
  select exists (
    select 1
    from me
    join public.employees t on t.id = target_employee
    where t.manager_id = me.id
       or (t.department_id is not null and exists (
         with recursive tree as (
           select d.id from public.departments d
           where d.company_id = me.company_id and d.manager_employee_id = me.id
           union
           select c.id from public.departments c
           join tree p on c.parent_id = p.id
           where c.company_id = me.company_id
         )
         select 1 from tree where tree.id = t.department_id
       ))
  );
$$;
revoke all on function public.is_manager_of_employee(uuid) from public, anon;
grant execute on function public.is_manager_of_employee(uuid) to authenticated;
