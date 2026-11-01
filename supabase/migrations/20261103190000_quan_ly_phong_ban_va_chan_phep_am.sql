-- Tester 2 (mục 4, 6):
--  * Quản lý thấy nhân viên CÙNG PHÒNG hoặc cấp dưới trực tiếp (kể cả khi phòng chưa gán trưởng phòng / hồ sơ chưa chọn quản lý).
--  * effective_manager_id: quản lý trực tiếp hiệu lực = manager_id, nếu trống -> trưởng phòng (đi ngược cây phòng ban),
--    nếu phòng chưa có trưởng -> thành viên vai trò "manager" trong cùng phòng.
--  * Bước duyệt "direct_manager" dùng effective_manager_id; bổ sung người duyệt cho đơn đang chờ bị trống.
--  * Hồ sơ mới/sửa trong phòng đã có trưởng phòng mà chưa chọn quản lý -> mặc định trưởng phòng.
--  * Chặn ở server đơn nghỉ trừ phép vượt quỹ phép còn lại.

create or replace function public.effective_manager_id(p_employee uuid)
returns uuid language sql stable security definer set search_path = public as $$
  with recursive t as (
    select id, company_id, manager_id, department_id from public.employees where id = p_employee
  ), up as (
    select d.id, d.parent_id, d.manager_employee_id, 0 as lvl
      from public.departments d join t on d.id = t.department_id
    union all
    select p.id, p.parent_id, p.manager_employee_id, up.lvl + 1
      from public.departments p join up on p.id = up.parent_id
     where up.lvl < 20
  )
  select coalesce(
    (select nullif(t.manager_id, t.id) from t),
    (select up.manager_employee_id from up, t
      where up.manager_employee_id is not null and up.manager_employee_id <> t.id
      order by up.lvl limit 1),
    (select m.id from t
       join public.employees m on m.company_id = t.company_id and m.department_id = t.department_id and m.id <> t.id
       join public.company_members cm on cm.company_id = m.company_id and cm.user_id = m.user_id
      where t.department_id is not null and cm.role = 'manager' and coalesce(cm.status, 'active') = 'active'
        and coalesce(m.status, 'active') not in ('resigned')
      order by cm.joined_at nulls last, m.created_at limit 1)
  );
$$;
revoke all on function public.effective_manager_id(uuid) from public, anon, authenticated;

create or replace function public.is_manager_of_employee(target_employee uuid)
returns boolean language sql stable security definer set search_path = public as $$
  with me as (
    select m.id, m.company_id, m.department_id
    from public.employees m
    join public.employees t on t.id = target_employee and t.company_id = m.company_id
    where m.user_id = auth.uid()
      and public.has_company_role(m.company_id, array['manager'])
  )
  select exists (
    select 1
    from me
    join public.employees t on t.id = target_employee
    where t.manager_id = me.id
       or (t.department_id is not null and t.department_id = me.department_id)
       or (t.department_id is not null and exists (
         with recursive tree as (
           select d.id from public.departments d
           where d.company_id = me.company_id and d.manager_employee_id = me.id
           union
           select c.id from public.departments c
           join tree p on c.parent_id = p.id
           where c.company_id = me.company_id
         )
         select 1 from tree where tree.id = t.department_id
       ))
  );
$$;
revoke all on function public.is_manager_of_employee(uuid) from public, anon;
grant execute on function public.is_manager_of_employee(uuid) to authenticated;

-- Mặc định quản lý trực tiếp = trưởng phòng khi tạo/sửa hồ sơ (chỉ khi để trống).
create or replace function public.default_employee_manager()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_head uuid;
begin
  if new.manager_id is null and new.department_id is not null
     then
    select manager_employee_id into v_head from public.departments where id = new.department_id;
    if v_head is not null and v_head <> new.id then
      new.manager_id := v_head;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.default_employee_manager() from public, anon, authenticated;
drop trigger if exists zz_employees_default_manager on public.employees;
create trigger zz_employees_default_manager before insert or update of department_id, manager_id on public.employees
  for each row execute function public.default_employee_manager();

-- Bước duyệt: quản lý trực tiếp hiệu lực.
create or replace function public.build_request_approvals()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  step record;
  resolved uuid;
  v_workflow uuid;
  v_department text;
  v_position text;
