-- Loại đơn mặc định (có dấu) cho mọi công ty + công ty mới. Không xoá dữ liệu.
create or replace function public.seed_default_request_types(_company_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sửa tên không dấu cũ.
  update public.request_types
     set name = 'Nghỉ phép'
   where company_id = _company_id
     and category = 'leave'
     and lower(btrim(name)) in ('phep', 'nghi phep', 'nghi phép');

  insert into public.request_types (company_id, name, category, deduct_leave, requires_attachment, max_days, sort_order)
  select _company_id, v.name, v.category, v.deduct, v.attach, v.max_days, v.sort_order
  from (values
    ('Nghỉ phép', 'leave', true, false, null::numeric, 1),
    ('Nghỉ ốm', 'leave', false, false, 30::numeric, 2),
    ('Nghỉ việc riêng không lương', 'leave', false, false, null::numeric, 3),
    ('Đi muộn', 'late', false, false, null::numeric, 10),
    ('Về sớm', 'early_leave', false, false, null::numeric, 11),
    ('Làm từ xa', 'remote', false, false, null::numeric, 12),
    ('Ra ngoài', 'outside', false, false, null::numeric, 13),
    ('Sửa chấm công', 'attendance_fix', false, false, null::numeric, 14)
  ) as v(name, category, deduct, attach, max_days, sort_order)
  where not exists (
    select 1 from public.request_types t
     where t.company_id = _company_id
       and lower(btrim(t.name)) = lower(v.name)
  )
  -- "Nghỉ phép năm" (seed cũ) coi như đã có Nghỉ phép.
  and not (v.name = 'Nghỉ phép' and exists (
    select 1 from public.request_types t
     where t.company_id = _company_id and t.category = 'leave' and t.deduct_leave
  ));
end;
$$;

revoke all on function public.seed_default_request_types(uuid) from public, anon, authenticated;

create or replace function public.companies_seed_request_types()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_request_types(new.id);
  return new;
end;
$$;

revoke all on function public.companies_seed_request_types() from public, anon, authenticated;

drop trigger if exists companies_seed_request_types on public.companies;
create trigger companies_seed_request_types
  after insert on public.companies
  for each row execute function public.companies_seed_request_types();

do $$
declare c record;
begin
  for c in select id from public.companies loop
    perform public.seed_default_request_types(c.id);
  end loop;
end $$;
