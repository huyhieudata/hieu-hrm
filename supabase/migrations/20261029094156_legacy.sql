alter table public.activity_logs drop constraint if exists activity_logs_entity_type_check;
alter table public.activity_logs
  add constraint activity_logs_entity_type_check check (entity_type in ('candidate','employee','onboarding'));

create or replace function public.log_onboarding_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor_name text;
  v_summary text;
  v_status text;
begin
  select full_name into v_actor_name from public.profiles where id = auth.uid();

  if tg_op = 'DELETE' then
    insert into public.activity_logs (company_id, entity_type, entity_id, action, summary, actor_id, actor_name)
    values (old.company_id, 'onboarding', old.id, 'deleted', 'Xoá bản ghi hội nhập của ' || old.full_name, auth.uid(), v_actor_name);
    return old;
  end if;

  if tg_op = 'INSERT' then
    insert into public.activity_logs (company_id, entity_type, entity_id, action, summary, actor_id, actor_name)
    values (new.company_id, 'onboarding', new.id, 'created', 'Tạo bản ghi hội nhập cho ' || new.full_name, auth.uid(), v_actor_name);
    return new;
  end if;

  v_summary := 'Cập nhật bản ghi hội nhập của ' || new.full_name;

  if new.status is distinct from old.status then
    v_status := case new.status
      when 'pending' then 'Chờ hội nhập'
      when 'in_progress' then 'Đang hội nhập'
      when 'completed' then 'Hoàn thành'
      when 'cancelled' then 'Đã hủy'
      else new.status
    end;
    v_summary := v_summary || ' · trạng thái: ' || v_status;
  end if;

  if new.checklist is distinct from old.checklist then
    v_summary := v_summary || ' · cập nhật checklist';
  end if;

  if new.hire_date is distinct from old.hire_date then
    v_summary := v_summary || ' · ngày nhận việc: ' || coalesce(new.hire_date::text, '—');
  end if;

  if new.expected_completion_date is distinct from old.expected_completion_date then
    v_summary := v_summary || ' · dự kiến hoàn thành: ' || coalesce(new.expected_completion_date::text, '—');
  end if;

  if new.department is distinct from old.department or new.position is distinct from old.position then
    v_summary := v_summary || ' · cập nhật vị trí/bộ phận';
  end if;

  insert into public.activity_logs (company_id, entity_type, entity_id, action, summary, actor_id, actor_name)
  values (new.company_id, 'onboarding', new.id, 'updated', v_summary, auth.uid(), v_actor_name);

  return new;
end $$;

create trigger onboarding_activity_log
after insert or update or delete on public.onboarding_records
for each row execute function public.log_onboarding_activity();