-- Đợt 1: hồ sơ nhân viên & hợp đồng lao động (chỉ THÊM cột/bảng, không xoá dữ liệu).

-- 1. Hồ sơ: dân tộc, tôn giáo
alter table public.employees add column if not exists ethnicity text;
alter table public.employees add column if not exists religion text;
grant select (ethnicity, religion), update (ethnicity, religion) on public.employees to authenticated;

-- 2. Kiểm tra CCCD 12 số / MST 10 hoặc 13 số (chỉ khi giá trị thay đổi, dữ liệu cũ không bị chặn)
create or replace function public.validate_employee_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.national_id is not null and btrim(new.national_id) <> ''
     and (tg_op = 'INSERT' or new.national_id is distinct from old.national_id) then
    new.national_id := btrim(new.national_id);
    if new.national_id !~ '^[0-9]{12}$' then
      raise exception 'Số CCCD phải gồm đúng 12 chữ số.';
    end if;
  end if;
  if new.tax_code is not null and btrim(new.tax_code) <> ''
     and (tg_op = 'INSERT' or new.tax_code is distinct from old.tax_code) then
    new.tax_code := regexp_replace(btrim(new.tax_code), '[-\s]', '', 'g');
    if new.tax_code !~ '^([0-9]{10}|[0-9]{13})$' then
      raise exception 'Mã số thuế phải gồm 10 hoặc 13 chữ số.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_validate_employee_identity on public.employees;
create trigger trg_validate_employee_identity before insert or update on public.employees
  for each row execute function public.validate_employee_identity();

create or replace function public.validate_dependent_identity()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.tax_code is not null and btrim(new.tax_code) <> ''
     and (tg_op = 'INSERT' or new.tax_code is distinct from old.tax_code) then
    new.tax_code := regexp_replace(btrim(new.tax_code), '[-\s]', '', 'g');
    if new.tax_code !~ '^([0-9]{10}|[0-9]{13})$' then
      raise exception 'Mã số thuế người phụ thuộc phải gồm 10 hoặc 13 chữ số.';
    end if;
  end if;
  if new.national_id is not null and btrim(new.national_id) <> ''
     and (tg_op = 'INSERT' or new.national_id is distinct from old.national_id) then
    new.national_id := btrim(new.national_id);
    if new.national_id !~ '^[0-9]{12}$' then
      raise exception 'Số CCCD người phụ thuộc phải gồm đúng 12 chữ số.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_validate_dependent_identity on public.employee_dependents;
create trigger trg_validate_dependent_identity before insert or update on public.employee_dependents
  for each row execute function public.validate_dependent_identity();

-- Người phụ thuộc chứa CCCD/MST: chỉ owner/admin/HR và chính nhân viên được xem
drop policy if exists dependents_select on public.employee_dependents;
create policy dependents_select on public.employee_dependents for select
  using (public.can_view_sensitive_employee(employee_id));

-- 3. Cảnh báo trùng CCCD / email (không lộ dữ liệu: chỉ trả tên + mã)
create or replace function public.employee_duplicate_check(
  p_company uuid, p_national_id text default null, p_email text default null, p_exclude uuid default null)
returns table(kind text, employee_id uuid, full_name text, code text)
language sql stable security definer set search_path = public as $$
  select 'national_id', e.id, e.full_name, e.code from public.employees e
  where public.has_company_role(p_company, array['owner','admin','hr'])
    and e.company_id = p_company and coalesce(btrim(p_national_id), '') <> ''
    and e.national_id = btrim(p_national_id) and (p_exclude is null or e.id <> p_exclude)
  union all
  select 'email', e.id, e.full_name, e.code from public.employees e
  where public.has_company_role(p_company, array['owner','admin','hr'])
    and e.company_id = p_company and coalesce(btrim(p_email), '') <> ''
    and (lower(e.work_email) = lower(btrim(p_email)) or lower(e.personal_email) = lower(btrim(p_email)))
    and (p_exclude is null or e.id <> p_exclude);
$$;
revoke execute on function public.employee_duplicate_check(uuid, text, text, uuid) from public, anon;
grant execute on function public.employee_duplicate_check(uuid, text, text, uuid) to authenticated;

-- 4. Nhật ký sửa trường nhạy cảm (chỉ lưu tên trường, không lưu giá trị)
create table if not exists public.employee_sensitive_audit (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  fields text[] not null,
  actor_id uuid,
  actor_name text,
  source text not null default 'direct',
  created_at timestamptz not null default now()
);
create index if not exists employee_sensitive_audit_emp_idx on public.employee_sensitive_audit(employee_id, created_at desc);
alter table public.employee_sensitive_audit enable row level security;
drop policy if exists sensitive_audit_select on public.employee_sensitive_audit;
create policy sensitive_audit_select on public.employee_sensitive_audit for select
  using (public.has_company_role(company_id, array['owner','admin','hr']));
