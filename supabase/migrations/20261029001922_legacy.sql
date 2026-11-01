alter table public.work_shifts
  add column if not exists morning_start time,
  add column if not exists morning_end time,
  add column if not exists afternoon_start time,
  add column if not exists afternoon_end time,
  add column if not exists valid_checkin_from time,
  add column if not exists valid_checkin_to time,
  add column if not exists late_after time,
  add column if not exists work_credit numeric(4,2) not null default 1,
  add column if not exists forgot_checkout_credit numeric(4,2) not null default 0.5;

update public.work_shifts
set morning_start = coalesce(morning_start, start_time),
    morning_end = coalesce(morning_end, time '12:00'),
    afternoon_start = coalesce(afternoon_start, time '13:00'),
    afternoon_end = coalesce(afternoon_end, end_time),
    valid_checkin_from = coalesce(valid_checkin_from, start_time - interval '30 minutes'),
    valid_checkin_to = coalesce(valid_checkin_to, start_time + interval '2 hours'),
    late_after = coalesce(late_after, start_time + (late_grace_minutes || ' minutes')::interval)
where morning_start is null
   or morning_end is null
   or afternoon_start is null
   or afternoon_end is null
   or valid_checkin_from is null
   or valid_checkin_to is null
   or late_after is null;

alter table public.work_shifts
  alter column morning_start set default time '08:00',
  alter column morning_end set default time '12:00',
  alter column afternoon_start set default time '13:00',
  alter column afternoon_end set default time '17:30',
  alter column valid_checkin_from set default time '07:30',
  alter column valid_checkin_to set default time '10:00',
  alter column late_after set default time '08:05';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'work_shifts_credit_check') then
    alter table public.work_shifts
      add constraint work_shifts_credit_check
      check (work_credit >= 0 and work_credit <= 2 and forgot_checkout_credit >= 0 and forgot_checkout_credit <= 2);
  end if;
end $$;