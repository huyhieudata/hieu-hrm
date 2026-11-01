-- Dry-run theo dõi cài app: chạy sau migration 20261101130000, luôn rollback bằng raise exception.
do $$
declare
  v_uid uuid; v_company uuid; out text := ''; n int; h text := repeat('ab', 32); r record;
begin
  select m.user_id, m.company_id into v_uid, v_company from public.company_members m
  where m.status = 'active' and m.role in ('owner','admin') limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;

  perform public.report_app_install(v_company, h, 'android', 'browser', 'open');
  select count(*) into n from public.app_installs; out := out || '1 browser_open_rows=' || n || '; ';

  perform public.report_app_install(v_company, h, 'android', 'standalone', 'open');
  perform public.report_app_install(v_company, h, 'android', 'standalone', 'open');
  select open_count into n from public.app_installs where device_hash = h; out := out || '2 opens=' || n || '; ';

  perform public.report_app_install(v_company, repeat('cd', 32), 'ios', 'browser', 'installed');
  select * into r from public.app_install_status(v_company) s where s.user_id = v_uid;
  out := out || '3 installed=' || r.installed || ' devices=' || r.device_count || ' plats=' || array_to_string(r.platforms, ',') || '; ';

  begin perform public.report_app_install(v_company, 'xyz', 'ios', 'standalone', 'open'); out := out || '4 FAIL; ';
  exception when others then out := out || '4 ok; '; end;

  begin insert into public.app_installs(company_id, user_id, device_hash) values (v_company, v_uid, repeat('ef',32)); out := out || '5 FAIL direct insert; ';
  exception when others then out := out || '5 ok; '; end;

  begin perform public.report_app_install(gen_random_uuid(), h, 'ios', 'standalone', 'open'); out := out || '6 FAIL; ';
  exception when others then out := out || '6 ok; '; end;

  reset role;
  out := out || '7 anon_exec=' || has_function_privilege('anon', 'public.report_app_install(uuid,text,text,text,text)', 'execute')
      || '/' || has_function_privilege('anon', 'public.app_install_status(uuid)', 'execute');
  raise exception 'DRYRUN %', out;
end $$;
