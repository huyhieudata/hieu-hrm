-- Kịch bản kiểm thử Đợt 1 (luôn ROLLBACK). Chạy sau khi migration 20261101200000 đã có (hoặc dán migration phía trước).
create temp table _t(name text, ok boolean, detail text) on commit drop;
grant all on _t to authenticated;
do $$
declare v_emp uuid; v_company uuid; v_user uuid; v_req uuid; v_ct uuid; v_msg text;
begin
  select e.id, e.company_id, m.user_id into v_emp, v_company, v_user
  from public.employees e join public.company_members m on m.company_id = e.company_id and m.role = 'owner' and m.status = 'active'
  limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);

  begin update public.employees set national_id = '12345' where id = v_emp; insert into _t values ('cccd_11_so_bi_chan', false, 'không chặn');
  exception when others then insert into _t values ('cccd_sai_bi_chan', true, sqlerrm); end;
  begin update public.employees set tax_code = '123' where id = v_emp; insert into _t values ('mst_sai_bi_chan', false, 'không chặn');
  exception when others then insert into _t values ('mst_sai_bi_chan', true, sqlerrm); end;
  begin update public.employees set tax_code = '0123456789', bank_account = '999000111' where id = v_emp;
    insert into _t select 'audit_ghi_nhat_ky', count(*) > 0, string_agg(array_to_string(fields, ','), ';') from public.employee_sensitive_audit where employee_id = v_emp;
  exception when others then insert into _t values ('mst_hop_le', false, sqlerrm); end;
  insert into _t select 'dup_check_chay', true, count(*)::text from public.employee_duplicate_check(v_company, '000000000000', null, null);

  begin insert into public.employee_certificates(employee_id, name, issue_date, expiry_date) values (v_emp, 'TEST', '2026-01-01', '2027-01-01');
    insert into _t values ('them_chung_chi_owner', true, null);
  exception when others then insert into _t values ('them_chung_chi_owner', false, sqlerrm); end;

  begin insert into public.employee_contracts(employee_id, contract_type, start_date, end_date, base_salary, work_location)
    values (v_emp, 'seasonal', '2026-11-01', '2027-01-31', 10000000, 'HN') returning id into v_ct;
    insert into public.contract_appendices(contract_id, change_type, effective_date, base_salary) values (v_ct, 'salary', '2026-12-01', 12000000);
    insert into _t select 'phu_luc_stamp_company', company_id = v_company, null from public.contract_appendices where contract_id = v_ct;
  exception when others then insert into _t values ('hop_dong_phu_luc', false, sqlerrm); end;

  begin insert into public.contract_templates(company_id, name, body_html) values (v_company, 'TEST', '<p>{{ho_ten}}</p>');
    insert into _t values ('mau_hop_dong_owner', true, null);
  exception when others then insert into _t values ('mau_hop_dong_owner', false, sqlerrm); end;

  -- Nhân viên tự đề nghị: owner có gắn hồ sơ không? Thử với user của hồ sơ (nếu có)
  begin
    v_req := public.submit_employee_change_request(v_company, '{"phone":"0900000001"}'::jsonb, null);
    perform public.review_employee_change_request(v_req, true, 'ok');
    insert into _t select 'duyet_de_nghi_ap_dung', phone = '0900000001', null from public.employees where id = v_emp;
  exception when others then insert into _t values ('de_nghi_cap_nhat', null, sqlerrm); end;
  begin perform public.submit_employee_change_request(v_company, '{"national_id":"1"}'::jsonb, null);
    insert into _t values ('chan_truong_ngoai_danh_sach', false, 'không chặn');
  exception when others then insert into _t values ('chan_truong_ngoai_danh_sach', true, sqlerrm); end;

  -- Ẩn danh: không thấy gì
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  insert into _t select 'nguoi_la_khong_thay_phu_luc', count(*) = 0, count(*)::text from public.contract_appendices;
  insert into _t select 'nguoi_la_khong_thay_nhat_ky', count(*) = 0, count(*)::text from public.employee_sensitive_audit;
  insert into _t select 'nguoi_la_khong_thay_de_nghi', count(*) = 0, count(*)::text from public.employee_change_requests;
  insert into _t select 'nguoi_la_khong_thay_mau', count(*) = 0, count(*)::text from public.contract_templates;
  perform set_config('role', 'postgres', true);
end $$;

do $$ begin raise exception 'DRYRUN_RESULT %', (select json_agg(_t) from _t); end $$; -- lỗi cố ý ⇒ toàn bộ rollback
