-- Chấm công xác thực 3 lớp: ảnh selfie, GPS trong vùng, thiết bị đã đăng ký.
-- Nhân viên KHÔNG còn insert/update attendance_records trực tiếp; mọi lần chấm đi qua RPC attendance_punch
-- (SECURITY DEFINER, lấy nhân viên từ auth.uid()). HR/người có quyền attendance.* vẫn sửa tay như trước.

/* ------------------------------ Cấu hình ------------------------------ */
create table if not exists public.attendance_policies (
  company_id uuid primary key references public.companies(id) on delete cascade,
  require_photo boolean not null default true,
  require_gps boolean not null default true,
  gps_mode text not null default 'flag' check (gps_mode in ('flag','reject')),
  max_accuracy_m integer not null default 150 check (max_accuracy_m between 5 and 5000),
  require_device boolean not null default true,
  max_devices integer not null default 1 check (max_devices between 1 and 5),
  auto_approve_first_device boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.attendance_locations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  radius_m integer not null default 150 check (radius_m between 10 and 10000),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists attendance_locations_company_idx on public.attendance_locations(company_id);

/* ------------------------------ Thiết bị ------------------------------ */
create table if not exists public.employee_devices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  device_hash text not null check (device_hash ~ '^[0-9a-f]{64}$'),
  device_name text,
  platform text,
  model text,
  browser text,
  user_agent text,
  status text not null default 'pending' check (status in ('pending','approved','revoked','rejected')),
  approved_by uuid,
  approved_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index if not exists employee_devices_emp_hash_key on public.employee_devices(employee_id, device_hash);
create index if not exists employee_devices_company_idx on public.employee_devices(company_id, status);

/* ------------------------------ Nhật ký từ chối ------------------------------ */
create table if not exists public.attendance_punch_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  action text not null,
  session text,
  reason text not null,
  device_id uuid references public.employee_devices(id) on delete set null,
  device_hash text,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  created_at timestamptz not null default now()
);
create index if not exists attendance_punch_logs_company_idx on public.attendance_punch_logs(company_id, created_at desc);

/* ------------------------------ Cột mới cho bản ghi ------------------------------ */
alter table public.attendance_records
  add column if not exists photo_path text,
  add column if not exists photo_out_path text,
  add column if not exists accuracy_m double precision,
  add column if not exists latitude_out double precision,
  add column if not exists longitude_out double precision,
  add column if not exists accuracy_out_m double precision,
  add column if not exists distance_m double precision,
  add column if not exists distance_out_m double precision,
  add column if not exists location_id uuid references public.attendance_locations(id) on delete set null,
  add column if not exists device_id uuid references public.employee_devices(id) on delete set null,
  add column if not exists device_out_id uuid references public.employee_devices(id) on delete set null,
  add column if not exists flags text[] not null default '{}';

/* ------------------------------ RLS ------------------------------ */
alter table public.attendance_policies enable row level security;
alter table public.attendance_locations enable row level security;
alter table public.employee_devices enable row level security;
alter table public.attendance_punch_logs enable row level security;

drop policy if exists attendance_policies_select on public.attendance_policies;
create policy attendance_policies_select on public.attendance_policies for select to authenticated
  using (public.is_company_member(company_id));
drop policy if exists attendance_policies_write on public.attendance_policies;
create policy attendance_policies_write on public.attendance_policies for all to authenticated
  using (public.has_permission(company_id, 'attendance.edit') or public.has_permission(company_id, 'attendance.manage'))
  with check (public.has_permission(company_id, 'attendance.edit') or public.has_permission(company_id, 'attendance.manage'));

drop policy if exists attendance_locations_select on public.attendance_locations;
create policy attendance_locations_select on public.attendance_locations for select to authenticated
  using (public.is_company_member(company_id));
drop policy if exists attendance_locations_write on public.attendance_locations;
create policy attendance_locations_write on public.attendance_locations for all to authenticated
  using (public.has_permission(company_id, 'attendance.edit') or public.has_permission(company_id, 'attendance.manage'))
  with check (public.has_permission(company_id, 'attendance.edit') or public.has_permission(company_id, 'attendance.manage'));

