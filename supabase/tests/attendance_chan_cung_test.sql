-- Test chặn cứng chấm công (chạy trong transaction, luôn rollback bằng raise ở cuối).
-- Kiểm tra: sai máy / máy chờ duyệt / ngoài bán kính / GPS kém đều bị từ chối, không có bản ghi công,
-- không bật được gps_mode='flag', nhân viên không tự insert/update attendance_records.
do $$
declare
  v_uid uuid := gen_random_uuid();
  v_co uuid; v_emp uuid; v_r jsonb; v_n int; v_out text := '';
  v_ok boolean;
begin
  insert into auth.users(id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'test-chan-cung-' || left(v_uid::text, 8) || '@example.invalid',
          jsonb_build_object('provisioned_company', true), '{}'::jsonb, now(), now());
  insert into public.companies(name) values ('TEST chặn cứng (rollback)') returning id into v_co;
  insert into public.company_members(company_id, user_id, role, status) values (v_co, v_uid, 'employee', 'active');
  insert into public.employees(company_id, code, full_name, user_id, status)
    values (v_co, 'TST1', 'Nhân viên thử', v_uid, 'active') returning id into v_emp;
  insert into public.attendance_locations(company_id, name, latitude, longitude, radius_m, active)
    values (v_co, 'Văn phòng thử', 10.7769, 106.7009, 100, true);
  insert into public.employee_devices(company_id, employee_id, device_hash, status) values
    (v_co, v_emp, repeat('a',64), 'approved'), (v_co, v_emp, repeat('b',64), 'pending');

  -- 0. Không bật được chế độ cảnh báo mềm
  begin
    insert into public.attendance_policies(company_id, gps_mode) values (v_co, 'flag');
    v_out := v_out || ' FAIL0(flag allowed)';
  exception when check_violation then v_out := v_out || ' T0:ok';
  end;

  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  set local role authenticated;

  -- 1. Máy chưa đăng ký
  v_r := public.attendance_punch(v_co, 'in', 'morning', repeat('c',64), 10.7769, 106.7009, 10, null);
  v_out := v_out || case when (v_r->>'ok')::boolean = false and v_r->>'reason' like '%chưa được đăng ký%' then ' T1:ok' else ' FAIL1:' || v_r::text end;
  -- 2. Máy chờ duyệt
  v_r := public.attendance_punch(v_co, 'in', 'morning', repeat('b',64), 10.7769, 106.7009, 10, null);
  v_out := v_out || case when (v_r->>'ok')::boolean = false and v_r->>'reason' like '%chờ HR duyệt%' then ' T2:ok' else ' FAIL2:' || v_r::text end;
  -- 3. Không gửi mã máy
  v_r := public.attendance_punch(v_co, 'in', 'morning', null, 10.7769, 106.7009, 10, null);
  v_out := v_out || case when (v_r->>'ok')::boolean = false then ' T3:ok' else ' FAIL3' end;
  -- 4. Đúng máy nhưng ngoài bán kính (~1,1 km)
  v_r := public.attendance_punch(v_co, 'in', 'morning', repeat('a',64), 10.7869, 106.7009, 10, null);
  v_out := v_out || case when (v_r->>'ok')::boolean = false and v_r->>'reason' like '%ngoài vùng chấm công%' then ' T4:ok' else ' FAIL4:' || v_r::text end;
  -- 5. Không có GPS
  v_r := public.attendance_punch(v_co, 'in', 'morning', repeat('a',64), null, null, null, null);
  v_out := v_out || case when (v_r->>'ok')::boolean = false and v_r->>'reason' like '%GPS%' then ' T5:ok' else ' FAIL5:' || v_r::text end;
  -- 6. GPS sai số lớn
  v_r := public.attendance_punch(v_co, 'in', 'morning', repeat('a',64), 10.7769, 106.7009, 5000, null);
  v_out := v_out || case when (v_r->>'ok')::boolean = false and v_r->>'reason' like '%chính xác%' then ' T6:ok' else ' FAIL6:' || v_r::text end;
  -- 7. Tự insert bản ghi công
  begin
    insert into public.attendance_records(company_id, employee_id, work_date, session, check_in, method, status)
      values (v_co, v_emp, current_date, 'morning', now(), 'phone', 'on_time');
    v_out := v_out || ' FAIL7(insert allowed)';
  exception when others then v_out := v_out || ' T7:ok';
  end;
  reset role;

  select count(*) into v_n from public.attendance_records where employee_id = v_emp;
  v_out := v_out || case when v_n = 0 then ' NoRecords:ok' else ' FAIL_records=' || v_n end;
  select count(*) into v_n from public.attendance_punch_logs where employee_id = v_emp;
  v_out := v_out || ' logs=' || v_n;
  raise exception 'DRYRUN_RESULT%', v_out;
end $$;
