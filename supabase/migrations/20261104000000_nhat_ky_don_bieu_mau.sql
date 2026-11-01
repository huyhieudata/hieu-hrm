-- #47: ghi nhật ký duyệt/từ chối đơn, tạo/sửa loại đơn, biểu mẫu đánh giá và phiếu đánh giá.
-- Chỉ ghi tên/hành động, không ghi giá trị dữ liệu. Idempotent.
alter table public.activity_logs drop constraint if exists activity_logs_entity_type_check;
alter table public.activity_logs add constraint activity_logs_entity_type_check check (
  entity_type in ('candidate','employee','onboarding','request','request_type','evaluation_template','evaluation'));

create or replace function public.log_misc_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_action text; v_summary text; v_type text; v_company uuid := new.company_id; v_name text;
begin
  if auth.uid() is null then return new; end if;
  if tg_table_name = 'requests' then
    if tg_op <> 'UPDATE' or new.status is not distinct from old.status
       or new.status not in ('approved','rejected') then return new; end if;
    v_type := 'request';
    v_action := case new.status when 'approved' then 'request_approved' else 'request_rejected' end;
    select coalesce(rt.name, 'Đơn') into v_name from public.request_types rt where rt.id = new.request_type_id;
    v_summary := (case new.status when 'approved' then 'Duyệt ' else 'Từ chối ' end) || coalesce(v_name, 'đơn')
      || ' của ' || coalesce((select full_name from public.employees where id = new.employee_id), 'nhân sự');
  elsif tg_table_name = 'request_types' then
    v_type := 'request_type';
    v_action := case tg_op when 'INSERT' then 'request_type_created' else 'request_type_updated' end;
    v_summary := (case tg_op when 'INSERT' then 'Tạo loại đơn: ' else 'Sửa loại đơn: ' end) || new.name;
  elsif tg_table_name = 'evaluation_templates' then
    v_type := 'evaluation_template';
    v_action := case tg_op when 'INSERT' then 'evaluation_template_created' else 'evaluation_template_updated' end;
    v_summary := (case tg_op when 'INSERT' then 'Tạo biểu mẫu đánh giá: ' else 'Sửa biểu mẫu đánh giá: ' end) || new.name;
  elsif tg_table_name = 'employee_evaluations' then
    v_type := 'evaluation';
    if tg_op = 'INSERT' then v_action := 'evaluation_created'; v_summary := 'Tạo phiếu đánh giá';
    elsif new.status = 'submitted' and old.status is distinct from 'submitted' then
      v_action := 'evaluation_submitted'; v_summary := 'Chốt phiếu đánh giá';
    else return new; end if;
    v_summary := v_summary || ' cho ' || coalesce((select full_name from public.employees where id = new.employee_id), 'nhân sự');
  else
    return new;
  end if;
  insert into public.activity_logs (company_id, entity_type, entity_id, action, summary, actor_id, actor_name)
  values (v_company, v_type, new.id, v_action, v_summary, auth.uid(),
          (select full_name from public.profiles where id = auth.uid()));
  return new;
end $$;
revoke all on function public.log_misc_activity() from public, anon, authenticated;

drop trigger if exists log_misc_activity_t on public.requests;
create trigger log_misc_activity_t after update on public.requests
  for each row execute function public.log_misc_activity();
drop trigger if exists log_misc_activity_t on public.request_types;
create trigger log_misc_activity_t after insert or update on public.request_types
  for each row execute function public.log_misc_activity();
drop trigger if exists log_misc_activity_t on public.evaluation_templates;
create trigger log_misc_activity_t after insert or update on public.evaluation_templates
  for each row execute function public.log_misc_activity();
drop trigger if exists log_misc_activity_t on public.employee_evaluations;
create trigger log_misc_activity_t after insert or update on public.employee_evaluations
  for each row execute function public.log_misc_activity();
