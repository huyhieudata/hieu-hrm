-- Chặn cứng chấm công: bắt buộc đúng điện thoại đã duyệt, GPS đủ chính xác và ở trong bán kính địa điểm.
-- Chưa khai báo địa điểm => chặn chấm. Máy đầu tiên vẫn tự duyệt, máy tiếp theo chờ HR duyệt.

-- Chuyển các thiết lập GPS cũ (attendance_settings) thành địa điểm chấm công nếu chưa có.
insert into public.attendance_locations(company_id, name, latitude, longitude, radius_m, active)
select s.company_id, coalesce(nullif(s.name, ''), 'Địa điểm'), s.gps_latitude, s.gps_longitude,
       greatest(coalesce(s.gps_radius_meters, 200), 20), s.active
from public.attendance_settings s
where s.gps_latitude is not null and s.gps_longitude is not null
  and not exists (select 1 from public.attendance_locations l
                  where l.company_id = s.company_id and l.latitude = s.gps_latitude and l.longitude = s.gps_longitude);

update public.attendance_policies set gps_mode = 'reject', require_gps = true, require_device = true
where gps_mode <> 'reject' or not require_gps or not require_device;
alter table public.attendance_policies alter column gps_mode set default 'reject';
alter table public.attendance_policies drop constraint if exists attendance_policies_hard_block;
alter table public.attendance_policies add constraint attendance_policies_hard_block
  check (gps_mode = 'reject' and require_gps and require_device);

