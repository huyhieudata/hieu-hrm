insert into public.requests
  (company_id, employee_id, request_type_id, start_date, end_date, session, start_time, end_time, reason, status, decided_at, decision_note)
select e.company_id, e.id, t.id, v.start_date::date, v.end_date::date, v.session, v.st::time, v.et::time, v.reason, v.status,
  case when v.status in ('approved','rejected') then now() else null end,
  v.note
from (
  select e.*, row_number() over (partition by e.company_id order by e.code) as rn
  from public.employees e
  where e.status in ('active','maternity','long_leave')
) e
join public.request_types t on t.company_id = e.company_id
join (values
  (1, 'leave', '2026-10-29', '2026-10-30', 'full_day', null, null, 'Việc gia đình', 'pending', null),
  (2, 'remote', '2026-10-28', '2026-10-28', 'full_day', null, null, 'Làm việc tại nhà', 'approved', 'Đã xác nhận'),
  (3, 'late', '2026-10-27', '2026-10-27', 'morning', '08:40', null, 'Tắc đường', 'approved', 'Chấp thuận'),
  (4, 'outside', '2026-10-26', '2026-10-26', 'afternoon', '14:00', '16:00', 'Gặp đối tác', 'rejected', 'Cần bổ sung lịch hẹn')
) as v(rn, category, start_date, end_date, session, st, et, reason, status, note) on v.rn = e.rn
where t.category = v.category
  and not exists (select 1 from public.requests r where r.company_id = e.company_id);