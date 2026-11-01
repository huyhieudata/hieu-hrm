begin;
create temp table _snap as select id, position, department from public.employees union all select id, job_title, department from public.company_invites;
-- 1) Chấm công: chặn tái sử dụng ảnh, ghi IP + user-agent mỗi lần chấm, cờ 'ua_changed' khi
--    cùng mã thiết bị nhưng trình duyệt khác lúc đăng ký (HR thấy trong cờ cảnh báo).
-- 2) Chức danh: thêm position_id (FK department_positions) + trigger đồng bộ tên giống department_id
--    trên employees, hợp đồng, quá trình công tác, lời mời, offer, mô tả công việc, onboarding và
--    shift_assignments (scope_type='position'). Backfill theo tên, giữ nguyên cột text cũ.
-- 3) invite_employee + lời mời: báo lỗi rõ nếu phòng ban/chức danh không có trên sơ đồ tổ chức
--    (công ty đã khai báo sơ đồ), trừ giá trị "Khác…" do owner/admin/hr nhập.

alter table public.attendance_punch_logs
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists flags text[] not null default '{}';
alter table public.attendance_records
  add column if not exists ip_in text,
  add column if not exists user_agent_in text,
  add column if not exists ip_out text,
  add column if not exists user_agent_out text;
create index if not exists attendance_records_photo_path_idx on public.attendance_records(photo_path) where photo_path is not null;
create index if not exists attendance_records_photo_out_path_idx on public.attendance_records(photo_out_path) where photo_out_path is not null;

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
end $function$
;
revoke all on function public.attendance_punch(uuid, text, text, text, double precision, double precision, double precision, text) from public, anon;
grant execute on function public.attendance_punch(uuid, text, text, text, double precision, double precision, double precision, text) to authenticated;

-- ---------------- position_id ----------------
create or replace function public.sync_row_position()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_col text := tg_argv[0];
  v_row jsonb := to_jsonb(new);
  v_old jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_text text := v_row->>v_col;
  v_pid uuid := nullif(v_row->>'position_id', '')::uuid;
  v_title text;
  v_company uuid;
  v_dept uuid := nullif(v_row->>'department_id', '')::uuid;
begin
  -- shift_assignments: chỉ áp dụng khi phạm vi là chức danh.
  if tg_table_name = 'shift_assignments' and (v_row->>'scope_type') is distinct from 'position' then
    return jsonb_populate_record(new, jsonb_build_object('position_id', null));
  end if;
  if v_pid is not null and (tg_op = 'INSERT' or v_pid is distinct from nullif(v_old->>'position_id', '')::uuid
                            or (tg_table_name = 'shift_assignments' and (v_old->>'scope_type') is distinct from 'position')) then
    select title, company_id into v_title, v_company from public.department_positions where id = v_pid;
    if v_company is distinct from new.company_id then
      return jsonb_populate_record(new, jsonb_build_object('position_id', null));
    end if;
    return jsonb_populate_record(new, jsonb_build_object(v_col, v_title));
  elsif tg_op = 'INSERT' or v_text is distinct from v_old->>v_col
        or (tg_table_name = 'shift_assignments' and (v_old->>'scope_type') is distinct from 'position') then
    if nullif(btrim(coalesce(v_text, '')), '') is null then
      v_pid := null;
    else
      select id into v_pid from public.department_positions
       where company_id = new.company_id and lower(btrim(title)) = lower(btrim(v_text))
       order by (department_id is not distinct from v_dept) desc, sort_order nulls last, created_at limit 1;
    end if;
    return jsonb_populate_record(new, jsonb_build_object('position_id', v_pid));
  end if;
  return new;
end;
$$;
revoke all on function public.sync_row_position() from public, anon, authenticated;

do $$
declare
  r record;
