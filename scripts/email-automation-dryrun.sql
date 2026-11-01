-- Dry-run module Email: chạy sau migration 20261101170000, luôn rollback (raise exception ở cuối).
do $$
declare
  v_uid uuid; v_company uuid; v_emp uuid; v_tpl uuid; v_rule uuid; v_req uuid; v_rt uuid; out text := ''; n int; s text;
begin
  select m.user_id, m.company_id into v_uid, v_company from public.company_members m
  where m.status = 'active' and m.role in ('owner','admin') limit 1;
  select count(*) into n from public.email_templates where company_id = v_company and is_default;
  out := out || '1 seeded=' || n || '; ';
  select id into v_tpl from public.email_templates where company_id = v_company and code = 'ho_so_moi';

  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.email_rules (company_id, name, event_key, recipients, template_id, conditions)
  values (v_company, 'DRY hồ sơ mới', 'employee_created', '{"employee":true,"emails":["hr.dry@example.com","HR.DRY@example.com"]}', v_tpl,
          '{"departments":["DRY-PB"]}') returning id into v_rule;
  insert into public.email_templates (company_id, code, name, subject, body_html)
  values (v_company, 'dry_xss', 'XSS', 'a', '<p onclick="x()">hi</p><script>alert(1)</script><a href="javascript:alert(1)">l</a>')
  returning body_html into s;
  out := out || '2 sanitized=' || s || '; ';
  reset role;

  insert into public.employees (company_id, full_name, code, status, department, work_email)
  values (v_company, 'DRYRUN A', 'DRYA', 'active', 'DRY-PB', 'dry.a@example.com') returning id into v_emp;
  insert into public.employees (company_id, full_name, code, status, department, work_email)
  values (v_company, 'DRYRUN B', 'DRYB', 'active', 'Khác', 'dry.b@example.com');
  select count(*) into n from public.email_queue where rule_id = v_rule;
  out := out || '3 queued(A only, dedupe email)=' || n || '; ';
  n := public.email_enqueue_event(v_company, 'employee_created', v_emp, 'emp:' || v_emp);
  out := out || '4 re-enqueue=' || n || '; ';
  select vars->>'ten_nhan_vien' into s from public.email_queue where rule_id = v_rule limit 1;
  out := out || '5 var=' || s || '; ';

  select count(*) into n from public.email_claim_batch(50, v_company) where rule_id = v_rule;
  out := out || '6 claimed=' || n || '; ';
  select count(*) into n from public.email_claim_batch(50, v_company) where rule_id = v_rule;
  out := out || '7 reclaim=' || n || '; ';

  -- nhân viên thường không đọc được
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.email_queue;
  out := out || '8 stranger_queue=' || n || '; ';
  select count(*) into n from public.email_templates;
  out := out || '9 stranger_tpl=' || n || '; ';
  begin insert into public.email_queue (company_id, event_key, event_ref, to_email, dedupe_key) values (v_company,'x','x','a@b.vn','x');
    out := out || '10 FAIL; ';
  exception when others then out := out || '10 insert_denied; '; end;
  reset role;
  out := out || '11 anon_enqueue=' || has_function_privilege('anon','public.email_enqueue_event(uuid,text,uuid,text,jsonb,uuid)','execute')
    || ' auth_enqueue=' || has_function_privilege('authenticated','public.email_enqueue_event(uuid,text,uuid,text,jsonb,uuid)','execute')
    || ' cron=' || (select count(*) from cron.job where jobname = 'email-tick');
  raise exception 'DRYRUN %', out;
end $$;
