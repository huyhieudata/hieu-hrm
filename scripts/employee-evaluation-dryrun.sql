-- Dry-run phiếu đánh giá nhân viên (thử việc/định kỳ): chạy sau migration 20261101130000.
-- Luôn rollback bằng raise exception "RESULTS ..." ở cuối. Không để lại dữ liệu.
begin;
create temp table _r(k text, v text) on commit drop;
grant all on _r to authenticated, anon;
do $t$
declare
  c uuid := gen_random_uuid();
  u_hr uuid := gen_random_uuid(); u_mg uuid := gen_random_uuid(); u_e1 uuid := gen_random_uuid(); u_e2 uuid := gen_random_uuid();
  mg uuid; e1 uuid; e2 uuid; tpl uuid; tpl_iv uuid; k1 uuid; k2 uuid;
begin
  insert into auth.users(id, email, aud, role) values
    (u_hr,'t_hr_'||u_hr||'@x.test','authenticated','authenticated'),
    (u_mg,'t_mg_'||u_mg||'@x.test','authenticated','authenticated'),
    (u_e1,'t_e1_'||u_e1||'@x.test','authenticated','authenticated'),
    (u_e2,'t_e2_'||u_e2||'@x.test','authenticated','authenticated');
  insert into public.companies(id,name) values (c,'TEST EMP EVAL');
  insert into public.company_members(company_id,user_id,role) values
    (c,u_hr,'hr'),(c,u_mg,'manager'),(c,u_e1,'employee'),(c,u_e2,'employee');
  insert into public.employees(company_id,code,full_name,status,user_id) values (c,'MG','Quản lý','active',u_mg) returning id into mg;
  insert into public.employees(company_id,code,full_name,status,user_id,manager_id) values (c,'E1','NV1','active',u_e1,mg) returning id into e1;
  insert into public.employees(company_id,code,full_name,status,user_id) values (c,'E2','NV2','active',u_e2) returning id into e2;
  insert into public.evaluation_templates(company_id,name,kind,scale_max) values (c,'Thử việc','probation',5) returning id into tpl;
  insert into public.evaluation_templates(company_id,name,kind,scale_max) values (c,'PV','interview',5) returning id into tpl_iv;
  insert into public.evaluation_criteria(template_id,company_id,name,weight,sort_order) values (tpl,c,'Kết quả',3,1) returning id into k1;
  insert into public.evaluation_criteria(template_id,company_id,name,weight,sort_order) values (tpl,c,'Tác phong',1,2) returning id into k2;
  perform set_config('t.c', c::text, true);
  perform set_config('t.hr', u_hr::text, true); perform set_config('t.mg', u_mg::text, true);
  perform set_config('t.u1', u_e1::text, true); perform set_config('t.u2', u_e2::text, true);
  perform set_config('t.e1', e1::text, true); perform set_config('t.e2', e2::text, true);
  perform set_config('t.tpl', tpl::text, true); perform set_config('t.tpliv', tpl_iv::text, true);
  perform set_config('t.k1', k1::text, true); perform set_config('t.k2', k2::text, true);
end $t$;

set local role authenticated;
create or replace function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true);
$$;
create or replace function pg_temp.try(label text, q text) returns void language plpgsql as $$
begin
  execute q;
  insert into _r values (label, 'ok');
exception when others then
  insert into _r values (label, 'ERR: ' || sqlerrm);
end $$;

-- 1. Quản lý trực tiếp tạo nháp cho NV1 (đã chấm 1 tiêu chí)
select pg_temp.as_user(current_setting('t.mg'));
select pg_temp.try('01_mg_insert_draft_e1 (ok)', format(
  'insert into public.employee_evaluations(company_id,employee_id,template_id,answers,period_label) values (%L,%L,%L,%L,%L)',
  current_setting('t.c'), current_setting('t.e1'), current_setting('t.tpl'),
  json_build_object(current_setting('t.k1'), json_build_object('score',4))::text, 'Thử việc T10'));
insert into _r select '02_kind_from_template (probation)', kind from public.employee_evaluations where employee_id=current_setting('t.e1')::uuid;
-- 3. Quản lý không tạo được cho NV2 (không quản lý)
select pg_temp.try('03_mg_insert_e2 (ERR rls)', format(
  'insert into public.employee_evaluations(company_id,employee_id,template_id) values (%L,%L,%L)',
  current_setting('t.c'), current_setting('t.e2'), current_setting('t.tpl')));
-- 4. Nộp khi thiếu tiêu chí -> lỗi
select pg_temp.try('04_submit_missing (ERR)', format(
  'update public.employee_evaluations set status=%L where employee_id=%L', 'submitted', current_setting('t.e1')));
-- 5. Điểm ngoài thang -> lỗi
select pg_temp.try('05_score_6 (ERR)', format(
  'update public.employee_evaluations set answers=%L where employee_id=%L',
  json_build_object(current_setting('t.k1'), json_build_object('score',6))::text, current_setting('t.e1')));
