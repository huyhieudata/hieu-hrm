update public.employee_work_history
set end_date = '2026-12-01'
where employee_id = 'd0000000-0000-4000-8000-0000000000f9'
  and event_type = 'return'
  and start_date = '2026-11-01';