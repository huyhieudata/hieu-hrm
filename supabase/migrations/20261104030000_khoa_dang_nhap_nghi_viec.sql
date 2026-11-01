-- #43: khi nhân viên nghỉ việc, khoá đăng nhập vào CÔNG TY (company_members.status = 'suspended').
-- Không xoá dữ liệu, không xoá tài khoản. Không áp dụng cho Owner, cho chính người thao tác,
-- và cho tài khoản chủ hệ thống (hieusm.hki@gmail.com). Chỉ Owner/Admin/HR. Idempotent.
create or replace function public.suspend_employee_access(p_employee uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_company uuid; v_user uuid; v_role text; v_email text; v_name text;
begin
  select company_id, user_id, full_name into v_company, v_user, v_name from public.employees where id = p_employee;
  if v_company is null then raise exception 'Không tìm thấy hồ sơ.'; end if;
  if not public.has_company_role(v_company, array['owner','admin','hr']) then
    raise exception 'Chỉ Chủ sở hữu/Quản trị/HR được khoá đăng nhập.';
  end if;
  if v_user is null then return 'no_account'; end if;
  if v_user = auth.uid() then raise exception 'Không thể tự khoá tài khoản của chính mình.'; end if;
  select role into v_role from public.company_members where company_id = v_company and user_id = v_user;
  if v_role is null then return 'no_member'; end if;
  if v_role = 'owner' then raise exception 'Không khoá tài khoản Chủ sở hữu.'; end if;
  select lower(email) into v_email from auth.users where id = v_user;
  if v_email = 'hieusm.hki@gmail.com' then raise exception 'Tài khoản này được bảo vệ, không khoá.'; end if;
  if v_role = 'admin' and not public.has_company_role(v_company, array['owner','admin']) then
    raise exception 'HR không được khoá tài khoản Quản trị.';
  end if;
  update public.company_members set status = 'suspended'
   where company_id = v_company and user_id = v_user and status <> 'suspended';
  if found then
    insert into public.activity_logs (company_id, entity_type, entity_id, action, summary, actor_id, actor_name)
    values (v_company, 'employee', p_employee, 'access_suspended',
            'Khoá đăng nhập vào công ty (nghỉ việc): ' || coalesce(v_name, ''), auth.uid(),
            (select full_name from public.profiles where id = auth.uid()));
  end if;
  return 'suspended';
end $$;
revoke all on function public.suspend_employee_access(uuid) from public, anon;
grant execute on function public.suspend_employee_access(uuid) to authenticated;
