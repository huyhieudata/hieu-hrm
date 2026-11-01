-- Widget trang chủ: cấu hình theo công ty (desktop & mobile nhân viên) + RPC tổng hợp dữ liệu.
-- Đọc cấu hình: mọi thành viên công ty. Ghi: chỉ owner/admin/hr qua RPC SECURITY DEFINER.

create table if not exists public.home_widget_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  surface text not null check (surface in ('desktop', 'mobile')),
  widget_key text not null check (widget_key ~ '^[a-z_]{2,40}$'),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  size text not null default 'md' check (size in ('sm', 'md', 'lg')),
  audiences text[] not null default array['admin','manager','employee']
    check (audiences <@ array['admin','manager','employee']::text[]),
  updated_by uuid,
  updated_at timestamptz not null default now(),
  unique (company_id, surface, widget_key)
);

create index if not exists home_widget_settings_company_idx on public.home_widget_settings(company_id, surface, sort_order);

alter table public.home_widget_settings enable row level security;

drop policy if exists home_widget_settings_select on public.home_widget_settings;
create policy home_widget_settings_select on public.home_widget_settings
  for select to authenticated using (public.is_company_member(company_id));
-- Không có policy insert/update/delete: mọi thay đổi đi qua RPC bên dưới.

revoke all on public.home_widget_settings from anon;
grant select on public.home_widget_settings to authenticated;

