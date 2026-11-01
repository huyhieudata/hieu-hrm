insert into public.request_approval_steps
  (company_id, request_type_id, step_order, name, approver_type, sla_hours)
select t.company_id, t.id, 1, 'Quản lý trực tiếp duyệt', 'direct_manager', 24
from public.request_types t
where t.name = 'Nghỉ phép năm'
  and not exists (
    select 1 from public.request_approval_steps s
    where s.request_type_id = t.id and s.step_order = 1
  );

insert into public.request_approval_steps
  (company_id, request_type_id, step_order, name, approver_type, sla_hours)
select t.company_id, t.id, 2, 'Cấp trên của quản lý duyệt', 'manager_of_manager', 48
from public.request_types t
where t.name = 'Nghỉ phép năm'
  and not exists (
    select 1 from public.request_approval_steps s
    where s.request_type_id = t.id and s.step_order = 2
  );

insert into public.requests
  (company_id, employee_id, request_type_id, start_date, end_date, session, leave_days, reason, status)
select e.company_id, e.id, t.id, current_date + 3, current_date + 3, 'full_day', 1, 'Việc gia đình', 'pending'
from (
  select e.*, row_number() over (partition by e.company_id order by e.code) as rn
  from public.employees e
  where e.status in ('active','maternity','long_leave')
) e
join public.request_types t on t.company_id = e.company_id and t.name = 'Nghỉ phép năm'
where e.rn = 3
  and not exists (
    select 1 from public.requests r
    where r.company_id = e.company_id and r.employee_id = e.id
      and r.status = 'pending' and r.request_type_id = t.id
  );