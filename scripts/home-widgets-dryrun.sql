-- Dry-run widget trang chủ: chạy sau migration 20261101120000, luôn rollback bằng raise exception.
do $$
declare
  v_uid uuid; v_company uuid; r jsonb; out text := ''; n int;
begin
  select m.user_id, m.company_id into v_uid, v_company from public.company_members m
  where m.status = 'active' and m.role in ('owner','admin') limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;

  r := public.home_dashboard_summary(v_company);
  out := out || '1 role=' || (r->>'role') || ' keys=' || (select count(*) from jsonb_object_keys(r)) || ' total=' || (r->'attendance_today'->>'total') || '; ';

  perform public.save_home_widgets(v_company, 'desktop', '[{"widget_key":"clock","size":"sm"},{"widget_key":"news","enabled":false,"size":"lg","audiences":["admin"]}]'::jsonb);
  select count(*) into n from public.home_widget_settings where company_id = v_company and surface = 'desktop';
  out := out || '2 saved=' || n || ' second=' || (select widget_key || '/' || enabled || '/' || sort_order from public.home_widget_settings where company_id = v_company and surface='desktop' order by sort_order desc limit 1) || '; ';

  begin
    perform public.save_home_widgets(v_company, 'desktop', '[{"widget_key":"clock","size":"xl"}]'::jsonb);
    out := out || '3 FAIL size; ';
  exception when others then out := out || '3 ok; ';
  end;

  perform public.reset_home_widgets(v_company, 'desktop');
  select count(*) into n from public.home_widget_settings where company_id = v_company;
  out := out || '4 reset=' || n || '; ';

  -- 5 vai trò nhân viên: không ghi được, dữ liệu chỉ của mình
  reset role;
  set local session_replication_role = replica;
  update public.company_members set role = 'employee' where user_id = v_uid and company_id = v_company;
  set local session_replication_role = origin;
  set local role authenticated;
  begin
    perform public.save_home_widgets(v_company, 'mobile', '[]'::jsonb);
    out := out || '5 FAIL employee save; ';
  exception when others then out := out || '5 ok; ';
  end;
  r := public.home_dashboard_summary(v_company);
  out := out || '6 role=' || (r->>'role') || ' dept_null=' || (r->'departments' is null or jsonb_typeof(r->'departments') = 'null') || ' scope=' || (r->>'scope_size') || '; ';

  -- 7 người ngoài công ty
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  begin
    perform public.home_dashboard_summary(v_company);
    out := out || '7 FAIL outsider; ';
  exception when others then out := out || '7 ok; ';
  end;
  reset role;
  out := out || '8 anon_exec=' || has_function_privilege('anon', 'public.home_dashboard_summary(uuid)', 'execute')
         || '/' || has_function_privilege('anon', 'public.save_home_widgets(uuid,text,jsonb)', 'execute') || '; ';
  raise exception 'DRYRUN %', out;
end $$;
