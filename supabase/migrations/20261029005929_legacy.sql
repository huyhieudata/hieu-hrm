update public.requests r
set leave_days = (r.end_date - r.start_date + 1) * case when r.session in ('morning','afternoon') then 0.5 else 1 end
where r.leave_days = 0
  and exists (
    select 1 from public.request_types t where t.id = r.request_type_id and t.category = 'leave'
  );