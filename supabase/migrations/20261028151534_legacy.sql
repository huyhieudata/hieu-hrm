update public.employee_discipline_records
set record_no = coalesce(record_no, 'BB-2026/014'),
    incident_date = coalesce(incident_date, date '2026-10-03')
where title = 'Đi muộn 3 lần trong tháng 9' and category = 'reminder';