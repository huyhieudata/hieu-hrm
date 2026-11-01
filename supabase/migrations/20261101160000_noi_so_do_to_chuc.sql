-- Nối phòng ban trên các bảng nghiệp vụ với sơ đồ tổ chức thật (departments).
-- An toàn: chỉ THÊM cột department_id (nullable, on delete set null), giữ nguyên cột text
-- "department" để tương thích; backfill theo tên (không phân biệt hoa thường), không xoá/ghi đè text.
-- Trigger dùng chung: đổi text -> dò department_id theo tên; đặt department_id -> text = tên chuẩn.

create or replace function public.sync_row_department()
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
      new.department_id := null; -- phòng ban khác công ty: bỏ liên kết, giữ text
    else
      new.department := v_name;
    end if;
  elsif tg_op = 'INSERT' or new.department is distinct from old.department then
    if nullif(btrim(coalesce(new.department, '')), '') is null then
      new.department_id := null;
    else
      select id into new.department_id from public.departments
       where company_id = new.company_id and lower(btrim(name)) = lower(btrim(new.department))
       order by created_at nulls last limit 1;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_row_department() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array[
    'employee_contracts', 'employee_work_history', 'candidate_offers', 'company_invites',
    'company_members', 'job_descriptions', 'recruitment_campaigns', 'onboarding_records'
  ] loop
    execute format(
      'alter table public.%I add column if not exists department_id uuid references public.departments(id) on delete set null', t);
    execute format('create index if not exists %I on public.%I(department_id)', t || '_department_id_idx', t);
    execute format(
      'update public.%I x set department_id = d.id from public.departments d
        where x.department_id is null and d.company_id = x.company_id
          and lower(btrim(d.name)) = lower(btrim(coalesce(x.department, %L)))', t, '');
    execute format('drop trigger if exists trg_sync_row_department on public.%I', t);
    execute format(
      'create trigger trg_sync_row_department before insert or update of department, department_id, company_id
         on public.%I for each row execute function public.sync_row_department()', t);
  end loop;
end $$;

-- Hồ sơ nhân viên: backfill lại các dòng còn thiếu (dữ liệu nhập sau migration trước).
update public.employees e
   set department_id = d.id
  from public.departments d
 where e.department_id is null
   and d.company_id = e.company_id
   and lower(btrim(d.name)) = lower(btrim(coalesce(e.department, '')));

-- Đổi tên phòng ban -> cập nhật tên hiển thị trên các bảng đã liên kết.
create or replace function public.sync_department_name_everywhere()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
begin
  if new.name is distinct from old.name then
    foreach t in array array[
      'employee_contracts', 'employee_work_history', 'candidate_offers', 'company_invites',
      'company_members', 'job_descriptions', 'recruitment_campaigns', 'onboarding_records'
    ] loop
      execute format('update public.%I set department = $1 where department_id = $2', t) using new.name, new.id;
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_department_name_everywhere() from public, anon, authenticated;
drop trigger if exists trg_sync_department_name_everywhere on public.departments;
create trigger trg_sync_department_name_everywhere
  after update of name on public.departments
  for each row execute function public.sync_department_name_everywhere();
