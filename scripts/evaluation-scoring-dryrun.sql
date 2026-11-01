-- Kịch bản dry-run (luôn rollback bằng raise exception ở cuối): chấm phiếu theo biểu mẫu trong hồ sơ ứng viên.
-- Chạy trên DB qua SQL editor/MCP; kết quả nằm trong thông báo lỗi "RESULTS ...". Không để lại dữ liệu.
begin;
create temp table _r(k text, v text) on commit drop;
grant all on _r to authenticated, anon;
do $t$
declare
  c uuid := gen_random_uuid();
  u_hr uuid := gen_random_uuid(); u_iv uuid := gen_random_uuid(); u_iv2 uuid := gen_random_uuid();
  cand uuid; iv uuid; tpl uuid;
begin
  insert into auth.users(id, email, aud, role) values
    (u_hr,'t_hr_'||u_hr||'@x.test','authenticated','authenticated'),
    (u_iv,'t_iv_'||u_iv||'@x.test','authenticated','authenticated'),
    (u_iv2,'t_iv2_'||u_iv2||'@x.test','authenticated','authenticated');
  insert into public.companies(id,name) values (c,'TEST EVAL STEP2');
  insert into public.company_members(company_id,user_id,role) values (c,u_hr,'hr'),(c,u_iv,'employee'),(c,u_iv2,'employee');
  -- Người phỏng vấn: nhân viên được cấp thêm quyền xem tuyển dụng (không có recruitment.edit/delete)
  update public.company_role_permissions set permissions = permissions || array['recruitment.view']
    where company_id=c and role='employee';
  insert into _r select 'emp_perm_row', count(*)::text from public.company_role_permissions where company_id=c and role='employee';
  insert into public.candidates(company_id, full_name) values (c,'UV1') returning id into cand;
  insert into public.candidate_interviews(company_id,candidate_id,scheduled_at) values (c,cand,now()) returning id into iv;
  perform set_config('t.c', c::text, true);
  perform set_config('t.hr', u_hr::text, true); perform set_config('t.iv', u_iv::text, true); perform set_config('t.iv2', u_iv2::text, true);
  perform set_config('t.cand', cand::text, true); perform set_config('t.int', iv::text, true);
end $t$;

set local role authenticated;
-- HR tạo biểu mẫu thử việc thang 7, trọng số 3/1
select set_config('request.jwt.claims', json_build_object('sub',current_setting('t.hr'),'role','authenticated')::text, true);
insert into public.evaluation_templates(company_id,name,kind,scale_max) values (current_setting('t.c')::uuid,'Thử việc 7','probation',7);
select set_config('t.tpl', (select id::text from public.evaluation_templates where company_id=current_setting('t.c')::uuid), true);
insert into public.evaluation_criteria(template_id,company_id,name,weight,sort_order) values
  (current_setting('t.tpl')::uuid, current_setting('t.c')::uuid,'Kết quả',3,1),
  (current_setting('t.tpl')::uuid, current_setting('t.c')::uuid,'Tác phong',1,2);
select set_config('t.k1', (select id::text from public.evaluation_criteria where template_id=current_setting('t.tpl')::uuid and name='Kết quả'), true);
select set_config('t.k2', (select id::text from public.evaluation_criteria where template_id=current_setting('t.tpl')::uuid and name='Tác phong'), true);

-- Người phỏng vấn: thấy biểu mẫu/tiêu chí, lưu nháp đúng payload client gửi
select set_config('request.jwt.claims', json_build_object('sub',current_setting('t.iv'),'role','authenticated')::text, true);
insert into _r select 'iv_sees_tpl_criteria', (select count(*) from public.evaluation_templates)::text||'/'||(select count(*) from public.evaluation_criteria)::text;
insert into public.candidate_evaluations(company_id,candidate_id,template_id,reviewer_id,reviewer_name,interview_id,answers,recommendation,strengths,weaknesses,note,status)
values (current_setting('t.c')::uuid, current_setting('t.cand')::uuid, current_setting('t.tpl')::uuid, current_setting('t.iv')::uuid,'Người PV',
  current_setting('t.int')::uuid, jsonb_build_object(current_setting('t.k1'), jsonb_build_object('score',7,'comment','rất tốt')),'advance',null,null,'nhận xét','draft');
