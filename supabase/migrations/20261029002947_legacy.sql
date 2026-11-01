alter table public.work_shifts
  add column if not exists shift_type text not null default 'office',
  add column if not exists valid_checkin_from_pm time,
  add column if not exists valid_checkin_to_pm time,
  add column if not exists late_after_pm time;

alter table public.work_shifts drop constraint if exists work_shifts_type_check;
alter table public.work_shifts
  add constraint work_shifts_type_check check (shift_type in ('office','single','custom'));

update public.work_shifts
set valid_checkin_from_pm = coalesce(valid_checkin_from_pm, afternoon_start - interval '30 minutes'),
    valid_checkin_to_pm = coalesce(valid_checkin_to_pm, afternoon_start + interval '60 minutes'),
    late_after_pm = coalesce(late_after_pm, afternoon_start + (late_grace_minutes || ' minutes')::interval)
where valid_checkin_from_pm is null
  and afternoon_start is not null;

update public.work_shifts
set name = 'Ca hành chính',
    shift_type = 'office',
    morning_start = time '08:00',
    morning_end = time '12:00',
    afternoon_start = time '13:00',
    afternoon_end = time '17:30',
    start_time = time '08:00',
    end_time = time '17:30',
    valid_checkin_from = time '07:30',
    valid_checkin_to = time '08:30',
    late_after = time '08:05',
    valid_checkin_from_pm = time '13:00',
    valid_checkin_to_pm = time '14:00',
    late_after_pm = time '13:05',
    work_days = array['mon','tue','wed','thu','fri']
where code = 'HC';

update public.work_shifts
set name = 'Ca đơn',
    code = 'CD',
    shift_type = 'single',
    morning_start = time '09:00',
    morning_end = time '18:00',
    afternoon_start = null,
    afternoon_end = null,
    start_time = time '09:00',
    end_time = time '18:00',
    valid_checkin_from = time '08:30',
    valid_checkin_to = time '09:45',
    late_after = time '09:05',
    valid_checkin_from_pm = null,
    valid_checkin_to_pm = null,
    late_after_pm = null,
    work_days = array['mon','tue','wed','thu','fri','sat']
where code = 'SANG';

update public.work_shifts
set name = 'Ca tùy chọn',
    code = 'TC',
    shift_type = 'custom',
    morning_start = time '08:00',
    morning_end = time '12:00',
    afternoon_start = time '13:30',
    afternoon_end = time '18:00',
    start_time = time '08:00',
    end_time = time '18:00',
    valid_checkin_from = time '07:45',
    valid_checkin_to = time '08:30',
    late_after = time '08:05',
    valid_checkin_from_pm = time '13:15',
    valid_checkin_to_pm = time '14:00',
    late_after_pm = time '13:35',
    work_days = array['mon','tue','wed','thu','fri','sat']
where code = 'CHIEU';