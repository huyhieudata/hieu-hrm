alter table public.employee_discipline_records
  add column if not exists record_no text,
  add column if not exists incident_date date;