grant select on public.employee_sensitive_audit to authenticated;

create or replace function public.log_employee_sensitive_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_fields text[] := '{}';
begin
  if new.national_id is distinct from old.national_id then v_fields := array_append(v_fields, 'national_id'); end if;
  if new.national_id_issue_date is distinct from old.national_id_issue_date then v_fields := array_append(v_fields, 'national_id_issue_date'); end if;
  if new.national_id_issue_place is distinct from old.national_id_issue_place then v_fields := array_append(v_fields, 'national_id_issue_place'); end if;
  if new.tax_code is distinct from old.tax_code then v_fields := array_append(v_fields, 'tax_code'); end if;
  if new.insurance_number is distinct from old.insurance_number then v_fields := array_append(v_fields, 'insurance_number'); end if;
  if new.bank_name is distinct from old.bank_name then v_fields := array_append(v_fields, 'bank_name'); end if;
  if new.bank_account is distinct from old.bank_account then v_fields := array_append(v_fields, 'bank_account'); end if;
  if new.bank_branch is distinct from old.bank_branch then v_fields := array_append(v_fields, 'bank_branch'); end if;
  if new.date_of_birth is distinct from old.date_of_birth then v_fields := array_append(v_fields, 'date_of_birth'); end if;
  if cardinality(v_fields) > 0 then
    insert into public.employee_sensitive_audit (company_id, employee_id, fields, actor_id, actor_name, source)
    values (new.company_id, new.id, v_fields, auth.uid(),
            (select full_name from public.profiles where id = auth.uid()),
            coalesce(current_setting('app.change_source', true), 'direct'));
  end if;
  return new;
end $$;
revoke execute on function public.log_employee_sensitive_change() from public, anon, authenticated;
drop trigger if exists trg_log_employee_sensitive_change on public.employees;
create trigger trg_log_employee_sensitive_change after update on public.employees
  for each row execute function public.log_employee_sensitive_change();

-- 5. Chứng chỉ (có ngày hết hạn)
create table if not exists public.employee_certificates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  name text not null,
  issuer text,
  certificate_no text,
  issue_date date,
  expiry_date date,
  note text,
  created_at timestamptz not null default now(),
  constraint employee_certificates_dates check (expiry_date is null or issue_date is null or expiry_date >= issue_date)
);
create index if not exists employee_certificates_emp_idx on public.employee_certificates(employee_id);
create index if not exists employee_certificates_expiry_idx on public.employee_certificates(company_id, expiry_date);
drop trigger if exists stamp_company_certificates on public.employee_certificates;
create trigger stamp_company_certificates before insert on public.employee_certificates
  for each row execute function public.stamp_employee_company();
alter table public.employee_certificates enable row level security;
drop policy if exists certificates_select on public.employee_certificates;
create policy certificates_select on public.employee_certificates for select using (public.can_access_employee(employee_id));
drop policy if exists certificates_insert on public.employee_certificates;
create policy certificates_insert on public.employee_certificates for insert
  with check (public.can_employee_module(employee_id, 'employees', 'create') or public.can_employee_module(employee_id, 'employees', 'edit'));
drop policy if exists certificates_update on public.employee_certificates;
create policy certificates_update on public.employee_certificates for update
  using (public.can_employee_module(employee_id, 'employees', 'edit'))
  with check (public.can_employee_module(employee_id, 'employees', 'edit'));
drop policy if exists certificates_delete on public.employee_certificates;
create policy certificates_delete on public.employee_certificates for delete
  using (public.can_employee_module(employee_id, 'employees', 'delete') or public.can_employee_module(employee_id, 'employees', 'edit'));
grant select, insert, update, delete on public.employee_certificates to authenticated;

-- 6. Tài liệu: phân loại thêm + số giấy tờ + ngày hết hạn
alter table public.employee_documents add column if not exists document_no text;
alter table public.employee_documents add column if not exists expiry_date date;
alter table public.employee_documents drop constraint if exists employee_documents_category_check;
alter table public.employee_documents add constraint employee_documents_category_check
  check (category = any (array['contract','identity','degree','certificate','insurance','medical','cv','photo','other']));