begin
  if new.status <> 'pending' then
    return new;
  end if;

  select department, position into v_department, v_position
  from public.employees where id = new.employee_id;

  select w.id into v_workflow
  from public.approval_workflows w
  join public.approval_workflow_types t on t.workflow_id = w.id
  where w.company_id = new.company_id
    and w.active
    and t.request_type_id = new.request_type_id
    and (w.effective_from is null or w.effective_from <= new.start_date)
    and (w.effective_to is null or w.effective_to >= new.start_date)
    and (
      w.scope_type = 'company'
      or (w.scope_type = 'department' and w.scope_value = v_department)
      or (w.scope_type = 'position' and w.scope_value = v_position)
      or (w.scope_type = 'employee' and w.scope_value = new.employee_id::text)
    )
  order by case w.scope_type when 'employee' then 3 when 'position' then 2 when 'department' then 1 else 0 end desc,
           w.created_at desc
  limit 1;

  for step in
    select step_order, name, approver_type, approver_employee_id, sla_hours
    from (
      select step_order, name, approver_type, approver_employee_id, sla_hours
      from public.approval_workflow_steps
      where v_workflow is not null and workflow_id = v_workflow
      union all
      select step_order, name, approver_type, approver_employee_id, sla_hours
      from public.request_approval_steps
      where v_workflow is null and request_type_id = new.request_type_id
    ) combined
    order by step_order
  loop
    resolved := null;
    if step.approver_type = 'direct_manager' then
      resolved := public.effective_manager_id(new.employee_id);
    elsif step.approver_type = 'manager_of_manager' then
      resolved := public.effective_manager_id(public.effective_manager_id(new.employee_id));
    else
      resolved := step.approver_employee_id;
    end if;
    if resolved = new.employee_id then
      resolved := null;
    end if;
    insert into public.request_approvals
      (company_id, request_id, step_order, name, approver_type, approver_employee_id, sla_hours, due_at, status)
    values
      (new.company_id, new.id, step.step_order, step.name, step.approver_type, resolved, step.sla_hours,
       now() + make_interval(hours => step.sla_hours), 'pending');
  end loop;
  return new;
end $$;

-- Đơn đang chờ có bước quản lý trực tiếp chưa có người duyệt -> gán theo quy tắc mới (idempotent).
update public.request_approvals a
   set approver_employee_id = x.mgr
  from (
    select a2.id, case a2.approver_type
             when 'direct_manager' then public.effective_manager_id(r.employee_id)
             else public.effective_manager_id(public.effective_manager_id(r.employee_id)) end as mgr,
           r.employee_id
      from public.request_approvals a2 join public.requests r on r.id = a2.request_id
     where a2.status = 'pending' and r.status = 'pending' and a2.approver_employee_id is null
       and a2.approver_type in ('direct_manager', 'manager_of_manager')
  ) x
 where a.id = x.id and x.mgr is not null and x.mgr <> x.employee_id;

-- Quỹ phép còn lại (cùng công thức src/lib/leave.ts summarizeLeave). null nếu chưa có chính sách năm đó.
create or replace function public.leave_year_base(p_employee uuid, p_policy uuid, p_year int)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  pol record; e record; v_total numeric; v_auto numeric := 0; v_hm int; m int;
begin
  select * into pol from public.leave_policies where id = p_policy;
  if not found then return 0; end if;
  select hire_date, resignation_date into e from public.employees where id = p_employee;
  if exists (select 1 from public.leave_policy_items i where i.policy_id = pol.id
              and not (pol.auto_annual_leave and i.name ~* 'phép\s*năm|phep\s*nam')) then
    select sum(days) into v_total from public.leave_policy_items i where i.policy_id = pol.id
       and not (pol.auto_annual_leave and i.name ~* 'phép\s*năm|phep\s*nam');
  elsif pol.auto_annual_leave then v_total := 0;
  else v_total := pol.days_per_year;
  end if;
  v_total := round(coalesce(v_total, 0), 1);
  if pol.prorate_by_hire_date and e.hire_date is not null then
    if extract(year from e.hire_date) > p_year then v_total := 0;
    elsif extract(year from e.hire_date) = p_year then
      v_hm := extract(month from e.hire_date);
      v_total := round(v_total * (12 - v_hm + 1) / 12.0, 1);
    end if;
  end if;
  if pol.auto_annual_leave then
    for m in 1..12 loop
      if e.hire_date is not null and e.hire_date > (make_date(p_year, m, 1) + interval '1 month - 1 day')::date then continue; end if;
      if e.resignation_date is not null and e.resignation_date < make_date(p_year, m, 1) then continue; end if;
      if exists (select 1 from public.employee_contracts c where c.employee_id = p_employee
                  and c.contract_type in ('fixed_term', 'indefinite')
                  and (c.start_date is null or c.start_date <= (make_date(p_year, m, 1) + interval '1 month - 1 day')::date)
                  and (c.end_date is null or c.end_date >= make_date(p_year, m, 1))) then
        v_auto := v_auto + 1;
      end if;
    end loop;
  end if;
  return round(v_total + v_auto, 1);