create or replace function public.save_home_widgets(p_company uuid, p_surface text, p_items jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
  v_idx integer := 0;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập.'; end if;
  if not public.has_company_role(p_company, array['owner','admin','hr']) then
    raise exception 'Chỉ quản trị viên hoặc HR được cài đặt widget trang chủ.';
  end if;
  if p_surface not in ('desktop', 'mobile') then raise exception 'Giao diện không hợp lệ.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 40 then
    raise exception 'Danh sách widget không hợp lệ.';
  end if;

  delete from public.home_widget_settings where company_id = p_company and surface = p_surface;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_idx := v_idx + 1;
    insert into public.home_widget_settings(company_id, surface, widget_key, enabled, sort_order, size, audiences, updated_by)
    values (
      p_company, p_surface,
      v_item->>'widget_key',
      coalesce((v_item->>'enabled')::boolean, true),
      v_idx,
      coalesce(v_item->>'size', 'md'),
      coalesce(array(select jsonb_array_elements_text(v_item->'audiences')), array['admin','manager','employee']),
      auth.uid()
    );
  end loop;
end;
$$;

create or replace function public.reset_home_widgets(p_company uuid, p_surface text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập.'; end if;
  if not public.has_company_role(p_company, array['owner','admin','hr']) then
    raise exception 'Chỉ quản trị viên hoặc HR được cài đặt widget trang chủ.';
  end if;
  delete from public.home_widget_settings
  where company_id = p_company and (p_surface is null or surface = p_surface);
end;
$$;

-- Tổng hợp dữ liệu cho mọi widget trong 1 lần gọi, phạm vi theo vai trò:
--   owner/admin/hr: toàn công ty; manager: bản thân + nhân viên phòng ban/báo cáo trực tiếp;
--   employee: chỉ dữ liệu của chính mình (sinh nhật trong tháng hiển thị tên + ngày cho cả công ty).
create or replace function public.home_dashboard_summary(p_company uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_month_start date := date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh'))::date;
  v_month_end date := (date_trunc('month', (now() at time zone 'Asia/Ho_Chi_Minh')) + interval '1 month - 1 day')::date;
  v_role text;
  v_me uuid;
  v_scope uuid[];
  v_active uuid[];
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_company_member(p_company) then
    raise exception 'Bạn không thuộc công ty này.';
  end if;

  v_role := case
    when public.has_company_role(p_company, array['owner','admin','hr']) then 'admin'
    when public.has_company_role(p_company, array['manager']) then 'manager'
    else 'employee' end;
  select id into v_me from public.employees where company_id = p_company and user_id = auth.uid() limit 1;

  select coalesce(array_agg(e.id), '{}') into v_scope
  from public.employees e
  where e.company_id = p_company
    and (v_role = 'admin'
      or e.id = v_me
      or (v_role = 'manager' and public.is_manager_of_employee(e.id)));

  select coalesce(array_agg(e.id), '{}') into v_active
  from public.employees e
  where e.id = any(v_scope) and coalesce(e.status, '') <> 'resigned'
    and (e.resignation_date is null or e.resignation_date > v_today);

  with today_rec as (
    select r.employee_id, bool_or(r.check_in is not null) present,
           bool_or(r.status = 'late') late, bool_or(r.check_in is not null and r.check_out is null) open
    from public.attendance_records r
    where r.company_id = p_company and r.work_date = v_today and r.employee_id = any(v_active)
    group by r.employee_id
  ), leave_today as (
    select distinct q.employee_id from public.requests q
    where q.company_id = p_company and q.status = 'approved' and q.employee_id = any(v_active)
      and v_today between q.start_date and coalesce(q.end_date, q.start_date)
  ), rejected as (
    select count(*) total, count(*) filter (where l.reason ilike '%ngoài vùng%') out_of_zone,
           count(distinct l.employee_id) people
    from public.attendance_punch_logs l
    where l.company_id = p_company and l.employee_id = any(v_scope)
      and (l.created_at at time zone 'Asia/Ho_Chi_Minh')::date = v_today
  ), month_rec as (
    select count(distinct (r.employee_id, r.work_date)) filter (where r.check_in is not null) worked,
           count(*) filter (where r.status = 'late') late,
           count(*) filter (where r.status = 'early_leave') early,
           count(*) filter (where r.status = 'absent') absent
    from public.attendance_records r
    where r.company_id = p_company and r.employee_id = any(v_active)
      and r.work_date between v_month_start and v_today
  )
  select jsonb_build_object(
    'role', v_role,
    'today', v_today,
    'scope_size', coalesce(array_length(v_active, 1), 0),
    'attendance_today', (
      select jsonb_build_object(
        'total', coalesce(array_length(v_active, 1), 0),
        'present', (select count(*) from today_rec where present),
        'late', (select count(*) from today_rec where late),
        'open', (select count(*) from today_rec where open),
        'on_leave', (select count(*) from leave_today),
        'absent', greatest(coalesce(array_length(v_active, 1), 0)
                  - (select count(*) from today_rec where present)
                  - (select count(*) from leave_today lt where not exists (select 1 from today_rec t where t.employee_id = lt.employee_id and t.present)), 0),
        'rejected', (select total from rejected),
        'rejected_out_of_zone', (select out_of_zone from rejected),
        'rejected_people', (select people from rejected),
        'mine', case when v_me is null then null else (
          select jsonb_build_object('checked_in', bool_or(r.check_in is not null), 'open', bool_or(r.check_in is not null and r.check_out is null))
          from public.attendance_records r where r.employee_id = v_me and r.work_date = v_today) end
      )),
    'month_overview', (
      select jsonb_build_object(
        'month_start', v_month_start, 'month_end', v_month_end,
        'worked_days', m.worked, 'late', m.late, 'early_leave', m.early, 'absent', m.absent,
        'leave_days', (select coalesce(sum(q.leave_days), 0) from public.requests q
                       where q.company_id = p_company and q.status = 'approved' and q.employee_id = any(v_active)
                         and q.start_date between v_month_start and v_month_end),
        'workdays_elapsed', (select count(*) from generate_series(v_month_start, v_today, interval '1 day') d
                             where extract(isodow from d) < 7))
      from month_rec m),
    'requests', jsonb_build_object(
      'pending', (select count(*) from public.requests q where q.company_id = p_company and q.status = 'pending' and q.employee_id = any(v_scope)),
      'my_pending', (select count(*) from public.requests q where q.employee_id = v_me and q.status = 'pending'),
      'items', coalesce((select jsonb_agg(x) from (
        select q.id, e.full_name as employee_name, t.name as type_name, q.start_date, q.end_date, q.status, q.created_at
        from public.requests q
        join public.employees e on e.id = q.employee_id
        left join public.request_types t on t.id = q.request_type_id
        where q.company_id = p_company and q.employee_id = any(v_scope)
          and (v_role <> 'employee' and q.status = 'pending' or v_role = 'employee')
        order by q.created_at desc limit 5) x), '[]'::jsonb)),
    'birthdays', coalesce((select jsonb_agg(x order by x.day) from (
      select e.id, e.full_name as name, e.department, extract(day from e.date_of_birth)::int as day,
             extract(day from e.date_of_birth)::int = extract(day from v_today)::int as is_today
      from public.employees e
      where e.company_id = p_company and coalesce(e.status, '') <> 'resigned'
        and (e.resignation_date is null or e.resignation_date > v_today)
        and extract(month from e.date_of_birth) = extract(month from v_today)
      limit 30) x), '[]'::jsonb),
    'people_changes', case when v_role = 'employee' then null else jsonb_build_object(
      'new_hires', coalesce((select jsonb_agg(x) from (
        select e.id, e.full_name as name, e.department, e.hire_date from public.employees e
        where e.id = any(v_active) and e.hire_date between v_today - 30 and v_today
        order by e.hire_date desc limit 6) x), '[]'::jsonb),
      'probation_ending', coalesce((select jsonb_agg(x) from (
        select e.id, e.full_name as name, e.department, e.probation_end_date from public.employees e
        where e.id = any(v_active) and e.probation_end_date between v_today and v_today + 30
        order by e.probation_end_date limit 6) x), '[]'::jsonb)) end,
    'contracts_expiring', case when v_role = 'employee' then null else coalesce((select jsonb_agg(x) from (
      select c.id, c.employee_id, e.full_name as name, c.contract_no, c.end_date from public.employee_contracts c
      join public.employees e on e.id = c.employee_id
      where c.company_id = p_company and c.employee_id = any(v_active)
        and coalesce(c.status, 'active') = 'active' and c.end_date between v_today and v_today + 45
      order by c.end_date limit 6) x), '[]'::jsonb) end,
    'interviews', case when not public.can_view_recruitment(p_company) then null else coalesce((select jsonb_agg(x) from (
      select i.id, i.candidate_id, c.full_name as candidate_name, c.position_applied, i.scheduled_at, i.mode, i.interviewer
      from public.candidate_interviews i join public.candidates c on c.id = i.candidate_id
      where i.company_id = p_company and i.status = 'scheduled' and i.scheduled_at >= now()
      order by i.scheduled_at limit 5) x), '[]'::jsonb) end,
    'departments', case when v_role = 'employee' then null else coalesce((select jsonb_agg(x order by x.count desc) from (
      select coalesce(nullif(btrim(e.department), ''), 'Chưa xếp phòng ban') as name, count(*)::int as count
      from public.employees e where e.id = any(v_active) group by 1) x), '[]'::jsonb) end
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.save_home_widgets(uuid, text, jsonb) from public, anon;
revoke all on function public.reset_home_widgets(uuid, text) from public, anon;
revoke all on function public.home_dashboard_summary(uuid) from public, anon;
grant execute on function public.save_home_widgets(uuid, text, jsonb) to authenticated;
grant execute on function public.reset_home_widgets(uuid, text) to authenticated;
grant execute on function public.home_dashboard_summary(uuid) to authenticated;