-- 7. Nhân viên tự đề nghị cập nhật (liên hệ, khẩn cấp, ngân hàng) → HR duyệt
create table if not exists public.employee_change_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  changes jsonb not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  note text,
  requested_by uuid default auth.uid(),
  reviewed_by uuid,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists employee_change_requests_company_idx on public.employee_change_requests(company_id, status, created_at desc);
create index if not exists employee_change_requests_emp_idx on public.employee_change_requests(employee_id);
alter table public.employee_change_requests enable row level security;
drop policy if exists change_requests_select on public.employee_change_requests;
create policy change_requests_select on public.employee_change_requests for select
  using (public.can_view_sensitive_employee(employee_id));
grant select on public.employee_change_requests to authenticated;

create or replace function public.employee_self_editable_fields()
returns text[] language sql immutable set search_path = public as $$
  select array['phone','personal_email','current_address','permanent_address',
               'emergency_contact_name','emergency_contact_phone','emergency_contact_relation',
               'bank_name','bank_account','bank_branch'];
$$;

create or replace function public.submit_employee_change_request(p_company uuid, p_changes jsonb, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_emp uuid; v_key text; v_clean jsonb := '{}'; v_id uuid;
begin
  select id into v_emp from public.employees where company_id = p_company and user_id = auth.uid();
  if v_emp is null then raise exception 'Tài khoản chưa gắn hồ sơ nhân sự.'; end if;
  if jsonb_typeof(p_changes) <> 'object' then raise exception 'Dữ liệu không hợp lệ.'; end if;
  for v_key in select jsonb_object_keys(p_changes) loop
    if not v_key = any (public.employee_self_editable_fields()) then
      raise exception 'Trường % không được tự cập nhật.', v_key;
    end if;
    v_clean := v_clean || jsonb_build_object(v_key, nullif(btrim(p_changes ->> v_key), ''));
  end loop;
  if v_clean = '{}'::jsonb then raise exception 'Chưa có thay đổi nào.'; end if;
  if exists (select 1 from public.employee_change_requests where employee_id = v_emp and status = 'pending') then
    raise exception 'Bạn đã có một đề nghị đang chờ HR duyệt.';
  end if;
  insert into public.employee_change_requests (company_id, employee_id, changes, note)
  values (p_company, v_emp, v_clean, nullif(btrim(p_note), '')) returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.submit_employee_change_request(uuid, jsonb, text) from public, anon;
grant execute on function public.submit_employee_change_request(uuid, jsonb, text) to authenticated;

create or replace function public.cancel_employee_change_request(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.employee_change_requests r set status = 'cancelled'
  where r.id = p_id and r.status = 'pending'
    and exists (select 1 from public.employees e where e.id = r.employee_id and e.user_id = auth.uid());
  if not found then raise exception 'Không huỷ được đề nghị này.'; end if;
end $$;
revoke execute on function public.cancel_employee_change_request(uuid) from public, anon;
grant execute on function public.cancel_employee_change_request(uuid) to authenticated;

create or replace function public.review_employee_change_request(p_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r public.employee_change_requests; c jsonb;
begin
  select * into r from public.employee_change_requests where id = p_id for update;
  if r.id is null or r.status <> 'pending' then raise exception 'Đề nghị không còn chờ duyệt.'; end if;
  if not public.has_company_role(r.company_id, array['owner','admin','hr']) then
    raise exception 'Chỉ chủ sở hữu, quản trị hoặc HR được duyệt.';
  end if;
  if p_approve then
    c := r.changes;
    perform set_config('app.change_source', 'change_request', true);
    update public.employees set
      phone = case when c ? 'phone' then c->>'phone' else phone end,
      personal_email = case when c ? 'personal_email' then c->>'personal_email' else personal_email end,
      current_address = case when c ? 'current_address' then c->>'current_address' else current_address end,
      permanent_address = case when c ? 'permanent_address' then c->>'permanent_address' else permanent_address end,
      emergency_contact_name = case when c ? 'emergency_contact_name' then c->>'emergency_contact_name' else emergency_contact_name end,
      emergency_contact_phone = case when c ? 'emergency_contact_phone' then c->>'emergency_contact_phone' else emergency_contact_phone end,
      emergency_contact_relation = case when c ? 'emergency_contact_relation' then c->>'emergency_contact_relation' else emergency_contact_relation end,
      bank_name = case when c ? 'bank_name' then c->>'bank_name' else bank_name end,
      bank_account = case when c ? 'bank_account' then c->>'bank_account' else bank_account end,
      bank_branch = case when c ? 'bank_branch' then c->>'bank_branch' else bank_branch end
    where id = r.employee_id;
  end if;
  update public.employee_change_requests
  set status = case when p_approve then 'approved' else 'rejected' end,
      reviewed_by = auth.uid(), reviewed_at = now(), review_note = nullif(btrim(p_note), '')
  where id = p_id;
end $$;
revoke execute on function public.review_employee_change_request(uuid, boolean, text) from public, anon;
grant execute on function public.review_employee_change_request(uuid, boolean, text) to authenticated;

-- 8. Hợp đồng: thời vụ, địa điểm làm việc, ngày ký
alter table public.employee_contracts add column if not exists work_location text;
alter table public.employee_contracts add column if not exists signed_date date;
alter table public.employee_contracts drop constraint if exists employee_contracts_contract_type_check;
alter table public.employee_contracts add constraint employee_contracts_contract_type_check
  check (contract_type = any (array['probation','fixed_term','indefinite','seasonal','service','internship']));
alter table public.employee_contracts drop constraint if exists employee_contracts_dates_check;
alter table public.employee_contracts add constraint employee_contracts_dates_check
  check (end_date is null or start_date is null or end_date >= start_date) not valid;
create index if not exists employee_contracts_employee_idx on public.employee_contracts(employee_id, start_date);
create index if not exists employee_contracts_company_end_idx on public.employee_contracts(company_id, status, end_date);

-- 9. Phụ lục hợp đồng (tăng lương / đổi chức danh) – lịch sử
create table if not exists public.contract_appendices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  contract_id uuid not null references public.employee_contracts(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade,
  appendix_no text,
  change_type text not null default 'salary' check (change_type in ('salary','position','location','other')),
  effective_date date not null,
  base_salary numeric(14,2),
  insurance_salary numeric(14,2),
  allowance numeric(14,2),
  position text,
  department text,
  work_location text,
  content text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index if not exists contract_appendices_contract_idx on public.contract_appendices(contract_id, effective_date);
create or replace function public.stamp_contract_appendix()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select company_id, employee_id into new.company_id, new.employee_id
  from public.employee_contracts where id = new.contract_id;
  if new.company_id is null then raise exception 'Không tìm thấy hợp đồng.'; end if;
  return new;
end $$;
revoke execute on function public.stamp_contract_appendix() from public, anon, authenticated;
drop trigger if exists trg_stamp_contract_appendix on public.contract_appendices;
create trigger trg_stamp_contract_appendix before insert or update of contract_id on public.contract_appendices
  for each row execute function public.stamp_contract_appendix();
alter table public.contract_appendices enable row level security;
drop policy if exists appendices_select on public.contract_appendices;
create policy appendices_select on public.contract_appendices for select
  using (public.can_employee_module(employee_id, 'contracts', 'view'));
drop policy if exists appendices_insert on public.contract_appendices;
create policy appendices_insert on public.contract_appendices for insert
  with check (exists (select 1 from public.employee_contracts c where c.id = contract_id
    and (public.can_employee_module(c.employee_id, 'contracts', 'create') or public.can_employee_module(c.employee_id, 'contracts', 'edit'))));
drop policy if exists appendices_update on public.contract_appendices;
create policy appendices_update on public.contract_appendices for update
  using (public.can_employee_module(employee_id, 'contracts', 'edit'))
  with check (public.can_employee_module(employee_id, 'contracts', 'edit'));
drop policy if exists appendices_delete on public.contract_appendices;
create policy appendices_delete on public.contract_appendices for delete
  using (public.can_employee_module(employee_id, 'contracts', 'delete'));
grant select, insert, update, delete on public.contract_appendices to authenticated;

-- 10. Mẫu hợp đồng (chỉnh trong Cài đặt)
create table if not exists public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  contract_type text,
  body_html text not null,
  active boolean not null default true,
  updated_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists contract_templates_company_idx on public.contract_templates(company_id);
alter table public.contract_templates enable row level security;
drop policy if exists contract_templates_select on public.contract_templates;
create policy contract_templates_select on public.contract_templates for select
  using (public.has_permission(company_id, 'contracts.view'));
drop policy if exists contract_templates_write on public.contract_templates;
create policy contract_templates_write on public.contract_templates for all
  using (public.has_permission(company_id, 'contracts.edit'))
  with check (public.has_permission(company_id, 'contracts.edit'));
grant select, insert, update, delete on public.contract_templates to authenticated;
drop trigger if exists contract_templates_updated_at on public.contract_templates;
create trigger contract_templates_updated_at before update on public.contract_templates
  for each row execute function public.set_updated_at();
