-- Admin tạo tài khoản nhân viên trực tiếp (thay cho gửi mail mời).
-- Mật khẩu KHÔNG bao giờ được lưu ở DB: chỉ lưu cờ bắt đổi mật khẩu và nhật ký ai tạo cho ai.

-- 1) Tài khoản do công ty tạo không được tự sinh workspace dùng thử.
create or replace function public.provision_trial_workspace()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_plan uuid;
  v_company uuid;
  v_name text;
begin
  if coalesce(new.raw_app_meta_data, '{}'::jsonb) ? 'provisioned_company' then
    return new;
  end if;
  select id into v_plan from public.service_plans where code = 'TRIAL' limit 1;
  v_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(coalesce(new.email, 'Người dùng'), '@', 1)
  );
  insert into public.companies (name, plan_id, workspace_status, subscription_expires_at, created_by)
  values (v_name || ' Workspace', v_plan, 'trial', current_date + 30, new.id)
  returning id into v_company;
  perform public.provision_workspace_admin_profile(
    v_company, new.id, v_name, new.email, new.raw_user_meta_data ->> 'phone'
  );
  return new;
end $function$;

-- 2) Cờ bắt đổi mật khẩu lần đầu. Người dùng không tự sửa được cờ (chỉ qua RPC/ service role).
alter table public.profiles add column if not exists must_change_password boolean not null default false;

create or replace function public.profiles_guard_must_change()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.must_change_password is distinct from old.must_change_password
     and coalesce(auth.role(), '') <> 'service_role'
     and coalesce(current_setting('hrm.clear_must_change', true), '') <> 'on' then
    new.must_change_password := old.must_change_password;
  end if;
  return new;
end $$;
drop trigger if exists trg_profiles_guard_must_change on public.profiles;
create trigger trg_profiles_guard_must_change before update on public.profiles
  for each row execute function public.profiles_guard_must_change();

create or replace function public.clear_must_change_password()
returns void language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  perform set_config('hrm.clear_must_change', 'on', true);
  update public.profiles set must_change_password = false where id = auth.uid();
end $$;
revoke execute on function public.clear_must_change_password() from public, anon;
grant execute on function public.clear_must_change_password() to authenticated;

-- 3) Nhật ký cấp tài khoản (không có cột mật khẩu).
create table if not exists public.account_provision_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  target_user_id uuid references auth.users(id) on delete set null,
  email text,
  action text not null check (action in ('create', 'reset')),
  result text not null check (result in ('created', 'exists', 'linked', 'reset', 'error')),
  mail_status text,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists account_provision_logs_company_idx on public.account_provision_logs(company_id, created_at desc);
create index if not exists account_provision_logs_actor_idx on public.account_provision_logs(actor_id, created_at desc);
create index if not exists account_provision_logs_employee_idx on public.account_provision_logs(employee_id);
create index if not exists account_provision_logs_target_idx on public.account_provision_logs(target_user_id);
alter table public.account_provision_logs enable row level security;
drop policy if exists account_provision_logs_hr_read on public.account_provision_logs;
create policy account_provision_logs_hr_read on public.account_provision_logs
  for select to authenticated using (public.has_company_role(company_id, array['owner','admin','hr']));
revoke insert, update, delete on public.account_provision_logs from anon, authenticated;

-- 4) Mẫu email "tai_khoan_moi" cho công ty hiện có + công ty mới.
create or replace function public.email_seed_account_template(p_company uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  btn text := 'display:inline-block;background:#fc600b;color:#ffffff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold';
begin
  insert into public.email_templates (company_id, code, name, event_key, subject, body_html, is_default, created_by) values
  (p_company, 'tai_khoan_moi', 'Tài khoản đăng nhập mới', 'account_created', 'Tài khoản ONHRM của bạn tại {{ten_cong_ty}}',
   '<h2>Tài khoản ONHRM của bạn</h2><p>Xin chào {{ten_nhan_vien}},</p><p><strong>{{ten_cong_ty}}</strong> đã tạo tài khoản ONHRM cho bạn.</p><p>Tên đăng nhập: <strong>{{ten_dang_nhap}}</strong><br/>Mật khẩu tạm: <strong style="font-family:monospace;font-size:15px">{{mat_khau_tam}}</strong></p><p><a href="{{link_dang_nhap}}" style="' || btn || '">Đăng nhập ngay</a></p><p><strong>Vì bảo mật, hệ thống sẽ yêu cầu bạn đổi mật khẩu ngay ở lần đăng nhập đầu tiên.</strong> Không chia sẻ email này cho người khác.</p>', true, null)
  on conflict (company_id, code) do nothing;
end $$;
revoke execute on function public.email_seed_account_template(uuid) from public, anon, authenticated;

create or replace function public.email_seed_on_company()
returns trigger language plpgsql security definer set search_path = public
as $$ begin
  perform public.email_seed_templates(new.id);
  perform public.email_seed_account_template(new.id);
  return new;
end; $$;
revoke execute on function public.email_seed_on_company() from public, anon, authenticated;

do $$ declare c record; begin
  for c in select id from public.companies loop perform public.email_seed_account_template(c.id); end loop;
end $$;
