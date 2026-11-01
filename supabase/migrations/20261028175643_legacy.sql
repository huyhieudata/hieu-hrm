alter table public.employees add column if not exists concurrent_positions text;

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entity_type text not null check (entity_type in ('candidate','employee')),
  entity_id uuid not null,
  action text not null,
  summary text not null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_name text,
  created_at timestamptz not null default now()
);
create index activity_logs_entity_idx on public.activity_logs (entity_type, entity_id, created_at desc);
create index activity_logs_company_idx on public.activity_logs (company_id, created_at desc);
alter table public.activity_logs enable row level security;

create policy "activity_logs_select" on public.activity_logs
  for select to authenticated
  using (
    public.has_company_role(company_id, array['owner','admin','hr','manager'])
    or (entity_type = 'candidate' and public.can_view_recruitment(company_id))
    or (entity_type = 'employee' and public.can_access_employee(entity_id))
  );

create or replace function public.candidate_status_label(value text)
returns text language sql immutable as $$
  select case value
    when 'received' then 'Tiếp nhận'
    when 'screening' then 'Đang sàng lọc'
    when 'qualified' then 'Đạt hồ sơ'
    when 'interview_scheduled' then 'Hẹn phỏng vấn'
    when 'interview_declined' then 'Từ chối phỏng vấn'
    when 'interview_no_show' then 'Không đến phỏng vấn'
    when 'interview_attended' then 'Đến phỏng vấn'
    when 'interview_passed' then 'Đạt phỏng vấn'
    when 'interview_failed' then 'Không đạt phỏng vấn'
    when 'rejected' then 'Hồ sơ không đạt'
    when 'offer_sent' then 'Đã gửi offer'
    when 'offer_accepted' then 'Đồng ý offer'
    when 'offer_declined' then 'Từ chối nhận việc'
    when 'started' then 'Đã đến nhận việc'
    else value end;
$$;

create or replace function public.employee_status_label(value text)
returns text language sql immutable as $$
  select case value
    when 'pending' then 'Chờ cập nhật'
    when 'active' then 'Đang làm việc'
    when 'maternity' then 'Nghỉ thai sản'
    when 'long_leave' then 'Nghỉ dài hạn'
    when 'resigned' then 'Đã nghỉ việc'
    else value end;
$$;

-- Cross-entity duplicate protection
create or replace function public.validate_candidate_contacts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null and btrim(new.email) <> '' then
    if exists (select 1 from public.employees e where e.company_id = new.company_id and lower(e.work_email) = lower(btrim(new.email))) then
      raise exception 'Email đã được dùng trong hồ sơ nhân viên của công ty.';
    end if;
    if exists (select 1 from public.candidates c where c.company_id = new.company_id and c.id <> new.id and lower(c.email) = lower(btrim(new.email))) then
      raise exception 'Email đã được dùng trong hồ sơ ứng viên khác.';
    end if;
  end if;

  if new.phone is not null and btrim(new.phone) <> '' and regexp_replace(new.phone, '[^0-9]', '', 'g') <> '' then
    if exists (select 1 from public.employees e where e.company_id = new.company_id and regexp_replace(coalesce(e.phone,''), '[^0-9]', '', 'g') = regexp_replace(btrim(new.phone), '[^0-9]', '', 'g')) then
      raise exception 'Số điện thoại đã được dùng trong hồ sơ nhân viên của công ty.';
    end if;
    if exists (select 1 from public.candidates c where c.company_id = new.company_id and c.id <> new.id and regexp_replace(coalesce(c.phone,''), '[^0-9]', '', 'g') = regexp_replace(btrim(new.phone), '[^0-9]', '', 'g')) then
      raise exception 'Số điện thoại đã được dùng trong hồ sơ ứng viên khác.';
    end if;
  end if;

  return new;
end;
$$;

create trigger validate_candidate_contacts_t
  before insert or update of email, phone on public.candidates
  for each row execute function public.validate_candidate_contacts();

create or replace function public.validate_employee_contacts()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.work_email is not null and btrim(new.work_email) <> '' then
    if exists (select 1 from public.employees e where e.company_id = new.company_id and e.id <> new.id and lower(e.work_email) = lower(btrim(new.work_email))) then
      raise exception 'Email đã tồn tại trong hồ sơ nhân sự của công ty.';
    end if;
    if exists (select 1 from public.candidates c where c.company_id = new.company_id and lower(c.email) = lower(btrim(new.work_email))) then
      raise exception 'Email đã được dùng trong hồ sơ ứng viên của công ty.';
    end if;
  end if;

  if new.phone is not null and btrim(new.phone) <> '' then
    if exists (select 1 from public.employees e where e.company_id = new.company_id and e.id <> new.id and regexp_replace(coalesce(e.phone,''), '[^0-9]', '', 'g') = regexp_replace(btrim(new.phone), '[^0-9]', '', 'g')) then
      raise exception 'Số điện thoại đã tồn tại trong hồ sơ nhân sự của công ty.';
    end if;
    if exists (select 1 from public.candidates c where c.company_id = new.company_id and regexp_replace(coalesce(c.phone,''), '[^0-9]', '', 'g') = regexp_replace(btrim(new.phone), '[^0-9]', '', 'g')) then
      raise exception 'Số điện thoại đã được dùng trong hồ sơ ứng viên của công ty.';
    end if;
  end if;

  return new;
end;
$$;