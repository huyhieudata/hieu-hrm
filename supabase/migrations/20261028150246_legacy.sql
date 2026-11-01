create table public.employee_debts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  title text not null,
  category text not null default 'other' check (category in ('advance','loan','penalty','equipment','other')),
  amount numeric(14,2) not null default 0 check (amount >= 0),
  settled_amount numeric(14,2) not null default 0 check (settled_amount >= 0),
  due_date date,
  status text not null default 'open' check (status in ('open','settled','cancelled')),
  note text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index employee_debts_employee_idx on public.employee_debts (employee_id);
alter table public.employee_debts enable row level security;

create trigger stamp_company_debts before insert on public.employee_debts
  for each row execute function public.stamp_employee_company();

create policy "debts_select" on public.employee_debts
  for select to authenticated using (public.can_view_sensitive_employee(employee_id));
create policy "debts_write" on public.employee_debts
  for insert to authenticated with check (public.can_manage_employee(employee_id));
create policy "debts_update" on public.employee_debts
  for update to authenticated using (public.can_manage_employee(employee_id)) with check (public.can_manage_employee(employee_id));
create policy "debts_delete" on public.employee_debts
  for delete to authenticated using (public.can_manage_employee(employee_id));

create or replace function public.employee_debt_outstanding(target_employee uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(amount - settled_amount), 0)
  from public.employee_debts
  where employee_id = target_employee
    and status = 'open'
    and amount - settled_amount > 0;
$$;

create or replace function public.prepare_employee_status()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  outstanding int;
  debt numeric;
  detail text;
begin
  if new.status = 'resigned' then
    if new.resignation_date is null then
      new.resignation_date = current_date;
    end if;

    if tg_op = 'UPDATE' then
      outstanding := public.employee_outstanding_assets(new.id);
      debt := public.employee_debt_outstanding(new.id);
      if outstanding > 0 or debt > 0 then
        detail := concat_ws(' và ',
          case when outstanding > 0 then outstanding || ' tài sản chưa thu hồi' end,
          case when debt > 0 then 'công nợ ' || to_char(debt, 'FM999G999G999G999') || 'đ chưa tất toán' end);
        raise exception 'Không thể nghỉ việc: còn %.', detail;
      end if;
    end if;
  elsif new.status = 'active' then
    new.resignation_date = null;
  end if;
  return new;
end;
$$;

create or replace function public.apply_work_event_to_employee()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  outstanding int;
  debt numeric;
  detail text;
begin
  if coalesce(current_setting('nova.skip_work_sync', true), '') = '1' then
    return new;
  end if;

  perform set_config('nova.sync_from_history', '1', true);

  if new.event_type = 'resignation' then
    outstanding := public.employee_outstanding_assets(new.employee_id);
    debt := public.employee_debt_outstanding(new.employee_id);
    if outstanding > 0 or debt > 0 then
      detail := concat_ws(' và ',
        case when outstanding > 0 then outstanding || ' tài sản chưa thu hồi' end,
        case when debt > 0 then 'công nợ ' || to_char(debt, 'FM999G999G999G999') || 'đ chưa tất toán' end);
      raise exception 'Không thể nghỉ việc: còn %.', detail;
    end if;

    update public.employees
    set status = 'resigned',
        resignation_date = coalesce(new.start_date, current_date)
    where id = new.employee_id;

    update public.employee_contracts
    set status = 'terminated',
        end_date = coalesce(end_date, new.start_date, current_date)
    where employee_id = new.employee_id and status = 'active';

  elsif new.event_type in ('onboarding', 'return') then
    update public.employees
    set status = 'active', resignation_date = null
    where id = new.employee_id and status <> 'active';

  elsif new.event_type = 'leave' then
    update public.employees
    set status = 'leave'
    where id = new.employee_id and status not in ('resigned', 'leave');

  elsif new.event_type in ('promotion', 'title_change', 'transfer') then
    update public.employees
    set position = coalesce(new.position, position),
        department = coalesce(new.department, department),
        work_location = coalesce(nullif(btrim(coalesce(new.location, '')), ''), work_location)
    where id = new.employee_id and status <> 'resigned';

  elsif new.event_type = 'location_change' then
    update public.employees
    set work_location = coalesce(nullif(btrim(coalesce(new.location, '')), ''), work_location)
    where id = new.employee_id and status <> 'resigned';
  end if;

  perform set_config('nova.sync_from_history', '', true);
  return new;
end;
$$;