select set_config('t.ev', (select id::text from public.candidate_evaluations where company_id=current_setting('t.c')::uuid), true);
insert into _r select 'draft_saved', status||'|'||total_score::text||'|'||coalesce(submitted_at::text,'null') from public.candidate_evaluations where id=current_setting('t.ev')::uuid;
-- Sửa nháp (thêm điểm) rồi nộp: (7*3+4*1)/4 = 6.25
update public.candidate_evaluations set answers = answers || jsonb_build_object(current_setting('t.k2'), jsonb_build_object('score',4,'comment',null)) where id=current_setting('t.ev')::uuid;
insert into _r select 'draft_updated', status||'|'||total_score::text from public.candidate_evaluations where id=current_setting('t.ev')::uuid;
update public.candidate_evaluations set status='submitted' where id=current_setting('t.ev')::uuid;
insert into _r select 'submitted', status||'|'||total_score::text||'|'||(submitted_at is not null)::text from public.candidate_evaluations where id=current_setting('t.ev')::uuid;
-- Phiếu đã nộp: người chấm (không có recruitment.edit) không sửa được, không xoá được
do $$ begin
  begin update public.candidate_evaluations set note='sửa lén' where id=current_setting('t.ev')::uuid; insert into _r values('iv_edit_submitted','ALLOWED!');
  exception when others then insert into _r values('iv_edit_submitted','blocked: '||sqlerrm); end;
end $$;
with d as (delete from public.candidate_evaluations where id=current_setting('t.ev')::uuid returning 1) insert into _r select 'iv_delete_submitted_rows', count(*)::text from d;
-- Điểm vượt thang 7 bị chặn
do $$ begin
  begin insert into public.candidate_evaluations(company_id,candidate_id,template_id,reviewer_id,answers,status) values (current_setting('t.c')::uuid, current_setting('t.cand')::uuid, current_setting('t.tpl')::uuid, current_setting('t.iv')::uuid, jsonb_build_object(current_setting('t.k1'), jsonb_build_object('score',8)),'draft'); insert into _r values('score_8_of_7','ALLOWED!');
  exception when others then insert into _r values('score_8_of_7','blocked: '||sqlerrm); end;
end $$;
-- Nháp thứ 2 của người chấm
insert into public.candidate_evaluations(company_id,candidate_id,template_id,reviewer_id,reviewer_name,answers,status)
values (current_setting('t.c')::uuid, current_setting('t.cand')::uuid, current_setting('t.tpl')::uuid, current_setting('t.iv')::uuid,'Người PV','{}'::jsonb,'draft');
select set_config('t.ev2', (select id::text from public.candidate_evaluations where status='draft' and company_id=current_setting('t.c')::uuid), true);

-- Người chấm khác: không sửa/xoá được nháp của người khác
select set_config('request.jwt.claims', json_build_object('sub',current_setting('t.iv2'),'role','authenticated')::text, true);
with u as (update public.candidate_evaluations set note='x' where id=current_setting('t.ev2')::uuid returning 1) insert into _r select 'other_update_draft_rows', count(*)::text from u;
with d as (delete from public.candidate_evaluations where id=current_setting('t.ev2')::uuid returning 1) insert into _r select 'other_delete_draft_rows', count(*)::text from d;

-- Chủ nháp xoá được nháp của mình
select set_config('request.jwt.claims', json_build_object('sub',current_setting('t.iv'),'role','authenticated')::text, true);
with d as (delete from public.candidate_evaluations where id=current_setting('t.ev2')::uuid returning 1) insert into _r select 'own_delete_draft_rows', count(*)::text from d;

-- HR (recruitment.edit) sửa được phiếu đã nộp, điểm tổng tính lại, không đổi được biểu mẫu
select set_config('request.jwt.claims', json_build_object('sub',current_setting('t.hr'),'role','authenticated')::text, true);
update public.candidate_evaluations set answers = jsonb_set(answers, array[current_setting('t.k2'),'score'], '7'::jsonb) where id=current_setting('t.ev')::uuid;
insert into _r select 'hr_edit_submitted', status||'|'||total_score::text||'|'||(reviewer_id=current_setting('t.iv')::uuid)::text from public.candidate_evaluations where id=current_setting('t.ev')::uuid;
reset role;
do $$ begin raise exception 'RESULTS %', (select json_agg(_r) from _r); end $$;
