alter table public.request_types
  add column if not exists deduct_leave boolean not null default false;

alter table public.requests
  add column if not exists leave_days numeric(4,1) not null default 0;

update public.request_types
set name = 'Nghỉ phép năm', deduct_leave = true
where category = 'leave' and name = 'Nghỉ phép';

insert into public.request_types (company_id, name, category, deduct_leave, requires_attachment, max_days, sort_order)
select c.id, v.name, 'leave', v.deduct, false, v.max_days, v.sort_order
from public.companies c
cross join (values
  ('Nghỉ ốm', false, 30::numeric, 10),
  ('Nghỉ việc riêng không lương', false, null::numeric, 11),
  ('Nghỉ phép năm', true, null::numeric, 12)
) as v(name, deduct, max_days, sort_order)
where exists (select 1 from public.employees e where e.company_id = c.id)
  and not exists (
    select 1 from public.request_types t where t.company_id = c.id and t.name = v.name
  );