end $$;
revoke all on function public.leave_year_base(uuid, uuid, int) from public, anon, authenticated;

create or replace function public.leave_used_days(p_employee uuid, p_year int, p_exclude uuid default null)
returns numeric language sql stable security definer set search_path = public as $$
  select round(coalesce(sum(r.leave_days), 0), 1)
    from public.requests r join public.request_types t on t.id = r.request_type_id
   where r.employee_id = p_employee and r.status = 'approved' and t.deduct_leave
     and extract(year from r.start_date) = p_year
     and (p_exclude is null or r.id <> p_exclude);
$$;
revoke all on function public.leave_used_days(uuid, int, uuid) from public, anon, authenticated;

create or replace function public.leave_remaining(p_employee uuid, p_year int, p_exclude uuid default null)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  v_company uuid; pol uuid; prev record; v_base numeric; v_carry numeric := 0; v_adj numeric;
begin
  select company_id into v_company from public.employees where id = p_employee;
  select id into pol from public.leave_policies where company_id = v_company and year = p_year order by created_at limit 1;
  if pol is null then return null; end if;
  v_base := public.leave_year_base(p_employee, pol, p_year);
  select id, carry_over_max into prev from public.leave_policies where company_id = v_company and year = p_year - 1 order by created_at limit 1;
  if prev.id is not null then
    v_carry := least(greatest(round(public.leave_year_base(p_employee, prev.id, p_year - 1)
                 - public.leave_used_days(p_employee, p_year - 1), 1), 0),
                 coalesce((select carry_over_max from public.leave_policies where id = pol), 0));
  end if;
  select coalesce(adjustment_days, 0) into v_adj from public.employee_leave_balances where employee_id = p_employee and year = p_year;
  return round(v_base + v_carry + coalesce(v_adj, 0) - public.leave_used_days(p_employee, p_year, p_exclude), 1);
end $$;
revoke all on function public.leave_remaining(uuid, int, uuid) from public, anon, authenticated;

create or replace function public.guard_leave_balance()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_deduct boolean; v_remaining numeric;
begin
  if new.status not in ('pending', 'approved') then return new; end if;
  if tg_op = 'UPDATE' and new.status = old.status and new.leave_days is not distinct from old.leave_days
     and new.start_date = old.start_date and new.request_type_id = old.request_type_id then
    return new;
  end if;
  select deduct_leave into v_deduct from public.request_types where id = new.request_type_id;
  if not coalesce(v_deduct, false) then return new; end if;
  v_remaining := public.leave_remaining(new.employee_id, extract(year from new.start_date)::int, new.id);
  if v_remaining is not null and coalesce(new.leave_days, 0) > v_remaining then
    raise exception 'Số ngày nghỉ (%) vượt quỹ phép còn lại (% ngày). Hãy giảm số ngày hoặc chọn loại nghỉ không trừ phép (vd. nghỉ không lương).',
      new.leave_days, v_remaining using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.guard_leave_balance() from public, anon, authenticated;
drop trigger if exists guard_leave_balance on public.requests;
create trigger guard_leave_balance before insert or update of status, leave_days, start_date, request_type_id on public.requests
  for each row execute function public.guard_leave_balance();
