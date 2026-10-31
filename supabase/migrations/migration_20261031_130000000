-- Bảo mật (rà lỗi 31/10/2026): #2 cột nhạy cảm nhân viên, #4 policy lương, #8 lời mời,
-- #9 form ứng viên, #10 khớp hồ sơ admin workspace, #11 tra user theo email.

-- #2: CCCD / ngân hàng / MST chỉ owner, admin, hr hoặc chính chủ được xem.
-- RLS không ẩn được cột, nên thu hồi quyền SELECT cả bảng và cấp lại theo từng cột (trừ cột nhạy cảm).
-- Client đọc các cột nhạy cảm qua RPC employee_sensitive_fields bên dưới.
-- Lưu ý: khi thêm cột mới vào employees cần grant select (cột_mới) cho authenticated.
revoke select on public.employees from anon, authenticated;
do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'employees'
    and column_name not in (
      'national_id', 'national_id_issue_date', 'national_id_issue_place',
      'bank_name', 'bank_account', 'bank_branch', 'tax_code'
    );
  execute format('grant select (%s) on public.employees to authenticated', cols);
end $$;

create or replace function public.employee_sensitive_fields(p_company uuid, p_employee uuid default null)
returns table (
  employee_id uuid,
  national_id text,
  national_id_issue_date date,
  national_id_issue_place text,
  bank_name text,
  bank_account text,
  bank_branch text,
  tax_code text
) language sql stable security definer set search_path = public as $$
  select e.id, e.national_id, e.national_id_issue_date, e.national_id_issue_place,
         e.bank_name, e.bank_account, e.bank_branch, e.tax_code
  from public.employees e
  where e.company_id = p_company
    and (p_employee is null or e.id = p_employee)
    and (
      e.user_id = auth.uid()
      or public.has_company_role(p_company, array['owner','admin','hr'])
    );
$$;
revoke all on function public.employee_sensitive_fields(uuid, uuid) from public, anon;
grant execute on function public.employee_sensitive_fields(uuid, uuid) to authenticated;

-- #4: tắt policy FOR ALL theo employees.edit trên bảng lương (giống bảo hiểm).
alter policy "employee_salary_grant_all" on public.employee_salary_records
  using (false) with check (false);

-- #8: lời mời quyền owner/admin/hr phải gắn email hoặc SĐT khớp tài khoản;
-- chỉ tự gắn hồ sơ nhân viên theo email khi lời mời có email đã khớp.
create or replace function public.accept_company_invite(invite_token text)
returns uuid language plpgsql security definer set search_path = public as $$
 declare
  inv public.company_invites;
  actor uuid := auth.uid();
  actor_email text;
  actor_phone text;
  invite_phone text;
