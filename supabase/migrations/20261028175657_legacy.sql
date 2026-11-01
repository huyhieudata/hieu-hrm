create or replace function public.log_candidate_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_company uuid; v_action text; v_summary text; v_actor uuid; v_name text;
begin
  if tg_op = 'DELETE' then
    v_id := old.id; v_company := old.company_id; v_action := 'deleted'; v_summary := 'Xoá hồ sơ ứng viên';
  elsif tg_op = 'INSERT' then
    v_id := new.id; v_company := new.company_id; v_action := 'created'; v_summary := 'Tạo hồ sơ ứng viên';
  else
    v_id := new.id; v_company := new.company_id;
    if new.status is distinct from old.status then
      v_action := 'status_changed';
      v_summary := 'Chuyển trạng thái: ' || public.candidate_status_label(old.status) || ' → ' || public.candidate_status_label(new.status);
    else
      v_action := 'updated'; v_summary := 'Cập nhật thông tin ứng viên';
    end if;
  end if;

  v_actor := auth.uid();
  select full_name into v_name from public.profiles where id = v_actor;
  insert into public.activity_logs (company_id, entity_type, entity_id, action, summary, actor_id, actor_name)
  values (v_company, 'candidate', v_id, v_action, v_summary, v_actor, v_name);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger log_candidate_activity_t
  after insert or update or delete on public.candidates
  for each row execute function public.log_candidate_activity();

create or replace function public.log_employee_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_company uuid; v_action text; v_summary text; v_actor uuid; v_name text;
begin
  if tg_op = 'DELETE' then
    v_id := old.id; v_company := old.company_id; v_action := 'deleted'; v_summary := 'Xoá hồ sơ nhân viên';
  elsif tg_op = 'INSERT' then
    v_id := new.id; v_company := new.company_id; v_action := 'created'; v_summary := 'Tạo hồ sơ nhân viên';
  else
    v_id := new.id; v_company := new.company_id;
    if new.status is distinct from old.status then
      v_action := 'status_changed';
      v_summary := 'Chuyển trạng thái: ' || public.employee_status_label(old.status) || ' → ' || public.employee_status_label(new.status);
    else
      v_action := 'updated'; v_summary := 'Cập nhật hồ sơ nhân viên';
    end if;
  end if;

  v_actor := auth.uid();
  select full_name into v_name from public.profiles where id = v_actor;
  insert into public.activity_logs (company_id, entity_type, entity_id, action, summary, actor_id, actor_name)
  values (v_company, 'employee', v_id, v_action, v_summary, v_actor, v_name);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger log_employee_activity_t
  after insert or update or delete on public.employees
  for each row execute function public.log_employee_activity();

create or replace function public.log_candidate_child_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_candidate uuid; v_company uuid; v_label text; v_action text; v_summary text; v_actor uuid; v_name text;
begin
  v_label := case tg_table_name
    when 'candidate_offers' then 'offer'
    when 'candidate_interviews' then 'lịch phỏng vấn'
    when 'candidate_evaluations' then 'đánh giá'
    else tg_table_name end;

  if tg_op = 'DELETE' then
    v_candidate := old.candidate_id; v_company := old.company_id;
    v_action := 'deleted'; v_summary := 'Xoá ' || v_label;
  elsif tg_op = 'INSERT' then
    v_candidate := new.candidate_id; v_company := new.company_id;
    v_action := 'created'; v_summary := 'Thêm ' || v_label;
  else
    v_candidate := new.candidate_id; v_company := new.company_id;
    v_action := 'updated'; v_summary := 'Cập nhật ' || v_label;
  end if;

  v_actor := auth.uid();
  select full_name into v_name from public.profiles where id = v_actor;
  insert into public.activity_logs (company_id, entity_type, entity_id, action, summary, actor_id, actor_name)
  values (v_company, 'candidate', v_candidate, v_action, v_summary, v_actor, v_name);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger log_offer_activity_t after insert or update or delete on public.candidate_offers
  for each row execute function public.log_candidate_child_activity();
create trigger log_interview_activity_t after insert or update or delete on public.candidate_interviews
  for each row execute function public.log_candidate_child_activity();
create trigger log_evaluation_activity_t after insert or update or delete on public.candidate_evaluations
  for each row execute function public.log_candidate_child_activity();

create or replace function public.log_onboarding_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_employee uuid; v_candidate uuid; v_company uuid; v_action text; v_summary text;
  v_actor uuid; v_name text; v_entity_type text; v_entity_id uuid;
begin
  if tg_op = 'DELETE' then
    v_employee := old.employee_id; v_candidate := old.candidate_id; v_company := old.company_id;
    v_action := 'deleted'; v_summary := 'Xoá bản ghi hội nhập';
  elsif tg_op = 'INSERT' then
    v_employee := new.employee_id; v_candidate := new.candidate_id; v_company := new.company_id;
    v_action := 'created'; v_summary := 'Tạo bản ghi hội nhập';
  else
    v_employee := new.employee_id; v_candidate := new.candidate_id; v_company := new.company_id;
    v_action := 'updated';
    v_summary := case when new.status is distinct from old.status
      then 'Cập nhật hội nhập: %s'
      else 'Cập nhật bản ghi hội nhập' end;
  end if;

  if v_employee is not null then
    v_entity_type := 'employee'; v_entity_id := v_employee;
  elsif v_candidate is not null then
    v_entity_type := 'candidate'; v_entity_id := v_candidate;
  else
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  v_actor := auth.uid();
  select full_name into v_name from public.profiles where id = v_actor;
  insert into public.activity_logs (company_id, entity_type, entity_id, action, summary, actor_id, actor_name)
  values (v_company, v_entity_type, v_entity_id, v_action, v_summary, v_actor, v_name);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger log_onboarding_activity_t after insert or update or delete on public.onboarding_records
  for each row execute function public.log_onboarding_activity();