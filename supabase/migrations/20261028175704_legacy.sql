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
    if new.status is distinct from old.status then
      v_summary := 'Cập nhật hội nhập: ' || old.status || ' → ' || new.status;
    else
      v_summary := 'Cập nhật bản ghi hội nhập';
    end if;
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