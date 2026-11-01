-- Dry-run mời nhân viên: chạy sau migration 20261101140000, luôn rollback.
do $$
declare
  v_uid uuid; v_company uuid; v_emp uuid; out text := ''; r record; s record; n int;
begin
  select m.user_id, m.company_id into v_uid, v_company from public.company_members m
  where m.status = 'active' and m.role in ('owner','admin') limit 1;
  insert into public.employees (company_id, full_name, code, status) values (v_company, 'DRYRUN NV', 'DRY001', 'active') returning id into v_emp;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;

  begin perform public.invite_employee(v_emp, '', 'employee'); out := out || '1 FAIL; ';
  exception when others then out := out || '1 ' || sqlerrm || '; '; end;

  select * into r from public.invite_employee(v_emp, 'Dry.Run@Example.com', 'manager', 'Trưởng nhóm', 'Kinh doanh');
  out := out || '2 token=' || (length(r.token) > 10) || '; ';
  select * into s from public.employee_invite_status(v_company) x where x.employee_id = v_emp;
  out := out || '3 status=' || s.status || ' email=' || s.email || ' role=' || s.role || '; ';

  perform public.invite_employee(v_emp, 'dry.run@example.com', 'employee');
  select count(*) into n from public.company_invites where employee_id = v_emp and not revoked;
  out := out || '4 active=' || n || '; ';

  perform public.revoke_employee_invite((select invite_id from public.employee_invite_status(v_company) x where x.employee_id = v_emp));
  select status into s from public.employee_invite_status(v_company) x where x.employee_id = v_emp;
  out := out || '5 status=' || s.status || '; ';

  begin perform public.invite_employee(v_emp, 'a@b.vn', 'owner'); out := out || '6 FAIL; ';
  exception when others then out := out || '6 ' || sqlerrm || '; '; end;

  reset role;
  out := out || '7 anon=' || has_function_privilege('anon','public.invite_employee(uuid,text,text,text,text)','execute');
  raise exception 'DRYRUN %', out;
end $$;