create or replace function public.attendance_punch(
  p_company_id uuid,
  p_action text,
  p_session text,
  p_device_hash text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy double precision,
  p_photo_path text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_emp public.employees;
  v_pol public.attendance_policies;
  v_dev public.employee_devices;
  v_rec public.attendance_records;
  v_shift public.work_shifts;
  v_now timestamptz := now();
  v_local timestamp := now() at time zone 'Asia/Ho_Chi_Minh';
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_from time; v_to time; v_late time;
  v_end timestamp;
  v_status text;
  v_flags text[] := '{}';
  v_loc uuid; v_dist double precision; v_has_loc boolean;
  v_reason text;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập.'; end if;
  if p_action not in ('in','out') then raise exception 'Thao tác không hợp lệ.'; end if;
  if p_session not in ('morning','afternoon') then raise exception 'Buổi chấm công không hợp lệ.'; end if;

  select * into v_emp from public.employees where user_id = auth.uid() and company_id = p_company_id and status <> 'resigned' order by created_at limit 1;
  if v_emp.id is null then raise exception 'Tài khoản chưa gắn hồ sơ nhân sự.'; end if;
  v_pol := public.attendance_effective_policy(v_emp.company_id);

  -- 1. Thiết bị
  if p_device_hash is not null then
    select * into v_dev from public.employee_devices where employee_id = v_emp.id and device_hash = p_device_hash;
  end if;
  -- Chặn cứng: luôn yêu cầu đúng điện thoại đã đăng ký và đã duyệt.
  if v_dev.id is null or v_dev.status <> 'approved' then
    v_reason := case when v_dev.id is null then 'Điện thoại này chưa được đăng ký chấm công. Hãy đăng ký máy và chờ HR duyệt.'
                     when v_dev.status = 'pending' then 'Điện thoại này đang chờ HR duyệt, chưa thể chấm công.'
                     when v_dev.status = 'rejected' then 'Điện thoại này đã bị HR từ chối, không thể chấm công.'
                     else 'Điện thoại này đã bị thu hồi quyền chấm công. Liên hệ HR.' end;
  end if;

  -- 2. GPS
  -- Chặn cứng: luôn yêu cầu GPS đủ chính xác.
  if v_reason is null then
    if p_latitude is null or p_longitude is null then
      v_reason := 'Không lấy được vị trí GPS. Hãy bật định vị và cho phép trình duyệt truy cập vị trí.';
    elsif p_accuracy is null or p_accuracy > v_pol.max_accuracy_m then
      v_reason := format('GPS chưa đủ chính xác (±%s m, cần ≤ %s m). Bật định vị chính xác và ra chỗ thoáng rồi thử lại.', round(coalesce(p_accuracy, 99999)::numeric), v_pol.max_accuracy_m);
    end if;
  end if;
  if p_latitude is not null and p_longitude is not null then
    if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
      raise exception 'Toạ độ không hợp lệ.';
    end if;
    select exists(select 1 from public.attendance_locations where company_id = v_emp.company_id and active) into v_has_loc;
    if not v_has_loc then
      if v_reason is null then
        v_reason := 'Công ty chưa khai báo địa điểm chấm công. Liên hệ HR để thiết lập trước khi chấm.';
      end if;
    else
      select l.id, public.haversine_m(p_latitude, p_longitude, l.latitude, l.longitude) into v_loc, v_dist
      from public.attendance_locations l where l.company_id = v_emp.company_id and l.active
      order by public.haversine_m(p_latitude, p_longitude, l.latitude, l.longitude) - l.radius_m limit 1;
      if not exists (select 1 from public.attendance_locations l where l.id = v_loc and v_dist <= l.radius_m) then
        if v_reason is null then
          v_reason := format('Bạn đang ở ngoài vùng chấm công (cách %s m, cho phép %s m).', round(v_dist::numeric),
            (select radius_m from public.attendance_locations where id = v_loc));
        end if;
        v_flags := array_append(v_flags, 'out_of_zone');
      end if;
    end if;
  end if;

  -- 3. Ảnh
  if v_reason is null and v_pol.require_photo and p_photo_path is null then
    v_reason := 'Thiếu ảnh chụp chấm công.';
  end if;
  if p_photo_path is not null then
    if p_photo_path not like v_emp.company_id::text || '/' || v_emp.id::text || '/%'
       or not exists (select 1 from storage.objects o where o.bucket_id = 'attendance-photos' and o.name = p_photo_path
                      and o.created_at > v_now - interval '15 minutes') then
      v_reason := coalesce(v_reason, 'Ảnh chấm công không hợp lệ hoặc đã quá hạn, hãy chụp lại.');
    end if;
  end if;

  if v_reason is not null then
    insert into public.attendance_punch_logs(company_id, employee_id, action, session, reason, device_id, device_hash, latitude, longitude, accuracy_m)
    values (v_emp.company_id, v_emp.id, p_action, p_session, v_reason, v_dev.id, p_device_hash, p_latitude, p_longitude, p_accuracy);
    return jsonb_build_object('ok', false, 'reason', v_reason);
  end if;

  if v_dev.id is not null then update public.employee_devices set last_used_at = v_now where id = v_dev.id; end if;

  perform set_config('app.attendance_punch', 'on', true);
  select * into v_rec from public.attendance_records where employee_id = v_emp.id and work_date = v_today and session = p_session;

  if p_action = 'in' then
    if v_rec.id is not null and v_rec.check_in is not null then raise exception 'Buổi này bạn đã chấm công vào rồi.'; end if;
    select * into v_shift from public.work_shifts where id = public.attendance_resolve_shift(v_emp.id, v_today);
    v_status := 'on_time';
    if v_shift.id is not null then
      if p_session = 'morning' then
        v_from := v_shift.valid_checkin_from; v_to := v_shift.valid_checkin_to; v_late := v_shift.late_after;
      else
        v_from := v_shift.valid_checkin_from_pm; v_to := v_shift.valid_checkin_to_pm; v_late := v_shift.late_after_pm;
      end if;
      if v_from is null or v_to is null then raise exception 'Ca làm việc không có khung chấm công cho buổi này.'; end if;
      if v_local::time < v_from or v_local::time > v_to then
        raise exception 'Ngoài khung giờ chấm công hợp lệ (%–%).', to_char(v_from, 'HH24:MI'), to_char(v_to, 'HH24:MI');
      end if;
      if v_late is not null and v_local::time > v_late then v_status := 'late'; end if;
    end if;
    insert into public.attendance_records(company_id, employee_id, work_date, session, check_in, method, shift_id, status,
      latitude, longitude, accuracy_m, distance_m, location_id, device_id, photo_path, flags)
    values (v_emp.company_id, v_emp.id, v_today, p_session, v_now, 'phone', v_shift.id, v_status,
      p_latitude, p_longitude, p_accuracy, v_dist, v_loc, v_dev.id, p_photo_path, v_flags)
    returning * into v_rec;
  else
    if v_rec.id is null or v_rec.check_in is null then raise exception 'Bạn chưa chấm công vào buổi này.'; end if;
    if v_rec.check_out is not null then raise exception 'Bạn đã chấm công ra rồi.'; end if;
    v_status := v_rec.status;
    select * into v_shift from public.work_shifts where id = v_rec.shift_id;
    if v_shift.id is not null then
      v_end := v_today + v_shift.end_time;
      if v_shift.end_time <= v_shift.start_time then v_end := v_end + interval '1 day'; end if;
      if v_local < v_end and v_status <> 'late' then v_status := 'early_leave'; end if;
    end if;
    update public.attendance_records set check_out = v_now, status = v_status,
      latitude_out = p_latitude, longitude_out = p_longitude, accuracy_out_m = p_accuracy, distance_out_m = v_dist,
      device_out_id = v_dev.id, photo_out_path = p_photo_path,
      flags = (select coalesce(array_agg(distinct f), '{}') from unnest(v_rec.flags || (select array_agg(x || '_out') from unnest(v_flags) x)) f)
    where id = v_rec.id returning * into v_rec;
  end if;
  perform set_config('app.attendance_punch', 'off', true);
  return jsonb_build_object('ok', true, 'record', to_jsonb(v_rec));
end $$;
create or replace function public.attendance_effective_policy(p_company uuid)
returns public.attendance_policies language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p from public.attendance_policies p where p.company_id = p_company),
    row(p_company, true, true, 'reject', 150, true, 1, true, now(), null)::public.attendance_policies
  );
$$;
