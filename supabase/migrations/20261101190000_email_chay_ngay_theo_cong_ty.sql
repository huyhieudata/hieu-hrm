-- Sửa: "Chạy ngay" sự kiện email theo ngày (email_run_daily_now) trước đây gọi
-- email_enqueue_daily(true) cho MỌI công ty, nên HR công ty A có thể khiến công ty B
-- xếp thư sớm hơn giờ gửi đã cấu hình. Thêm tham số p_company để chỉ chạy cho công ty
-- của người bấm; cron vẫn chạy toàn bộ (p_company = null).

drop function if exists public.email_enqueue_daily(boolean);

create or replace function public.email_enqueue_daily(p_force boolean default false, p_company uuid default null)
returns int language plpgsql security definer set search_path = public
as $$
declare
  r public.email_rules; x record; v_n int := 0;
  v_now timestamp := now() at time zone 'Asia/Ho_Chi_Minh';
  v_today date := v_now::date; v_target date;
begin
  for r in select * from public.email_rules where active and template_id is not null
           and event_key in ('birthday','contract_expiring','probation_ending','attendance_reminder')
           and (p_company is null or company_id = p_company) loop
    if not p_force and extract(hour from v_now) < r.send_hour then continue; end if;
    v_target := v_today + r.offset_days;
    if r.event_key = 'birthday' then
      for x in select id from public.employees where company_id = r.company_id and status in ('probation','active','leave')
               and date_of_birth is not null and to_char(date_of_birth, 'MM-DD') = to_char(v_target, 'MM-DD') loop
        v_n := v_n + public.email_enqueue_event(r.company_id, 'birthday', x.id, 'bd:' || x.id || ':' || v_target,
          jsonb_build_object('ngay_sinh', to_char(v_target, 'DD/MM'),
            'tuoi', extract(year from v_target)::int - (select extract(year from date_of_birth)::int from public.employees where id = x.id)), r.id);
      end loop;
    elsif r.event_key = 'contract_expiring' then
      for x in select c.* from public.employee_contracts c where c.company_id = r.company_id and c.status = 'active'
               and c.end_date = v_target loop
        v_n := v_n + public.email_enqueue_event(r.company_id, 'contract_expiring', x.employee_id, 'ct:' || x.id || ':' || x.end_date,
          jsonb_build_object('so_hop_dong', coalesce(x.contract_no, ''), 'loai_hop_dong', coalesce(x.contract_type, ''),
            'ngay_het_han', to_char(x.end_date, 'DD/MM/YYYY'), 'so_ngay_con_lai', x.end_date - v_today), r.id);
      end loop;
    elsif r.event_key = 'probation_ending' then
      for x in select id, probation_end_date from public.employees where company_id = r.company_id
               and status in ('probation','active') and probation_end_date = v_target loop
        v_n := v_n + public.email_enqueue_event(r.company_id, 'probation_ending', x.id, 'pb:' || x.id || ':' || x.probation_end_date,
          jsonb_build_object('ngay_het_thu_viec', to_char(x.probation_end_date, 'DD/MM/YYYY')), r.id);
      end loop;
    elsif r.event_key = 'attendance_reminder' and extract(isodow from v_today) < 7 then
      for x in select e.id from public.employees e where e.company_id = r.company_id and e.status in ('probation','active')
               and e.user_id is not null and not exists (select 1 from public.attendance_records a
                 where a.employee_id = e.id and a.work_date = v_today and a.check_in is not null) loop
        v_n := v_n + public.email_enqueue_event(r.company_id, 'attendance_reminder', x.id, 'ar:' || x.id || ':' || v_today, '{}'::jsonb, r.id);
      end loop;
    end if;
  end loop;
  return v_n;
end;
$$;
revoke execute on function public.email_enqueue_daily(boolean, uuid) from public, anon, authenticated;

create or replace function public.email_run_daily_now(p_company uuid)
returns int language plpgsql security definer set search_path = public
as $$
declare v int;
begin
  if p_company is null or not public.has_company_role(p_company, array['owner','admin','hr']) then
    raise exception 'FORBIDDEN';
  end if;
  select public.email_enqueue_daily(true, p_company) into v;
  return v;
end;
$$;
revoke execute on function public.email_run_daily_now(uuid) from public, anon;
grant execute on function public.email_run_daily_now(uuid) to authenticated;