-- Thiết bị: nhân viên xem thiết bị của mình; HR/quản lý xem nhân viên mình phụ trách. Ghi chỉ qua RPC.
drop policy if exists employee_devices_select on public.employee_devices;
create policy employee_devices_select on public.employee_devices for select to authenticated
  using (public.can_access_employee(employee_id));

drop policy if exists attendance_punch_logs_select on public.attendance_punch_logs;
create policy attendance_punch_logs_select on public.attendance_punch_logs for select to authenticated
  using (public.can_view_attendance(company_id) and public.can_access_employee(employee_id));

revoke all on public.attendance_policies, public.attendance_locations, public.employee_devices, public.attendance_punch_logs from anon;
grant select, insert, update, delete on public.attendance_policies, public.attendance_locations to authenticated;
grant select on public.employee_devices, public.attendance_punch_logs to authenticated;

-- Bỏ quyền tự insert/update của nhân viên; chỉ còn nhánh theo quyền attendance.* (policy attendance_grant_*).
drop policy if exists attendance_records_insert on public.attendance_records;
drop policy if exists attendance_records_update on public.attendance_records;

/* ------------------------------ Guard: chặn ghi tay không qua RPC ------------------------------ */
create or replace function public.guard_attendance_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  -- Ghi từ RPC attendance_punch (đã tự kiểm tra mọi điều kiện).
  if current_setting('app.attendance_punch', true) = 'on' then
    return new;
  end if;
  if public.can_manage_employee(coalesce(new.employee_id, old.employee_id)) then
    return new;
  end if;
  raise exception 'Vui lòng chấm công bằng màn hình Chấm công (ảnh, GPS, thiết bị đã đăng ký).';
end $$;

/* ------------------------------ Hàm phụ ------------------------------ */
create or replace function public.haversine_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable set search_path = public as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

create or replace function public.attendance_resolve_shift(p_employee uuid, p_date date)
returns uuid language sql stable security definer set search_path = public as $$
  with e as (select * from public.employees where id = p_employee),
  cand as (
    select a.shift_id,
      case a.scope_type when 'employee' then 1 when 'position' then 2 when 'department' then 3 else 4 end as rank,
      a.created_at
    from public.shift_assignments a, e
    where a.company_id = e.company_id
      and (a.effective_from is null or a.effective_from <= p_date)
      and (a.effective_to is null or a.effective_to >= p_date)
      and (
        (a.scope_type = 'employee' and a.scope_value = e.code)
        or (a.scope_type = 'position' and a.scope_value = e.position)
        or (a.scope_type = 'department' and a.scope_value = e.department)
        or a.scope_type = 'company'
      )
  ),
  best as (select shift_id from cand order by rank, created_at desc limit 1)
  select s.id from best join public.work_shifts s on s.id = best.shift_id and s.active;
$$;

create or replace function public.attendance_effective_policy(p_company uuid)
returns public.attendance_policies language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p from public.attendance_policies p where p.company_id = p_company),
    row(p_company, true, true, 'flag', 150, true, 1, true, now(), null)::public.attendance_policies
  );
$$;

