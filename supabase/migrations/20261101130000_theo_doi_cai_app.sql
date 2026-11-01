-- Theo dõi trạng thái cài PWA của từng người (theo user + thiết bị trình duyệt).
create table if not exists public.app_installs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_hash text not null check (device_hash ~ '^[0-9a-f]{64}$'),
  platform text not null default 'other' check (platform in ('android','ios','desktop','other')),
  display_mode text not null default 'standalone' check (display_mode in ('standalone','fullscreen','minimal-ui','window-controls-overlay','browser')),
  installed_at timestamptz not null default now(),
  last_opened_at timestamptz,
  open_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (company_id, user_id, device_hash)
);
create index if not exists app_installs_company_idx on public.app_installs(company_id, user_id);

alter table public.app_installs enable row level security;

drop policy if exists app_installs_select on public.app_installs;
create policy app_installs_select on public.app_installs for select to authenticated
using (
  user_id = auth.uid()
  or public.has_company_role(company_id, array['owner','admin','hr'])
  or exists (
    select 1 from public.employees e
    where e.company_id = app_installs.company_id and e.user_id = app_installs.user_id
      and public.is_manager_of_employee(e.id)
  )
);
-- Không có policy ghi: chỉ ghi qua RPC.
revoke insert, update, delete on public.app_installs from anon, authenticated;

create or replace function public.report_app_install(
  p_company uuid, p_device_hash text, p_platform text, p_display_mode text, p_event text default 'open'
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_platform text := case when p_platform in ('android','ios','desktop','other') then p_platform else 'other' end;
  v_mode text := case when p_display_mode in ('standalone','fullscreen','minimal-ui','window-controls-overlay','browser') then p_display_mode else 'browser' end;
  v_open boolean := v_mode <> 'browser';
begin
  if v_uid is null then raise exception 'Chưa đăng nhập'; end if;
  if not public.is_company_member(p_company) then raise exception 'Không thuộc công ty'; end if;
  if p_device_hash is null or p_device_hash !~ '^[0-9a-f]{64}$' then raise exception 'Mã thiết bị không hợp lệ'; end if;
  if p_event not in ('open','installed') then raise exception 'Sự kiện không hợp lệ'; end if;
  -- Chỉ ghi khi thật sự chạy dạng app hoặc vừa cài.
  if not v_open and p_event <> 'installed' then return; end if;

  insert into public.app_installs as a (company_id, user_id, device_hash, platform, display_mode, last_opened_at, open_count)
  values (p_company, v_uid, p_device_hash, v_platform, case when v_open then v_mode else 'standalone' end,
          case when v_open then now() end, case when v_open then 1 else 0 end)
  on conflict (company_id, user_id, device_hash) do update set
    platform = excluded.platform,
    display_mode = case when v_open then excluded.display_mode else a.display_mode end,
    last_opened_at = case when v_open then now() else a.last_opened_at end,
    open_count = a.open_count + case when v_open then 1 else 0 end,
    updated_at = now();
end;
$$;

-- Trạng thái theo thành viên, theo phạm vi người xem (owner/admin/HR: cả công ty; quản lý: phòng ban mình + bản thân; khác: bản thân).
create or replace function public.app_install_status(p_company uuid)
returns table (user_id uuid, employee_id uuid, installed boolean, device_count integer, platforms text[], first_installed_at timestamptz, last_opened_at timestamptz)
language sql stable security definer set search_path = public
as $$
  with scope as (
    select m.user_id, e.id as employee_id
    from public.company_members m
    left join public.employees e on e.company_id = m.company_id and e.user_id = m.user_id
    where m.company_id = p_company and m.status = 'active'
      and public.is_company_member(p_company)
      and (
        m.user_id = auth.uid()
        or public.has_company_role(p_company, array['owner','admin','hr'])
        or (e.id is not null and public.is_manager_of_employee(e.id))
      )
  )
  select s.user_id, s.employee_id,
         count(a.id) > 0,
         count(a.id)::int,
         coalesce(array_agg(distinct a.platform) filter (where a.id is not null), '{}'),
         min(a.installed_at),
         max(a.last_opened_at)
  from scope s
  left join public.app_installs a on a.company_id = p_company and a.user_id = s.user_id
  group by s.user_id, s.employee_id;
$$;

revoke all on function public.report_app_install(uuid, text, text, text, text) from public, anon;
grant execute on function public.report_app_install(uuid, text, text, text, text) to authenticated;
revoke all on function public.app_install_status(uuid) from public, anon;
grant execute on function public.app_install_status(uuid) to authenticated;