begin
  if actor is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into inv from public.company_invites where token = invite_token for update;
  if not found then raise exception 'INVITE_NOT_FOUND'; end if;
  if inv.revoked then raise exception 'INVITE_REVOKED'; end if;
  if inv.accepted_at is not null then raise exception 'INVITE_USED'; end if;
  if inv.expires_at < now() then raise exception 'INVITE_EXPIRED'; end if;

  select lower(u.email),
         right(regexp_replace(coalesce(nullif(u.phone, ''), u.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g'), 9)
    into actor_email, actor_phone
  from auth.users u where u.id = actor;
  invite_phone := right(regexp_replace(coalesce(inv.phone, ''), '\D', '', 'g'), 9);

  if inv.email is not null and lower(inv.email) <> coalesce(actor_email, '') then
    raise exception 'INVITE_EMAIL_MISMATCH';
  end if;

  if inv.email is null and inv.role in ('owner', 'admin', 'hr') then
    if invite_phone = '' or coalesce(actor_phone, '') <> invite_phone then
      raise exception 'INVITE_IDENTITY_REQUIRED';
    end if;
  end if;

  insert into public.company_members (company_id, user_id, role, job_title, department, invited_by)
  values (inv.company_id, actor, inv.role, inv.job_title, inv.department, inv.invited_by)
  on conflict (company_id, user_id) do update set status = 'active';

  if inv.email is not null and actor_email is not null and not exists (
    select 1 from public.employees where company_id = inv.company_id and user_id = actor
  ) then
    update public.employees e
    set user_id = actor
    where e.id = (
      select id from public.employees
      where company_id = inv.company_id
        and user_id is null
        and lower(coalesce(work_email, personal_email, '')) = actor_email
      order by created_at asc
      limit 1
    );
  end if;

  update public.company_invites set accepted_at = now(), accepted_by = actor where id = inv.id;
  return inv.company_id;
end;
$$;

-- #9: form ứng viên chỉ nộp một lần; chỉ mở lại khi HR gửi lại liên kết (form_sent_at mới hơn lần nộp);
-- liên kết hết hạn sau 30 ngày kể từ lần gửi gần nhất.
create or replace function public.submit_candidate_form(p_token text, payload jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  target public.candidates;
begin
  select c.* into target from public.candidates c where c.form_token = p_token limit 1 for update;
  if not found then
    raise exception 'FORM_NOT_FOUND';
  end if;
  if target.form_sent_at is not null and target.form_sent_at < now() - interval '30 days' then
    raise exception 'FORM_EXPIRED';
  end if;
  if target.form_submitted_at is not null
     and (target.form_sent_at is null or target.form_sent_at <= target.form_submitted_at) then
    raise exception 'FORM_ALREADY_SUBMITTED';
  end if;

  update public.candidates
  set full_name = coalesce(nullif(payload->>'full_name', ''), full_name),
      email = coalesce(nullif(payload->>'email', ''), email),
      phone = coalesce(nullif(payload->>'phone', ''), phone),
      date_of_birth = nullif(payload->>'date_of_birth', '')::date,
      gender = nullif(payload->>'gender', ''),
      address = nullif(payload->>'address', ''),
      position_applied = coalesce(nullif(payload->>'position_applied', ''), position_applied),
      experience_years = nullif(payload->>'experience_years', '')::numeric,
      current_salary = nullif(payload->>'current_salary', '')::numeric,
      expected_salary = nullif(payload->>'expected_salary', '')::numeric,
      education = nullif(payload->>'education', ''),
      note = nullif(payload->>'note', ''),
      profile_data = payload,
      form_submitted_at = now()
  where id = target.id;

  return true;
end;
$$;
revoke all on function public.submit_candidate_form(text, jsonb) from public;
grant execute on function public.submit_candidate_form(text, jsonb) to anon, authenticated;

-- #10: chỉ khớp hồ sơ nhân viên có sẵn theo user_id hoặc email, không theo mã NV001 / SĐT.
create or replace function public.provision_workspace_admin_profile(
  p_company uuid,
  p_user uuid,
  p_name text,
  p_email text,
  p_phone text
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_department uuid;
  v_employee uuid;
  v_code text;
begin
  if auth.uid() is not null and not public.is_platform_admin() then
    raise exception 'Chỉ quản trị viên hệ thống được cấp tài khoản workspace.';
  end if;

  select id into v_department
  from public.departments
  where company_id = p_company and lower(name) = lower('Ban quản lý')
  limit 1;

  if v_department is null then
    insert into public.departments (company_id, name, description, sort_order)
    values (p_company, 'Ban quản lý', 'Phòng ban quản trị workspace', 0)
    returning id into v_department;
  end if;

  insert into public.department_positions (company_id, department_id, title, is_management, sort_order)
  select p_company, v_department, 'Quản lý', true, 0
  where not exists (
    select 1 from public.department_positions
    where company_id = p_company and lower(title) = lower('Quản lý')
  );

  insert into public.company_members (company_id, user_id, role, status)
  values (p_company, p_user, 'owner', 'active')
  on conflict (company_id, user_id) do update set role = 'owner', status = 'active';

  select id into v_employee
  from public.employees
  where company_id = p_company
    and (
      user_id = p_user
      or (p_email is not null and user_id is null
          and (lower(work_email) = lower(p_email) or lower(personal_email) = lower(p_email)))
    )
  order by (user_id = p_user) desc nulls last, created_at
  limit 1;

  if v_employee is null then
    select 'NV' || lpad((count(*) + 1)::text, 3, '0') into v_code
    from public.employees where company_id = p_company;

    insert into public.employees
      (company_id, user_id, code, full_name, position, department, status, work_email, personal_email, phone)
    values
      (p_company, p_user, v_code, coalesce(p_name, split_part(p_email, '@', 1)), 'Quản lý', 'Ban quản lý', 'active', p_email, p_email, p_phone)
    returning id into v_employee;
  else
    -- Hồ sơ có sẵn: chỉ gắn tài khoản và bổ sung thông tin còn trống, không ghi đè tên/chức vụ.
    update public.employees
    set user_id = p_user,
        work_email = coalesce(work_email, p_email),
        personal_email = coalesce(personal_email, p_email),
        phone = coalesce(phone, p_phone)
    where id = v_employee;
  end if;

  return v_employee;
end $$;
revoke all on function public.provision_workspace_admin_profile(uuid, uuid, text, text, text) from public;
grant execute on function public.provision_workspace_admin_profile(uuid, uuid, text, text, text) to service_role;

-- #11: edge function tra user theo email thay vì listUsers trang đầu.
create or replace function public.find_auth_user_id_by_email(p_email text)
returns uuid language sql stable security definer set search_path = public, auth as $$
  select u.id from auth.users u where lower(u.email) = lower(trim(p_email)) limit 1;
$$;
revoke all on function public.find_auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_auth_user_id_by_email(text) to service_role;
