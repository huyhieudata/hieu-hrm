insert into public.work_shifts (company_id, name, code, start_time, end_time, break_minutes, late_grace_minutes, work_days, color)
select c.id, v.name, v.code, v.s::time, v.e::time, v.b, v.g, v.days::text[], v.color
from public.companies c
cross join (values
  ('Ca hành chính','HC','08:00','17:30',60,5,'{mon,tue,wed,thu,fri}','sky'),
  ('Ca sáng','SANG','06:00','14:00',30,5,'{mon,tue,wed,thu,fri,sat}','amber'),
  ('Ca chiều','CHIEU','14:00','22:00',30,5,'{mon,tue,wed,thu,fri,sat}','violet')
) as v(name, code, s, e, b, g, days, color)
where exists (select 1 from public.employees e where e.company_id = c.id)
  and not exists (select 1 from public.work_shifts w where w.company_id = c.id and w.code = v.code);

insert into public.attendance_settings (company_id, name, methods, scope_type, wifi_ssid, gps_latitude, gps_longitude, gps_radius_meters, active)
select c.id, 'Chấm công văn phòng', array['gps','wifi','phone'], 'company', 'NovaOffice', 21.027764, 105.834160, 200, true
from public.companies c
where exists (select 1 from public.employees e where e.company_id = c.id)
  and not exists (select 1 from public.attendance_settings s where s.company_id = c.id);

insert into public.shift_assignments (company_id, shift_id, scope_type, effective_from)
select c.id, w.id, 'company', date '2026-01-01'
from public.companies c
join public.work_shifts w on w.company_id = c.id and w.code = 'HC'
where not exists (select 1 from public.shift_assignments a where a.company_id = c.id);

insert into public.attendance_records (company_id, employee_id, work_date, check_in, check_out, method, shift_id, status)
select e.company_id, e.id, d::date,
  (d::date + time '08:00' + case when extract(day from d)::int % 7 = 0 then interval '18 minutes' else interval '2 minutes' end),
  (d::date + time '17:35'),
  'phone', s.id,
  case when extract(day from d)::int % 7 = 0 then 'late' else 'on_time' end
from public.employees e
join lateral (select id from public.work_shifts w where w.company_id = e.company_id and w.code = 'HC' limit 1) s on true
cross join generate_series(date '2026-10-01', date '2026-10-28', interval '1 day') d
where e.status in ('active','maternity','long_leave','pending')
  and extract(isodow from d) < 6
on conflict (employee_id, work_date) do nothing;