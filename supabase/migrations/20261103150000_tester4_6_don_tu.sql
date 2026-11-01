-- Tester #4/#6: quản lý trực tiếp mặc định = trưởng bộ phận; thông báo trong app khi đơn được quyết định;
-- đơn đã duyệt không xoá được, chỉ huỷ kèm lý do (có ghi log). Idempotent.

-- 1) Quản lý trực tiếp mặc định = trưởng phòng ban (khi tạo hồ sơ chưa chọn quản lý)
create or replace function public.default_employee_manager()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_head uuid;
begin
  if new.manager_id is null and new.department_id is not null then
    select d.manager_employee_id into v_head from public.departments d
     where d.id = new.department_id and d.company_id = new.company_id;
    if v_head is not null and v_head <> new.id then
      new.manager_id := v_head;
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.default_employee_manager() from public, anon, authenticated;
drop trigger if exists employees_default_manager on public.employees;
create trigger employees_default_manager before insert on public.employees
  for each row execute function public.default_employee_manager();

-- 2) Thông báo trong app
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists user_notifications_user_idx on public.user_notifications (user_id, created_at desc);
alter table public.user_notifications enable row level security;
drop policy if exists user_notifications_select_own on public.user_notifications;
create policy user_notifications_select_own on public.user_notifications for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists user_notifications_update_own on public.user_notifications;
create policy user_notifications_update_own on public.user_notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists user_notifications_delete_own on public.user_notifications;
create policy user_notifications_delete_own on public.user_notifications for delete to authenticated
  using (user_id = (select auth.uid()));
revoke insert on public.user_notifications from anon, authenticated;

create or replace function public.notify_request_decision()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_user uuid; v_type text; v_label text;
begin
  if new.status is not distinct from old.status or new.status not in ('approved','rejected','cancelled') then
    return new;
  end if;
  select e.user_id into v_user from public.employees e where e.id = new.employee_id;
  if v_user is null or v_user = auth.uid() then return new; end if;
  select rt.name into v_type from public.request_types rt where rt.id = new.request_type_id;
  v_label := case new.status when 'approved' then 'đã được duyệt' when 'rejected' then 'bị từ chối' else 'đã bị huỷ' end;
  insert into public.user_notifications (user_id, company_id, title, body, link)
  values (v_user, new.company_id,
          'Đơn ' || coalesce(v_type, 'của bạn') || ' ' || v_label,
          to_char(new.start_date, 'DD/MM/YYYY') ||
            case when new.end_date is distinct from new.start_date then ' – ' || to_char(new.end_date, 'DD/MM/YYYY') else '' end ||
            coalesce(' · ' || nullif(new.decision_note, ''), ''),
          '/don-tu');
  return new;
end $$;
revoke execute on function public.notify_request_decision() from public, anon, authenticated;
drop trigger if exists requests_notify_decision on public.requests;
create trigger requests_notify_decision after update of status on public.requests
  for each row execute function public.notify_request_decision();

-- 3) Đơn đã duyệt: không xoá; chỉ huỷ qua RPC kèm lý do
drop policy if exists requests_delete_guard on public.requests;
create policy requests_delete_guard on public.requests as restrictive for delete to authenticated
  using (
    status <> 'approved'
    and (
      public.has_company_role(company_id, array['owner','admin','hr'])
      or (status in ('pending','cancelled') and exists (
            select 1 from public.employees e where e.id = requests.employee_id and e.user_id = (select auth.uid())))
    )
  );

create or replace function public.guard_request_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_self boolean;
begin
  if auth.uid() is null then
    return new;
  end if;
  v_self := exists (select 1 from public.employees e where e.id = coalesce(new.employee_id, old.employee_id) and e.user_id = auth.uid());

  if tg_op = 'INSERT' then
    if v_self or not public.can_manage_employee(new.employee_id) then
      new.status := 'pending';
      new.decided_by := null;
      new.decided_at := null;
    end if;
    return new;
  end if;

  if old.status = 'approved' and new.status is distinct from old.status
     and coalesce(current_setting('app.cancel_approved_request', true), '') <> '1' then
    raise exception 'Đơn đã duyệt chỉ có thể huỷ kèm lý do (nút "Huỷ đơn đã duyệt").';
  end if;

  if not v_self then
    return new;
  end if;

  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    raise exception 'Không thể tự duyệt đơn của chính mình.';
  end if;

  if coalesce(current_setting('app.cancel_approved_request', true), '') = '1' then
    return new;
  end if;

  if new.employee_id <> old.employee_id
     or new.request_type_id <> old.request_type_id
     or new.start_date <> old.start_date
     or new.end_date <> old.end_date
     or new.session is distinct from old.session
     or new.start_time is distinct from old.start_time
     or new.end_time is distinct from old.end_time
     or new.status not in ('pending', 'cancelled') then
    raise exception 'Bạn chỉ có thể huỷ đơn đang chờ duyệt.';
  end if;

  return new;
end $$;

create or replace function public.cancel_approved_request(p_request uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare r public.requests; v_name text;
begin
  select * into r from public.requests where id = p_request for update;
  if not found then raise exception 'Không tìm thấy đơn.'; end if;
  if not public.has_company_role(r.company_id, array['owner','admin','hr']) then
    raise exception 'Chỉ Chủ sở hữu/Quản trị/HR được huỷ đơn đã duyệt.';
  end if;
  if r.status <> 'approved' then raise exception 'Đơn không ở trạng thái đã duyệt.'; end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'Vui lòng nhập lý do huỷ (tối thiểu 5 ký tự).'; end if;
  perform set_config('app.cancel_approved_request', '1', true);
  update public.requests
     set status = 'cancelled',
         decision_note = 'Huỷ sau khi duyệt: ' || trim(p_reason),
         decided_by = auth.uid(), decided_at = now()
   where id = p_request;
  perform set_config('app.cancel_approved_request', '', true);
  select full_name into v_name from public.profiles where id = auth.uid();
  insert into public.activity_logs (company_id, entity_type, entity_id, action, summary, actor_id, actor_name, source)
  values (r.company_id, 'employee', r.employee_id, 'request_cancel_approved',
          'Huỷ đơn đã duyệt (' || to_char(r.start_date, 'DD/MM/YYYY') || '): ' || trim(p_reason),
          auth.uid(), v_name, 'requests');
end $$;
revoke execute on function public.cancel_approved_request(uuid, text) from public, anon;
grant execute on function public.cancel_approved_request(uuid, text) to authenticated;
