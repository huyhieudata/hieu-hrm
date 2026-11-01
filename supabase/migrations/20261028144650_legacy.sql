-- Fix the demo row that was seeded with the wrong event type (it is the resignation of DEMO-006)
update public.employee_work_history
set event_type = 'resignation', end_date = null
where employee_id = 'd0000000-0000-4000-8000-000000000006'
  and title = 'Nghỉ việc theo nguyện vọng'
  and event_type = 'onboarding';