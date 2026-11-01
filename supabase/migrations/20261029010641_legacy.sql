insert into public.requests
  (company_id, employee_id, request_type_id, start_date, end_date, session, leave_days, reason, status, decided_at, decision_note)
select e.company_id, e.id, t.id, date '2026-10-15', date '2026-10-15', 'full_day', 1, 'Nghỉ phép năm', 'approved', now(), 'Đã duyệt'
from (
  select e.*, row_number() over (partition by e.company_id order by e.code) as rn
  from public.employees e
  where e.status in ('active','maternity','long_leave')
) e
join public.request_types t on t.company_id = e.company_id and t.name = 'Nghỉ phép năm'
where e.rn = 2
  and not exists (
    select 1 from public.requests r
    where r.company_id = e.company_id and r.status = 'approved' and r.request_type_id = t.id
  );