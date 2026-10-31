create table public.request_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  category text not null check (category in ('late','early_leave','leave','remote','attendance_fix','outside','other')),
  requires_attachment boolean not null default false,
  max_days numeric(4,1),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index request_types_company_idx on public.request_types (company_id);
alter table public.request_types enable row level security;
create trigger request_types_set_updated_at before update on public.request_types
  for each row execute function public.set_updated_at();

create policy "request_types_select" on public.request_types for select to authenticated using (public.can_view_attendance(company_id));
create policy "request_types_insert" on public.request_types for insert to authenticated with check (public.can_manage_attendance(company_id));
create policy "request_types_update" on public.request_types for update to authenticated using (public.can_manage_attendance(company_id)) with check (public.can_manage_attendance(company_id));
create policy "request_types_delete" on public.request_types for delete to authenticated using (public.can_manage_attendance(company_id));

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  request_type_id uuid not null references public.request_types(id) on delete restrict,
  start_date date not null,
  end_date date not null,
  session text check (session in ('morning','afternoon','full_day')),
  start_time time,
  end_time time,
  reason text,
  attachment_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint requests_date_check check (end_date >= start_date)
);
create index requests_company_idx on public.requests (company_id, start_date);
create index requests_employee_idx on public.requests (employee_id, start_date desc);
alter table public.requests enable row level security;
create trigger requests_set_updated_at before update on public.requests
  for each row execute function public.set_updated_at();

create policy "requests_select" on public.requests for select to authenticated using (public.can_access_employee(employee_id));
create policy "requests_insert" on public.requests for insert to authenticated
  with check (
    public.can_manage_employee(employee_id)
    or exists (select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid())
  );
create policy "requests_update" on public.requests for update to authenticated
  using (public.can_access_employee(employee_id))
  with check (public.can_access_employee(employee_id));
create policy "requests_delete" on public.requests for delete to authenticated using (public.can_manage_employee(employee_id));

create or replace function public.guard_request_changes()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not public.can_manage_employee(new.employee_id) then
      new.status := 'pending';
      new.decided_by := null;
      new.decided_at := null;
    end if;
    return new;
  end if;

  if not exists (select 1 from public.employees e where e.id = old.employee_id and e.user_id = auth.uid()) then
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

create trigger requests_guard
  before insert or update on public.requests
  for each row execute function public.guard_request_changes();

insert into public.request_types (company_id, name, category, requires_attachment, max_days, sort_order)
select c.id, v.name, v.category, v.attach, v.max_days, v.sort_order
from public.companies c
cross join (values
  ('Đi muộn', 'late', false, null::numeric, 1),
  ('Về sớm', 'early_leave', false, null, 2),
  ('Nghỉ phép', 'leave', false, 12, 3),
  ('Làm từ xa', 'remote', false, null, 4),
  ('Sửa chấm công', 'attendance_fix', true, null, 5),
  ('Đơn ra ngoài', 'outside', false, null, 6)
) as v(name, category, attach, max_days, sort_order)
where exists (select 1 from public.employees e where e.company_id = c.id)
  and not exists (select 1 from public.request_types t where t.company_id = c.id);