begin
  for r in select * from (values
    ('employees', 'position'), ('employee_contracts', 'position'), ('employee_work_history', 'position'),
    ('company_invites', 'job_title'), ('candidate_offers', 'position'), ('job_descriptions', 'title'),
    ('onboarding_records', 'position'), ('shift_assignments', 'scope_value')) v(t, c)
  loop
    execute format('alter table public.%I add column if not exists position_id uuid references public.department_positions(id) on delete set null', r.t);
    execute format('create index if not exists %I on public.%I(position_id)', r.t || '_position_id_idx', r.t);
    -- Backfill theo tên (ưu tiên chức danh cùng phòng ban), không ghi đè cột text.
    execute format(
      'update public.%1$I x set position_id = (
          select p.id from public.department_positions p
           where p.company_id = x.company_id and lower(btrim(p.title)) = lower(btrim(x.%2$I))
           order by (p.department_id is not distinct from %3$s) desc, p.sort_order nulls last, p.created_at limit 1)
        where x.position_id is null and nullif(btrim(coalesce(x.%2$I, %4$L)), %4$L) is not null %5$s',
      r.t, r.c,
      case when r.t in ('shift_assignments') then 'null::uuid' else 'x.department_id' end, '',
      case when r.t = 'shift_assignments' then 'and x.scope_type = ''position''' else '' end);
    execute format('drop trigger if exists trg_sync_row_position on public.%I', r.t);
    execute format(
      'create trigger trg_sync_row_position before insert or update of %I, position_id, company_id%s on public.%I
         for each row execute function public.sync_row_position(%L)',
      r.c, case when r.t = 'shift_assignments' then ', scope_type' else '' end, r.t, r.c);
  end loop;
end $$;

-- Đổi tên chức danh -> cập nhật tên hiển thị trên các bảng đã liên kết.
create or replace function public.sync_position_title_everywhere()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if new.title is distinct from old.title then
    for r in select * from (values
      ('employees', 'position'), ('employee_contracts', 'position'), ('employee_work_history', 'position'),
      ('company_invites', 'job_title'), ('candidate_offers', 'position'), ('job_descriptions', 'title'),
      ('onboarding_records', 'position'), ('shift_assignments', 'scope_value')) v(t, c)
    loop
      execute format('update public.%I set %I = $1 where position_id = $2', r.t, r.c) using new.title, new.id;
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_position_title_everywhere() from public, anon, authenticated;
drop trigger if exists trg_sync_position_title_everywhere on public.department_positions;
create trigger trg_sync_position_title_everywhere
  after update of title on public.department_positions
  for each row execute function public.sync_position_title_everywhere();

-- ---------------- Kiểm tra theo sơ đồ tổ chức ----------------
create or replace function public.org_assert_valid(p_company uuid, p_department text, p_position text)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dept text := nullif(btrim(coalesce(p_department, '')), '');
  v_pos text := nullif(btrim(coalesce(p_position, '')), '');
  v_privileged boolean := public.has_company_role(p_company, array['owner', 'admin', 'hr']);
begin
  if v_dept is not null and exists (select 1 from public.departments where company_id = p_company)
     and not exists (select 1 from public.departments where company_id = p_company and lower(btrim(name)) = lower(v_dept))
     and not (v_privileged and lower(v_dept) like 'khác%') then
    raise exception 'Phòng ban "%" không có trên sơ đồ tổ chức. Chọn phòng ban có sẵn hoặc thêm vào Cài đặt › Cơ cấu tổ chức.', v_dept
      using errcode = 'P0001', hint = 'ORG_DEPARTMENT_NOT_FOUND';
  end if;
  if v_pos is not null and exists (select 1 from public.department_positions where company_id = p_company)
     and not exists (select 1 from public.department_positions where company_id = p_company and lower(btrim(title)) = lower(v_pos))
     and not (v_privileged and lower(v_pos) like 'khác%') then
    raise exception 'Chức danh "%" không có trên sơ đồ tổ chức. Chọn chức danh có sẵn hoặc thêm vào Cài đặt › Cơ cấu tổ chức.', v_pos
      using errcode = 'P0001', hint = 'ORG_POSITION_NOT_FOUND';
  end if;
end;
$$;
revoke all on function public.org_assert_valid(uuid, text, text) from public, anon;
grant execute on function public.org_assert_valid(uuid, text, text) to authenticated;

-- Lời mời (cả RPC invite_employee lẫn insert trực tiếp từ màn Thành viên) phải khớp sơ đồ.
create or replace function public.validate_invite_org()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' or new.department is distinct from old.department or new.job_title is distinct from old.job_title then
    perform public.org_assert_valid(new.company_id,
      case when tg_op = 'INSERT' or new.department is distinct from old.department then new.department end,
      case when tg_op = 'INSERT' or new.job_title is distinct from old.job_title then new.job_title end);
  end if;
  return new;
