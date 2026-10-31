-- Siết quyền gọi các hàm SECURITY DEFINER (Supabase advisor 0028/0029) và cố định search_path (0011).
-- 1) anon (chưa đăng nhập) chỉ được gọi 3 hàm công khai: peek_candidate_form, submit_candidate_form, peek_company_invite.
--    Đặc biệt provision_workspace_admin_profile bỏ qua kiểm tra quyền khi auth.uid() null -> trước đây anon có thể tự gán owner.
-- 2) Hàm trigger không cần quyền EXECUTE để chạy trigger -> thu hồi khỏi anon và authenticated.
-- 3) provision_workspace_admin_profile, recompute_employee_status chỉ dùng nội bộ / edge function (service_role).
do $$
declare
  r record;
  public_fns text[] := array['peek_candidate_form','submit_candidate_form','peek_company_invite'];
  internal_fns text[] := array['provision_workspace_admin_profile','recompute_employee_status','find_auth_user_id_by_email'];
begin
  for r in
    select p.oid::regprocedure as sig, p.proname, pg_get_function_result(p.oid) as res
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    if r.proname = any(public_fns) then
      continue;
    end if;
    execute format('revoke execute on function %s from public, anon', r.sig);
    if r.res = 'trigger' or r.proname = any(internal_fns) then
      execute format('revoke execute on function %s from authenticated', r.sig);
      execute format('grant execute on function %s to service_role', r.sig);
    else
      execute format('grant execute on function %s to authenticated, service_role', r.sig);
    end if;
  end loop;
end $$;

alter function public.set_updated_at() set search_path = public;
alter function public.candidate_status_label(text) set search_path = public;
alter function public.employee_status_label(text) set search_path = public;
alter function public.all_permission_keys() set search_path = public;
alter function public.default_role_permissions(text) set search_path = public;
