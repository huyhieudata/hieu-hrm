-- Dry-run: chạy sau migration trong cùng giao dịch; kết thúc bằng raise exception để huỷ toàn bộ.
do $$
declare
  v_emp public.employees; v_uid uuid; v_hash text := repeat('a', 64); r jsonb; d public.employee_devices;
  out text := ''; v_path text; v_err text;
begin
  select * into v_emp from public.employees where user_id is not null limit 1;
  v_uid := v_emp.user_id;
  -- tạm thời bỏ quyền quản lý: giả lập 1 nhân viên thường bằng user ảo
  v_uid := gen_random_uuid();
  insert into auth.users(id, email, aud, role) values (v_uid, 'dryrun-att@example.invalid', 'authenticated', 'authenticated');
  insert into public.employees(company_id, code, full_name, user_id, status) values (v_emp.company_id, 'DRYRUN1', 'Dry Run', v_uid, (select status from public.employees limit 1))
    returning * into v_emp;
  -- 17 không cho chuyển về chế độ "chỉ gắn cờ"
  begin
    insert into public.attendance_policies(company_id, gps_mode) values (v_emp.company_id, 'flag')
      on conflict (company_id) do update set gps_mode = 'flag';
    out := out || '17 FAIL flag allowed; ';
  exception when others then out := out || '17 ok(flag blocked); ';
  end;
  insert into public.attendance_policies(company_id, gps_mode) values (v_emp.company_id, 'reject')
    on conflict (company_id) do update set gps_mode = 'reject', require_photo = true, require_gps = true, require_device = true, auto_approve_first_device = true, max_devices = 1;

  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  set local role authenticated;

  -- 1 insert tay bị chặn
  begin
    insert into public.attendance_records(company_id, employee_id, work_date, session, check_in, status)
    values (v_emp.company_id, v_emp.id, (now() at time zone 'Asia/Ho_Chi_Minh')::date, 'morning', now(), 'on_time');
    out := out || '1 FAIL manual insert allowed; ';
  exception when others then out := out || '1 ok(' || left(sqlerrm, 30) || '); ';
  end;
  -- 2 thiết bị lạ
  r := public.attendance_punch(v_emp.company_id, 'in', 'morning', v_hash, 21.0286, 105.8543, 20, null);
  out := out || '2 ' || (r->>'reason') || '; ';
  -- 3 đăng ký -> tự duyệt
  d := public.register_attendance_device(v_emp.company_id, v_hash, 'iPhone', 'iOS', 'iPhone', 'Safari', 'UA');
  out := out || '3 ' || d.status || '; ';
  -- 3b chưa có địa điểm -> chặn
  r := public.attendance_punch(v_emp.company_id, 'in', 'morning', v_hash, 21.0286, 105.8543, 20, null);
  out := out || '3b ' || (r->>'reason') || '; ';
  reset role;
  insert into public.attendance_locations(company_id, name, latitude, longitude, radius_m) values (v_emp.company_id, 'VP', 21.0285, 105.8542, 200);
  set local role authenticated;
  -- 4 máy thứ 2 bị chặn
  begin
    d := public.register_attendance_device(v_emp.company_id, repeat('b', 64), 'Máy 2', 'Android', 'x', 'Chrome', 'UA');
    out := out || '4 FAIL ' || d.status || '; ';
  exception when others then out := out || '4 ok; ';
  end;
  -- 5 accuracy kém
  r := public.attendance_punch(v_emp.company_id, 'in', 'morning', v_hash, 21.0286, 105.8543, 900, null);
  out := out || '5 ' || (r->>'reason') || '; ';
  -- 6 ngoài vùng (reject)
  r := public.attendance_punch(v_emp.company_id, 'in', 'morning', v_hash, 21.10, 105.90, 20, null);
  out := out || '6 ' || (r->>'reason') || '; ';
  -- 6b không có GPS
  r := public.attendance_punch(v_emp.company_id, 'in', 'morning', v_hash, null, null, null, null);
  out := out || '6b ' || (r->>'reason') || '; ';
  -- 7 thiếu ảnh
  r := public.attendance_punch(v_emp.company_id, 'in', 'morning', v_hash, 21.0286, 105.8543, 20, null);
  out := out || '7 ' || (r->>'reason') || '; ';
  -- 8 ảnh của người khác / không tồn tại
  r := public.attendance_punch(v_emp.company_id, 'in', 'morning', v_hash, 21.0286, 105.8543, 20, gen_random_uuid() || '/x/a.jpg');
  out := out || '8 ' || (r->>'reason') || '; ';
  -- 9 upload ảnh hợp lệ qua RLS storage + chấm thành công
  v_path := v_emp.company_id || '/' || v_emp.id || '/test.jpg';
  insert into storage.objects(bucket_id, name, owner) values ('attendance-photos', v_path, v_uid);
  begin
    insert into storage.objects(bucket_id, name, owner) values ('attendance-photos', v_emp.company_id || '/' || gen_random_uuid() || '/x.jpg', v_uid);
    out := out || '9b FAIL upload other folder; ';
  exception when others then out := out || '9b ok; ';
  end;
  begin
    r := public.attendance_punch(v_emp.company_id, 'in', 'morning', v_hash, 21.0286, 105.8543, 20, v_path);
    out := out || '9 ok=' || (r->>'ok') || coalesce(' ' || (r->>'reason'), '') || ' st=' || coalesce(r->'record'->>'status','') || ' dist=' || coalesce(round((r->'record'->>'distance_m')::numeric)::text,'') || '; ';
  exception when others then out := out || '9 err ' || sqlerrm || '; ';
  end;
  -- 10 chấm trùng
  begin
    r := public.attendance_punch(v_emp.company_id, 'in', 'morning', v_hash, 21.0286, 105.8543, 20, v_path);
    out := out || '10 FAIL dup; ';
  exception when others then out := out || '10 ok(' || left(sqlerrm, 40) || '); ';
  end;
  -- 11 sửa tay check_out bị chặn
  begin
    update public.attendance_records set check_out = now() where employee_id = v_emp.id;
    if found then out := out || '11 FAIL update; '; else out := out || '11 ok(no rows); '; end if;
  exception when others then out := out || '11 ok; ';
  end;
  -- 12 chấm ra
  begin
    r := public.attendance_punch(v_emp.company_id, 'out', 'morning', v_hash, 21.0286, 105.8543, 20, v_path);
    out := out || '12 ok=' || (r->>'ok') || ' st=' || coalesce(r->'record'->>'status','') || '; ';
  exception when others then out := out || '12 err ' || sqlerrm || '; ';
  end;
  -- 13 log từ chối
  out := out || '13 logs=' || (select count(*) from public.attendance_punch_logs where employee_id = v_emp.id) || '; ';
  -- 14 nhân viên không tự duyệt được thiết bị
  begin
    perform public.review_attendance_device(d.id, 'approve');
    out := out || '14 FAIL; ';
  exception when others then out := out || '14 ok; ';
  end;
  -- 15 anon không gọi được
  reset role;
  out := out || '15 anon_exec=' || has_function_privilege('anon', 'public.attendance_punch(uuid,text,text,text,double precision,double precision,double precision,text)', 'execute') || '; ';
  -- 16 thiết bị bị thu hồi -> chặn
  reset role;
  update public.employee_devices set status = 'revoked' where employee_id = v_emp.id;
  set local role authenticated;
  r := public.attendance_punch(v_emp.company_id, 'out', 'afternoon', v_hash, 21.0286, 105.8543, 20, v_path);
  out := out || '16 ' || (r->>'reason') || '; ';
  -- 18 máy khác (hash khác) -> chặn
  r := public.attendance_punch(v_emp.company_id, 'in', 'afternoon', repeat('c', 64), 21.0286, 105.8543, 20, v_path);
  out := out || '18 ' || (r->>'reason') || '; ';
  raise exception 'DRYRUN %', out;
end $$;