end;
$$;
revoke all on function public.validate_invite_org() from public, anon, authenticated;
drop trigger if exists trg_validate_invite_org on public.company_invites;
create trigger trg_validate_invite_org
  before insert or update of department, job_title on public.company_invites
  for each row execute function public.validate_invite_org();
;
do $dry$
declare
  v_co uuid; v_owner uuid; v_dept uuid; v_pos uuid; v_emp uuid; v_txt text; v_out text := '';
  v_changed int; v_bf int; v_ok boolean;
begin
  select pg_get_functiondef('public.guard_attendance_changes()'::regprocedure) like '%app.attendance_punch%' into v_ok;
  v_out := v_out || 'guard_flag=' || v_ok;
  select prosrc like '%đã được dùng cho một lần chấm công khác%' and prosrc like '%request.headers%' into v_ok from pg_proc where proname='attendance_punch';
  v_out := v_out || ' punch_photo_ip=' || v_ok;
  select count(*) into v_changed from _snap s left join public.employees e on e.id=s.id left join public.company_invites i on i.id=s.id
   where coalesce(e.position, i.job_title) is distinct from s.position or coalesce(e.department, i.department) is distinct from s.department;
  v_out := v_out || ' text_changed=' || v_changed;
  select count(*) into v_bf from public.employees where position_id is not null;
  v_out := v_out || ' emp_backfilled=' || v_bf || '/' || (select count(*) from public.employees where nullif(position,'') is not null);

  select c.id, m.user_id into v_co, v_owner from public.companies c join public.company_members m on m.company_id=c.id and m.role='owner' limit 1;
  insert into public.departments(company_id, name) values (v_co, 'DRY Phòng') returning id into v_dept;
  insert into public.department_positions(company_id, department_id, title) values (v_co, v_dept, 'DRY Chức danh') returning id into v_pos;
  insert into public.employees(company_id, code, full_name, position, department) values (v_co, 'DRY001', 'DRY NV', 'dry chức danh', 'DRY Phòng') returning id into v_emp;
  v_out := v_out || ' emp_link=' || ((select position_id from public.employees where id=v_emp) = v_pos);
  update public.department_positions set title='DRY Đổi tên' where id=v_pos;
  v_out := v_out || ' rename=' || (select position from public.employees where id=v_emp);
  insert into public.shift_assignments(company_id, shift_id, scope_type, scope_value, effective_from)
    select v_co, id, 'position', 'DRY Đổi tên', current_date from public.work_shifts where company_id=v_co limit 1;
  v_out := v_out || ' shift_link=' || coalesce((select (position_id = v_pos)::text from public.shift_assignments where scope_value='DRY Đổi tên'), 'no-shift');

  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  begin perform public.org_assert_valid(v_co, 'Phòng không tồn tại', null); v_out := v_out || ' bad_dept=allowed';
  exception when others then v_out := v_out || ' bad_dept=' || sqlerrm; end;
  begin perform public.org_assert_valid(v_co, null, 'Chức danh lạ'); v_out := v_out || ' bad_pos=allowed';
  exception when others then v_out := v_out || ' bad_pos=rejected'; end;
  begin perform public.org_assert_valid(v_co, 'Khác', 'Khác (ghi rõ)'); v_out := v_out || ' khac=allowed';
  exception when others then v_out := v_out || ' khac=' || sqlerrm; end;
  begin perform public.org_assert_valid(v_co, 'DRY Phòng', 'DRY Đổi tên'); v_out := v_out || ' valid=allowed';
  exception when others then v_out := v_out || ' valid=' || sqlerrm; end;
  begin
    insert into public.company_invites(company_id, email, role, department, invited_by) values (v_co, 'dry@x.vn', 'employee', 'Phòng ma', v_owner);
    v_out := v_out || ' invite_bad=allowed';
  exception when others then v_out := v_out || ' invite_bad=rejected';
  end;
  raise exception 'DRYRUN %', v_out;
end $dry$;
rollback;
