-- SEC-12: chống gian lận chấm công (giữ nguyên các chặn cứng sẵn có).
-- * QR đổi mỗi 15s (trước 30s), chỉ nhận mã trong ~60s (trước ~90s) để kịp chụp ảnh, và mỗi mã chỉ dùng 1 lần / người / thao tác.
-- * Từ chối độ chính xác GPS <= 0 (dấu hiệu giả lập) và > 100 m (trần cứng, kể cả khi chính sách đặt cao hơn).
-- * Gắn cờ 'shared_device' khi cùng mã thiết bị đã đăng ký cho nhân viên khác (cảnh báo HR, không chặn).
create table if not exists public.attendance_qr_uses (
  token_sig text not null,
  location_id uuid not null references public.attendance_locations(id) on delete cascade,
  qr_window bigint not null,
  user_id uuid not null,
  action text not null,
  session text not null,
  used_at timestamptz not null default now(),
  primary key (token_sig, user_id, action, session)
);
alter table public.attendance_qr_uses enable row level security;
revoke all on public.attendance_qr_uses from anon, authenticated;
comment on table public.attendance_qr_uses is 'SEC-12: mã QR đã dùng (deny-all cố ý, chỉ hàm security definer ghi).';
create index if not exists attendance_qr_uses_used_at_idx on public.attendance_qr_uses(used_at);

