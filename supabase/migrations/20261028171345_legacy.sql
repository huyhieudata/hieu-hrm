alter table public.candidates
  add column if not exists employee_id uuid references public.employees(id) on delete set null;

create table public.onboarding_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_id uuid references public.candidates(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  date_of_birth date,
  gender text,
  address text,
  department text,
  position text,
  employment_type text,
  work_location text,
  hire_date date,
  base_salary numeric(14,2),
  allowance numeric(14,2),
  national_id text,
  bank_name text,
  bank_account text,
  tax_code text,
  note text,
  status text not null default 'completed' check (status in ('pending','in_progress','completed')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index onboarding_records_company_idx on public.onboarding_records (company_id);
alter table public.onboarding_records enable row level security;

create trigger onboarding_records_set_updated_at before update on public.onboarding_records
  for each row execute function public.set_updated_at();

create policy "onboarding_select" on public.onboarding_records
  for select to authenticated using (public.can_view_recruitment(company_id));
create policy "onboarding_insert" on public.onboarding_records
  for insert to authenticated with check (public.can_manage_recruitment(company_id));
create policy "onboarding_update" on public.onboarding_records
  for update to authenticated using (public.can_manage_recruitment(company_id)) with check (public.can_manage_recruitment(company_id));
create policy "onboarding_delete" on public.onboarding_records
  for delete to authenticated using (public.can_manage_recruitment(company_id));

-- “Đã đến nhận việc” can only be set by the onboarding flow
create or replace function public.guard_manual_started_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'started'
     and old.status is distinct from 'started'
     and coalesce(current_setting('nova.onboarding_sync', true), '') <> '1' then
    raise exception 'Trạng thái “Đã đến nhận việc” chỉ được đặt khi hoàn tất hội nhập. Hãy dùng nút Tiếp nhận trong hồ sơ ứng viên.';
  end if;
  return new;
end;
$$;

create trigger guard_manual_started_status_t
  before update of status on public.candidates
  for each row execute function public.guard_manual_started_status();

create or replace function public.complete_candidate_onboarding(p_candidate uuid, p_employee uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  target_company uuid;
begin
  select company_id into target_company from public.candidates where id = p_candidate;
  if target_company is null then
    raise exception 'CANDIDATE_NOT_FOUND';
  end if;
  if not public.can_manage_recruitment(target_company) then
    raise exception 'FORBIDDEN';
  end if;

  perform set_config('nova.onboarding_sync', '1', true);
  update public.candidates
  set status = 'started',
      employee_id = p_employee
  where id = p_candidate;
  perform set_config('nova.onboarding_sync', '', true);

  return true;
end;
$$;

revoke all on function public.complete_candidate_onboarding(uuid, uuid) from public;
grant execute on function public.complete_candidate_onboarding(uuid, uuid) to authenticated;