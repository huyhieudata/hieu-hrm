-- Chấm công QR: mã QR xoay vòng 30 giây theo từng điểm chấm công (HMAC phía server).
-- QR chỉ là ĐIỀU KIỆN THÊM: sau khi kiểm mã vẫn gọi attendance_punch với đủ thiết bị/GPS/ảnh,
-- và còn bắt buộc vị trí GPS nằm trong bán kính của CHÍNH điểm in trên QR.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.attendance_qr_secrets (
  location_id uuid primary key references public.attendance_locations(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  secret bytea not null default extensions.gen_random_bytes(32),
  created_at timestamptz not null default now()
);
alter table public.attendance_qr_secrets enable row level security;
-- Không có policy: chỉ truy cập qua hàm security definer.
revoke all on public.attendance_qr_secrets from anon, authenticated;

create or replace function public.attendance_qr_sign(p_secret bytea, p_location uuid, p_window bigint)
returns text language sql immutable set search_path = public as $$
  select substr(encode(extensions.hmac(convert_to(p_location::text || ':' || p_window::text, 'UTF8'), p_secret, 'sha256'), 'hex'), 1, 24);
$$;
revoke all on function public.attendance_qr_sign(bytea, uuid, bigint) from public, anon, authenticated;

-- Admin lấy mã hiện tại (đổi mỗi 30s; chấp nhận tối đa ~90s để kịp chụp ảnh).
create or replace function public.attendance_qr_issue(p_location_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_loc public.attendance_locations;
  v_secret bytea;
  v_window bigint := floor(extract(epoch from now()) / 30);
begin
  select * into v_loc from public.attendance_locations where id = p_location_id and active;
  if v_loc.id is null then raise exception 'Điểm chấm công không tồn tại hoặc đã tắt.'; end if;
  if not public.attendance_can_admin(v_loc.company_id) then raise exception 'Bạn không có quyền tạo mã QR chấm công.'; end if;
  insert into public.attendance_qr_secrets(location_id, company_id) values (v_loc.id, v_loc.company_id)
    on conflict (location_id) do nothing;
  select secret into v_secret from public.attendance_qr_secrets where location_id = v_loc.id;
  return jsonb_build_object(
    'token', 'HRMQR1.' || v_loc.id::text || '.' || v_window::text || '.' || public.attendance_qr_sign(v_secret, v_loc.id, v_window),
    'expires_at', to_timestamp((v_window + 1) * 30),
    'location_name', v_loc.name);
end $$;

-- Đổi bí mật (vô hiệu mọi mã cũ, ví dụ khi ảnh QR bị lộ).
create or replace function public.attendance_qr_rotate(p_location_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_company uuid;
begin
  select company_id into v_company from public.attendance_locations where id = p_location_id;
  if v_company is null or not public.attendance_can_admin(v_company) then raise exception 'Bạn không có quyền.'; end if;
  insert into public.attendance_qr_secrets(location_id, company_id) values (p_location_id, v_company)
    on conflict (location_id) do update set secret = extensions.gen_random_bytes(32), created_at = now();
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
  v_now_window bigint := floor(extract(epoch from now()) / 30);
  v_emp uuid;
  v_reason text;
  v_dist double precision;
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
    elsif v_window not in (v_now_window, v_now_window - 1, v_now_window - 2) then
      v_reason := 'Mã QR đã hết hạn, hãy quét lại.';
    elsif public.attendance_qr_sign(v_secret, v_loc.id, v_window) <> v_parts[4] then
      v_reason := 'Mã QR không hợp lệ.';
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
  return public.attendance_punch(p_company_id, p_action, p_session, p_device_hash, p_latitude, p_longitude, p_accuracy, p_photo_path);
end $$;

revoke all on function public.attendance_qr_issue(uuid) from public, anon;
revoke all on function public.attendance_qr_rotate(uuid) from public, anon;
revoke all on function public.attendance_punch_qr(uuid, text, text, text, double precision, double precision, double precision, text, text) from public, anon;
grant execute on function public.attendance_qr_issue(uuid) to authenticated;
grant execute on function public.attendance_qr_rotate(uuid) to authenticated;
grant execute on function public.attendance_punch_qr(uuid, text, text, text, double precision, double precision, double precision, text, text) to authenticated;
