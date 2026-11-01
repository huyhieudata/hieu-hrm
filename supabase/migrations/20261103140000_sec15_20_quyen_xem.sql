-- SEC-15/16 + Tester#2: danh sách thành viên, vai trò, email chỉ Owner/Admin/HR thấy; người khác chỉ thấy dòng của mình.
-- Tên/avatar đồng nghiệp vẫn lấy từ bảng employees như hiện tại.
drop policy if exists members_select_teammates on public.company_members;
drop policy if exists members_select_self_or_hr on public.company_members;
create policy members_select_self_or_hr on public.company_members for select to authenticated
  using (user_id = (select auth.uid()) or public.has_company_role(company_id, array['owner','admin','hr']));

create or replace function public.can_view_profile(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members me join public.company_members t on t.company_id = me.company_id
    where me.user_id = auth.uid() and me.status = 'active' and me.role in ('owner','admin','hr') and t.user_id = target)
$$;
revoke execute on function public.can_view_profile(uuid) from public, anon;
grant execute on function public.can_view_profile(uuid) to authenticated;

drop policy if exists profiles_select_self_or_teammates on public.profiles;
drop policy if exists profiles_select_self_or_hr on public.profiles;
create policy profiles_select_self_or_hr on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.can_view_profile(id));

-- Tester#2: cấu hình quy trình duyệt chỉ Owner/Admin/HR đọc được (tính toán bước duyệt chạy bằng hàm SECURITY DEFINER).
drop policy if exists approval_workflows_select on public.approval_workflows;
create policy approval_workflows_select on public.approval_workflows for select to authenticated
  using (public.has_company_role(company_id, array['owner','admin','hr']));
drop policy if exists approval_workflow_steps_select on public.approval_workflow_steps;
create policy approval_workflow_steps_select on public.approval_workflow_steps for select to authenticated
  using (exists (select 1 from public.approval_workflows w where w.id = workflow_id and public.has_company_role(w.company_id, array['owner','admin','hr'])));
drop policy if exists approval_workflow_types_select on public.approval_workflow_types;
create policy approval_workflow_types_select on public.approval_workflow_types for select to authenticated
  using (exists (select 1 from public.approval_workflows w where w.id = workflow_id and public.has_company_role(w.company_id, array['owner','admin','hr'])));

-- Tester#3: không tự duyệt đơn của chính mình (server).
create or replace function public.guard_request_changes()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_self boolean;
begin
  if auth.uid() is null then
    return new;
  end if;
  v_self := exists (select 1 from public.employees e where e.id = coalesce(new.employee_id, old.employee_id) and e.user_id = auth.uid());

  if tg_op = 'INSERT' then
    if v_self or not public.can_manage_employee(new.employee_id) then
      new.status := 'pending';
      new.decided_by := null;
      new.decided_at := null;
    end if;
    return new;
  end if;

  if not v_self then
    return new;
  end if;

  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    raise exception 'Không thể tự duyệt đơn của chính mình.';
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
end $function$;

create or replace function public.guard_request_approval_self()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is not null and new.status is distinct from old.status and new.status in ('approved','rejected')
     and exists (select 1 from public.requests r join public.employees e on e.id = r.employee_id
                 where r.id = new.request_id and e.user_id = auth.uid()) then
    raise exception 'Không thể tự duyệt đơn của chính mình.';
  end if;
  return new;
end $$;
drop trigger if exists request_approvals_no_self on public.request_approvals;
create trigger request_approvals_no_self before update on public.request_approvals
  for each row execute function public.guard_request_approval_self();

-- SEC-17: giới hạn mime cho company-docs và onboarding-forms (giống hr-documents).
update storage.buckets set allowed_mime_types = array[
  'application/pdf','image/jpeg','image/png','image/webp','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
where id in ('company-docs','onboarding-forms');

-- SEC-18: thu hồi EXECUTE với hàm nội bộ không được client/RLS gọi (chỉ dùng trong hàm SECURITY DEFINER khác).
do $$
declare r record;
begin
  for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'accept_company_invite','attendance_can_admin','attendance_effective_policy','attendance_qr_sign','attendance_resolve_shift',
      'can_manage_recruitment','candidate_status_label','email_employee_vars','email_enqueue_daily','email_enqueue_event',
      'email_seed_account_template','email_seed_templates','employee_debt_outstanding','employee_invite_status',
      'employee_outstanding_assets','employee_self_editable_fields','employee_status_label','evaluation_template_in_use',
      'haversine_m','invite_employee','org_assert_valid','recompute_employee_status','revoke_employee_invite','seed_default_request_types')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

-- SEC-19: bảng chặn hết là cố ý.
comment on table public.attendance_qr_secrets is 'RLS bật, không policy: chặn hết cố ý (chỉ hàm SECURITY DEFINER đọc).';
comment on table public.email_dispatch_config is 'RLS bật, không policy: chặn hết cố ý (chỉ service role / hàm SECURITY DEFINER đọc).';