create or replace function public.attendance_qr_issue(p_location_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_loc public.attendance_locations;
  v_secret bytea;
  v_window bigint := floor(extract(epoch from now()) / 15);
begin
  select * into v_loc from public.attendance_locations where id = p_location_id and active;
  if v_loc.id is null then raise exception 'Điểm chấm công không tồn tại hoặc đã tắt.'; end if;
  if not public.attendance_can_admin(v_loc.company_id) then raise exception 'Bạn không có quyền tạo mã QR chấm công.'; end if;
  insert into public.attendance_qr_secrets(location_id, company_id) values (v_loc.id, v_loc.company_id)
    on conflict (location_id) do nothing;
  select secret into v_secret from public.attendance_qr_secrets where location_id = v_loc.id;
  return jsonb_build_object(
    'token', 'HRMQR1.' || v_loc.id::text || '.' || v_window::text || '.' || public.attendance_qr_sign(v_secret, v_loc.id, v_window),
    'expires_at', to_timestamp((v_window + 1) * 15),
    'location_name', v_loc.name);
end $$;


create or replace function public.attendance_punch_qr(
  p_company_id uuid, p_action text, p_session text, p_device_hash text,
  p_latitude double precision, p_longitude double precision, p_accuracy double precision,
  p_photo_path text, p_qr_token text
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_parts text[];
  v_loc public.attendance_locations;
  v_secret bytea;
  v_window bigint;
  v_now_window bigint := floor(extract(epoch from now()) / 15);
  v_emp uuid;
  v_reason text;
  v_dist double precision;
  v_res jsonb;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập.'; end if;
  v_parts := string_to_array(coalesce(p_qr_token, ''), '.');
  if array_length(v_parts, 1) <> 4 or v_parts[1] <> 'HRMQR1'
     or v_parts[2] !~ '^[0-9a-f-]{36}$' or v_parts[3] !~ '^[0-9]{1,12}$' then
    v_reason := 'Mã QR không hợp lệ.';
  else
    v_window := v_parts[3]::bigint;
    select * into v_loc from public.attendance_locations where id = v_parts[2]::uuid and company_id = p_company_id and active;
    select secret into v_secret from public.attendance_qr_secrets where location_id = v_loc.id;
    if v_loc.id is null or v_secret is null then
      v_reason := 'Mã QR không thuộc công ty này.';
    elsif v_window < v_now_window - 3 or v_window > v_now_window then
      v_reason := 'Mã QR đã hết hạn, hãy quét lại.';
    elsif public.attendance_qr_sign(v_secret, v_loc.id, v_window) <> v_parts[4] then
      v_reason := 'Mã QR không hợp lệ.';
    elsif exists (select 1 from public.attendance_qr_uses u where u.token_sig = v_parts[4] and u.user_id = auth.uid() and u.action = p_action and u.session = p_session) then
      v_reason := 'Mã QR này bạn đã dùng rồi, hãy quét mã mới.';
    elsif p_latitude is null or p_longitude is null then
      v_reason := 'Không có vị trí GPS.';
    else
      v_dist := public.haversine_m(p_latitude, p_longitude, v_loc.latitude, v_loc.longitude);
      if v_dist > v_loc.radius_m then
        v_reason := format('Ngoài bán kính điểm "%s" (cách %s m, cho phép %s m).', v_loc.name, round(v_dist::numeric), v_loc.radius_m);
      end if;
    end if;
  end if;

  if v_reason is not null then
    select id into v_emp from public.employees where user_id = auth.uid() and company_id = p_company_id and status <> 'resigned' order by created_at limit 1;
    if v_emp is not null then
      insert into public.attendance_punch_logs(company_id, employee_id, action, session, reason, device_hash, latitude, longitude, accuracy_m)
      values (p_company_id, v_emp, p_action, p_session, 'QR: ' || v_reason, p_device_hash, p_latitude, p_longitude, p_accuracy);
    end if;
    return jsonb_build_object('ok', false, 'reason', v_reason);
  end if;

  -- Toàn bộ kiểm tra thiết bị / GPS / độ chính xác / ảnh / khung giờ như chấm công thường.
  v_res := public.attendance_punch(p_company_id, p_action, p_session, p_device_hash, p_latitude, p_longitude, p_accuracy, p_photo_path);
  -- Chỉ "đốt" mã khi chấm thành công, để lỗi ảnh/GPS không bắt quét lại.
  if coalesce((v_res->>'ok')::boolean, false) then
    insert into public.attendance_qr_uses(token_sig, location_id, qr_window, user_id, action, session)
    values (v_parts[4], v_loc.id, v_window, auth.uid(), p_action, p_session) on conflict do nothing;
  end if;
  return v_res;
end $$;


CREATE OR REPLACE FUNCTION public.attendance_punch(p_company_id uuid, p_action text, p_session text, p_device_hash text, p_latitude double precision, p_longitude double precision, p_accuracy double precision, p_photo_path text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_hdr jsonb;
  v_ip text;
  v_ua text;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập.'; end if;
  if p_action not in ('in','out') then raise exception 'Thao tác không hợp lệ.'; end if;
  if p_session not in ('morning','afternoon') then raise exception 'Buổi chấm công không hợp lệ.'; end if;
  -- IP / trình duyệt lấy từ header của PostgREST (không tin tham số client).
  begin v_hdr := nullif(current_setting('request.headers', true), '')::jsonb; exception when others then v_hdr := null; end;
  v_ip := nullif(btrim(split_part(coalesce(v_hdr->>'x-forwarded-for', v_hdr->>'x-real-ip', v_hdr->>'cf-connecting-ip', ''), ',', 1)), '');
  v_ua := left(nullif(btrim(coalesce(v_hdr->>'user-agent', '')), ''), 500);

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
  -- Cảnh báo HR: cùng mã thiết bị nhưng trình duyệt khác lúc đăng ký (có thể bị sao chép mã).
  if v_dev.id is not null and v_ua is not null and nullif(v_dev.user_agent, '') is not null and v_dev.user_agent <> v_ua then
    v_flags := array_append(v_flags, 'ua_changed');
  end if;

  -- SEC-12: cảnh báo (không chặn) khi cùng mã thiết bị đang đăng ký cho nhân viên khác trong công ty.
  if p_device_hash is not null and exists (
       select 1 from public.employee_devices d2 join public.employees e2 on e2.id = d2.employee_id
       where d2.device_hash = p_device_hash and d2.employee_id <> v_emp.id and e2.company_id = v_emp.company_id
         and d2.status in ('approved','pending')) then
    v_flags := array_append(v_flags, 'shared_device');
  end if;

  -- 2. GPS
  -- Chặn cứng: luôn yêu cầu GPS đủ chính xác.
  if v_reason is null then
    if p_latitude is null or p_longitude is null then
      v_reason := 'Không lấy được vị trí GPS. Hãy bật định vị và cho phép trình duyệt truy cập vị trí.';
    elsif p_accuracy is not null and p_accuracy <= 0 then
      v_reason := 'Độ chính xác GPS không hợp lệ (±0 m). Có thể đang dùng ứng dụng giả lập vị trí; tắt ứng dụng đó và thử lại.';
      v_flags := array_append(v_flags, 'gps_accuracy_invalid');
    elsif p_accuracy is null or p_accuracy > least(v_pol.max_accuracy_m, 100) then
      v_reason := format('GPS chưa đủ chính xác (±%s m, cần ≤ %s m). Bật định vị chính xác và ra chỗ thoáng rồi thử lại.', round(coalesce(p_accuracy, 99999)::numeric), least(v_pol.max_accuracy_m, 100));
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
    elsif exists (select 1 from public.attendance_records r where r.photo_path = p_photo_path or r.photo_out_path = p_photo_path) then
      v_reason := coalesce(v_reason, 'Ảnh này đã được dùng cho một lần chấm công khác, hãy chụp ảnh mới.');
    end if;
  end if;

  if v_reason is not null then
    insert into public.attendance_punch_logs(company_id, employee_id, action, session, reason, device_id, device_hash, latitude, longitude, accuracy_m, ip_address, user_agent, flags)
    values (v_emp.company_id, v_emp.id, p_action, p_session, v_reason, v_dev.id, p_device_hash, p_latitude, p_longitude, p_accuracy, v_ip, v_ua, v_flags);
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
      latitude, longitude, accuracy_m, distance_m, location_id, device_id, photo_path, flags, ip_in, user_agent_in)
    values (v_emp.company_id, v_emp.id, v_today, p_session, v_now, 'phone', v_shift.id, v_status,
      p_latitude, p_longitude, p_accuracy, v_dist, v_loc, v_dev.id, p_photo_path, v_flags, v_ip, v_ua)
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
      device_out_id = v_dev.id, photo_out_path = p_photo_path, ip_out = v_ip, user_agent_out = v_ua,
      flags = (select coalesce(array_agg(distinct f), '{}') from unnest(v_rec.flags || (select array_agg(x || '_out') from unnest(v_flags) x)) f)
    where id = v_rec.id returning * into v_rec;
  end if;
  perform set_config('app.attendance_punch', 'off', true);
  return jsonb_build_object('ok', true, 'record', to_jsonb(v_rec));
end $function$;

