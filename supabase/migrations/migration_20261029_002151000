update public.work_shifts
set valid_checkin_from = start_time - interval '30 minutes',
    valid_checkin_to = start_time + interval '60 minutes',
    late_after = start_time + (late_grace_minutes || ' minutes')::interval
where code in ('HC', 'SANG', 'CHIEU');