-- Quản trị chấm công (duyệt thiết bị): cần attendance.edit hoặc attendance.manage (không tính attendance.create của nhân viên).
create or replace function public.attendance_can_admin(p_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_permission(p_company, 'attendance.edit') or public.has_permission(p_company, 'attendance.manage');
$$;

/* ------------------------------ Đăng ký thiết bị ------------------------------ */
create or replace function public.register_attendance_device(
  p_company_id uuid, p_device_hash text, p_device_name text, p_platform text, p_model text, p_browser text, p_user_agent text
) returns public.employee_devices
language plpgsql security definer set search_path = public as $$
declare
  v_emp public.employees;
  v_pol public.attendance_policies;
  v_dev public.employee_devices;
  v_active int;
  v_ever int;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập.'; end if;
  if p_device_hash is null or p_device_hash !~ '^[0-9a-f]{64}$' then raise exception 'Mã thiết bị không hợp lệ.'; end if;
  select * into v_emp from public.employees where user_id = auth.uid() and company_id = p_company_id and status <> 'resigned' order by created_at limit 1;
  if v_emp.id is null then raise exception 'Tài khoản chưa gắn hồ sơ nhân sự.'; end if;
  v_pol := public.attendance_effective_policy(v_emp.company_id);

  select * into v_dev from public.employee_devices where employee_id = v_emp.id and device_hash = p_device_hash;
  if v_dev.id is not null then
    if v_dev.status in ('revoked','rejected') then
      update public.employee_devices set status = 'pending', approved_by = null, approved_at = null, revoked_at = null,
        device_name = left(coalesce(nullif(trim(p_device_name),''), device_name), 80), created_at = now()
      where id = v_dev.id returning * into v_dev;
    end if;
    return v_dev;
  end if;

  select count(*) filter (where status in ('pending','approved')), count(*) into v_active, v_ever
  from public.employee_devices where employee_id = v_emp.id;
  if v_active >= v_pol.max_devices then
    raise exception 'Bạn đã có thiết bị đăng ký/đang chờ duyệt. Liên hệ HR để đặt lại thiết bị.';
  end if;

  insert into public.employee_devices(company_id, employee_id, device_hash, device_name, platform, model, browser, user_agent, status, approved_at)
  values (v_emp.company_id, v_emp.id, p_device_hash, left(nullif(trim(p_device_name),''), 80), left(p_platform, 60), left(p_model, 80),
          left(p_browser, 60), left(p_user_agent, 400),
          case when v_pol.auto_approve_first_device and v_ever = 0 then 'approved' else 'pending' end,
          case when v_pol.auto_approve_first_device and v_ever = 0 then now() end)
  returning * into v_dev;
  return v_dev;
end $$;

create or replace function public.review_attendance_device(p_device uuid, p_action text)
returns public.employee_devices
language plpgsql security definer set search_path = public as $$
declare
  v_dev public.employee_devices;
  v_pol public.attendance_policies;
  v_count int;
begin
  select * into v_dev from public.employee_devices where id = p_device;
  if v_dev.id is null then raise exception 'Không tìm thấy thiết bị.'; end if;
  if not (public.attendance_can_admin(v_dev.company_id) and public.can_access_employee(v_dev.employee_id)) then
    raise exception 'Bạn không có quyền duyệt thiết bị chấm công.';
  end if;
  if p_action = 'approve' then
    v_pol := public.attendance_effective_policy(v_dev.company_id);
    select count(*) into v_count from public.employee_devices
      where employee_id = v_dev.employee_id and status = 'approved' and id <> v_dev.id;
    if v_count >= v_pol.max_devices then
      raise exception 'Nhân viên đã đủ % thiết bị được duyệt. Thu hồi thiết bị cũ trước.', v_pol.max_devices;
    end if;
    update public.employee_devices set status = 'approved', approved_by = auth.uid(), approved_at = now(), revoked_at = null
      where id = p_device returning * into v_dev;
  elsif p_action in ('revoke','reject') then
    update public.employee_devices set status = case when p_action = 'revoke' then 'revoked' else 'rejected' end,
      revoked_at = now(), approved_by = auth.uid()
      where id = p_device returning * into v_dev;
  elsif p_action = 'delete' then
    delete from public.employee_devices where id = p_device;
  else
    raise exception 'Thao tác không hợp lệ.';
  end if;
  return v_dev;
end $$;

-- Đặt lại: thu hồi toàn bộ thiết bị của nhân viên để họ đăng ký máy mới.
create or replace function public.reset_employee_devices(p_employee uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_n int;
begin
  select company_id into v_company from public.employees where id = p_employee;
  if v_company is null or not (public.attendance_can_admin(v_company) and public.can_access_employee(p_employee)) then
    raise exception 'Bạn không có quyền đặt lại thiết bị.';
  end if;
  update public.employee_devices set status = 'revoked', revoked_at = now(), approved_by = auth.uid()
    where employee_id = p_employee and status in ('pending','approved');
  get diagnostics v_n = row_count;
  -- Cho phép tự duyệt lại máy mới nếu công ty bật tự duyệt thiết bị đầu tiên.
  delete from public.employee_devices where employee_id = p_employee and status in ('revoked','rejected');
  return v_n;
end $$;

/* ------------------------------ Chấm công ------------------------------ */
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
  if v_pol.require_device and (v_dev.id is null or v_dev.status <> 'approved') then
    v_reason := case when v_dev.id is null then 'Thiết bị lạ, chưa đăng ký.'
                     when v_dev.status = 'pending' then 'Thiết bị đang chờ HR duyệt.'
                     else 'Thiết bị đã bị thu hồi.' end;
  end if;

  -- 2. GPS
  if v_reason is null and v_pol.require_gps then
    if p_latitude is null or p_longitude is null then
      v_reason := 'Không có vị trí GPS.';
    elsif p_accuracy is null or p_accuracy > v_pol.max_accuracy_m then
      v_reason := format('GPS không đủ chính xác (±%s m, cần ≤ %s m).', round(coalesce(p_accuracy, 99999)::numeric), v_pol.max_accuracy_m);
    end if;
  end if;
  if p_latitude is not null and p_longitude is not null then
    if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
      raise exception 'Toạ độ không hợp lệ.';
    end if;
    select exists(select 1 from public.attendance_locations where company_id = v_emp.company_id and active) into v_has_loc;
    if v_has_loc then
      select l.id, public.haversine_m(p_latitude, p_longitude, l.latitude, l.longitude) into v_loc, v_dist
      from public.attendance_locations l where l.company_id = v_emp.company_id and l.active
      order by public.haversine_m(p_latitude, p_longitude, l.latitude, l.longitude) - l.radius_m limit 1;
      if not exists (select 1 from public.attendance_locations l where l.id = v_loc and v_dist <= l.radius_m) then
        if v_reason is null and v_pol.require_gps and v_pol.gps_mode = 'reject' then
          v_reason := format('Ngoài vùng chấm công (cách điểm gần nhất %s m).', round(v_dist::numeric));
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

  if v_dev.id is null and not v_pol.require_device then v_flags := array_append(v_flags, 'unregistered_device'); end if;
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

/* ------------------------------ Quyền gọi hàm ------------------------------ */
revoke all on function public.haversine_m(double precision, double precision, double precision, double precision) from public, anon;
revoke all on function public.attendance_resolve_shift(uuid, date) from public, anon, authenticated;
revoke all on function public.attendance_effective_policy(uuid) from public, anon, authenticated;
revoke all on function public.register_attendance_device(uuid, text, text, text, text, text, text) from public, anon;
revoke all on function public.review_attendance_device(uuid, text) from public, anon;
revoke all on function public.reset_employee_devices(uuid) from public, anon;
revoke all on function public.attendance_punch(uuid, text, text, text, double precision, double precision, double precision, text) from public, anon;
grant execute on function public.haversine_m(double precision, double precision, double precision, double precision) to authenticated;
grant execute on function public.register_attendance_device(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.review_attendance_device(uuid, text) to authenticated;
grant execute on function public.reset_employee_devices(uuid) to authenticated;
grant execute on function public.attendance_punch(uuid, text, text, text, double precision, double precision, double precision, text) to authenticated;
revoke all on function public.attendance_can_admin(uuid) from public, anon;
grant execute on function public.attendance_can_admin(uuid) to authenticated;
revoke all on function public.guard_attendance_changes() from public, anon, authenticated;

/* ------------------------------ Storage: ảnh chấm công ------------------------------ */
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attendance-photos', 'attendance-photos', false, 2097152, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'];

drop policy if exists attendance_photos_upload on storage.objects;
create policy attendance_photos_upload on storage.objects for insert to authenticated
with check (
  bucket_id = 'attendance-photos'
  and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[^/]+\.jpg$'
  and exists (
    select 1 from public.employees e
    where e.id::text = split_part(name, '/', 2)
      and e.company_id::text = split_part(name, '/', 1)
      and e.user_id = auth.uid()
  )
);

drop policy if exists attendance_photos_read on storage.objects;
create policy attendance_photos_read on storage.objects for select to authenticated
using (
  bucket_id = 'attendance-photos'
  and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/'
  and public.can_access_employee((split_part(name, '/', 2))::uuid)
);

drop policy if exists attendance_photos_delete on storage.objects;
create policy attendance_photos_delete on storage.objects for delete to authenticated
using (
  bucket_id = 'attendance-photos'
  and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/'
  and public.has_permission((split_part(name, '/', 1))::uuid, 'attendance.delete')
);