-- 6. Đề xuất sai loại -> lỗi
select pg_temp.try('06_bad_recommendation (ERR)', format(
  'update public.employee_evaluations set recommendation=%L where employee_id=%L', 'excellent', current_setting('t.e1')));
-- 7. NV1 chưa thấy phiếu nháp
select pg_temp.as_user(current_setting('t.u1'));
insert into _r select '07_e1_sees_draft (0)', count(*)::text from public.employee_evaluations;
-- 8. Quản lý chấm đủ, đề xuất đạt, nộp -> điểm (4*3+2)/4 = 3.5
select pg_temp.as_user(current_setting('t.mg'));
select pg_temp.try('08_mg_submit (ok)', format(
  'update public.employee_evaluations set answers=%L, recommendation=%L, status=%L where employee_id=%L',
  json_build_object(current_setting('t.k1'), json_build_object('score',4), current_setting('t.k2'), json_build_object('score',2))::text,
  'pass','submitted', current_setting('t.e1')));
insert into _r select '09_total (3.50)', total_score::text from public.employee_evaluations where employee_id=current_setting('t.e1')::uuid;
-- 10. Quản lý không sửa/xoá được phiếu đã nộp
select pg_temp.try('10_mg_edit_submitted (0 rows/ERR)', format(
  'update public.employee_evaluations set overall_comment=%L where employee_id=%L', 'x', current_setting('t.e1')));
insert into _r select '10b_comment_unchanged (null)', coalesce(overall_comment,'null') from public.employee_evaluations where employee_id=current_setting('t.e1')::uuid;
select pg_temp.try('11_mg_delete_submitted', format('delete from public.employee_evaluations where employee_id=%L', current_setting('t.e1')));
insert into _r select '11b_still_exists (1)', count(*)::text from public.employee_evaluations where employee_id=current_setting('t.e1')::uuid;
-- 12. NV1 thấy phiếu đã nộp của mình; NV2 không thấy
select pg_temp.as_user(current_setting('t.u1'));
insert into _r select '12_e1_sees_submitted (1)', count(*)::text from public.employee_evaluations;
select pg_temp.try('12b_e1_edit_own (0 rows)', format(
  'update public.employee_evaluations set overall_comment=%L', 'hack'));
select pg_temp.as_user(current_setting('t.u2'));
insert into _r select '13_e2_sees (0)', count(*)::text from public.employee_evaluations;
-- 14. Nhân viên thường không tạo được phiếu
select pg_temp.try('14_e2_insert (ERR rls)', format(
  'insert into public.employee_evaluations(company_id,employee_id,template_id) values (%L,%L,%L)',
  current_setting('t.c'), current_setting('t.e2'), current_setting('t.tpl')));
-- 15. HR: tạo cho NV2, dùng biểu mẫu phỏng vấn bị chặn, sửa phiếu đã nộp được, điểm tính lại
select pg_temp.as_user(current_setting('t.hr'));
select pg_temp.try('15_hr_interview_tpl (ERR)', format(
  'insert into public.employee_evaluations(company_id,employee_id,template_id) values (%L,%L,%L)',
  current_setting('t.c'), current_setting('t.e2'), current_setting('t.tpliv')));
select pg_temp.try('16_hr_insert_e2 (ok)', format(
  'insert into public.employee_evaluations(company_id,employee_id,template_id) values (%L,%L,%L)',
  current_setting('t.c'), current_setting('t.e2'), current_setting('t.tpl')));
select pg_temp.try('17_hr_edit_submitted (ok)', format(
  'update public.employee_evaluations set answers=%L where employee_id=%L',
  json_build_object(current_setting('t.k1'), json_build_object('score',5), current_setting('t.k2'), json_build_object('score',5))::text,
  current_setting('t.e1')));
insert into _r select '17b_total (5.00)', total_score::text from public.employee_evaluations where employee_id=current_setting('t.e1')::uuid;
-- 18. Biểu mẫu đã dùng -> không sửa tiêu chí
select pg_temp.try('18_edit_criteria_in_use (ERR)', format(
  'update public.evaluation_criteria set weight=2 where id=%L', current_setting('t.k1')));
-- 19. Đổi employee_id bị bỏ qua
select pg_temp.try('19_hr_change_employee', format(
  'update public.employee_evaluations set employee_id=%L where employee_id=%L', current_setting('t.e2'), current_setting('t.e1')));
insert into _r select '19b_e2_count (1)', count(*)::text from public.employee_evaluations where employee_id=current_setting('t.e2')::uuid;
-- 20. anon không đọc được
reset role;
set local role anon;
select pg_temp.try('20_anon_select (ERR)', 'select count(*) from public.employee_evaluations');
reset role;
do $$ begin raise exception 'RESULTS %', (select json_agg(_r) from _r); end $$;
