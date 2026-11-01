-- Mời nhân viên từ hồ sơ: lời mời gắn employee_id, trạng thái gửi email, RPC mời/thu hồi/trạng thái.
alter table public.company_invites
  add column if not exists employee_id uuid references public.employees(id) on delete set null,
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_status text;
create index if not exists company_invites_employee_idx on public.company_invites(employee_id);

-- Mời một hồ sơ: chỉ owner/admin/HR; HR chỉ mời Nhân viên/Quản lý; admin chỉ owner/admin mời; owner chỉ owner mời.
create or replace function public.invite_employee(
  p_employee uuid, p_email text, p_role text, p_job_title text default null, p_department text default null
) returns table (invite_id uuid, token text, expires_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare
  v_emp public.employees;
  v_actor_role text;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_inv public.company_invites;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_emp from public.employees where id = p_employee;
  if not found then raise exception 'EMPLOYEE_NOT_FOUND'; end if;
  if not public.has_company_role(v_emp.company_id, array['owner','admin','hr']) then raise exception 'FORBIDDEN'; end if;
  v_actor_role := public.company_role(v_emp.company_id);
  if p_role not in ('employee','manager','hr','admin') then raise exception 'INVALID_ROLE'; end if;
  if p_role = 'admin' and v_actor_role not in ('owner','admin') then raise exception 'ROLE_NOT_ALLOWED'; end if;
  if p_role = 'hr' and v_actor_role not in ('owner','admin') then raise exception 'ROLE_NOT_ALLOWED'; end if;
  if v_email = '' then raise exception 'INVITE_IDENTITY_REQUIRED'; end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'INVALID_EMAIL'; end if;
  if v_emp.user_id is not null then raise exception 'EMPLOYEE_ALREADY_LINKED'; end if;

  -- Một hồ sơ chỉ có một lời mời còn hiệu lực.
  update public.company_invites set revoked = true
  where employee_id = v_emp.id and accepted_at is null and not revoked;

  insert into public.company_invites (company_id, email, role, job_title, department, invited_by, employee_id)
  values (v_emp.company_id, v_email, p_role, nullif(btrim(coalesce(p_job_title, '')), ''),
          nullif(btrim(coalesce(p_department, '')), ''), auth.uid(), v_emp.id)
  returning * into v_inv;

  return query select v_inv.id, v_inv.token, v_inv.expires_at;
end;
$$;

create or replace function public.revoke_employee_invite(p_invite uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_company uuid;
begin
  select company_id into v_company from public.company_invites where id = p_invite and accepted_at is null;
  if v_company is null then raise exception 'INVITE_NOT_FOUND'; end if;
  if not public.has_company_role(v_company, array['owner','admin','hr']) then raise exception 'FORBIDDEN'; end if;
  update public.company_invites set revoked = true where id = p_invite;
end;
$$;

-- Trạng thái mời theo hồ sơ (lời mời mới nhất), chỉ owner/admin/HR.
create or replace function public.employee_invite_status(p_company uuid)
returns table (employee_id uuid, invite_id uuid, status text, email text, role text, token text,
               created_at timestamptz, expires_at timestamptz, email_sent_at timestamptz, email_status text, linked boolean)
language sql stable security definer set search_path = public
as $$
  select e.id, i.id,
         case
           when e.user_id is not null then 'joined'
           when i.id is null then 'none'
           when i.accepted_at is not null then 'joined'
           when i.revoked then 'revoked'
           when i.expires_at < now() then 'expired'
           else 'sent'
         end,
         i.email, i.role, i.token, i.created_at, i.expires_at, i.email_sent_at, i.email_status, e.user_id is not null
  from public.employees e
  left join lateral (
    select * from public.company_invites ci where ci.employee_id = e.id order by ci.created_at desc limit 1
  ) i on true
  where e.company_id = p_company
    and public.has_company_role(p_company, array['owner','admin','hr']);
$$;

revoke all on function public.invite_employee(uuid, text, text, text, text) from public, anon;
grant execute on function public.invite_employee(uuid, text, text, text, text) to authenticated;
revoke all on function public.revoke_employee_invite(uuid) from public, anon;
grant execute on function public.revoke_employee_invite(uuid) to authenticated;
revoke all on function public.employee_invite_status(uuid) from public, anon;
grant execute on function public.employee_invite_status(uuid) to authenticated;

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

  -- Lời mời gắn với hồ sơ cụ thể: liên kết đúng hồ sơ đó (email đã được kiểm tra khớp ở trên).
  if inv.employee_id is not null and inv.email is not null and not exists (
    select 1 from public.employees where company_id = inv.company_id and user_id = actor
  ) then
    update public.employees e set user_id = actor
    where e.id = inv.employee_id and e.company_id = inv.company_id and e.user_id is null;
  end if;

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
