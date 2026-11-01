-- Tài khoản nhân viên do công ty tạo: GoTrue chèn auth.users TRƯỚC rồi mới ghi app_metadata,
-- nên kiểm tra 'provisioned_company' lúc AFTER INSERT không thấy ⇒ vẫn sinh "XXX Workspace".
-- Bổ sung: email đã có hồ sơ nhân viên / lời mời ở công ty nào đó thì KHÔNG tạo workspace dùng thử.
create or replace function public.provision_trial_workspace()
returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_plan uuid;
  v_company uuid;
  v_name text;
  v_email text := lower(trim(coalesce(new.email, '')));
begin
  if coalesce(new.raw_app_meta_data, '{}'::jsonb) ? 'provisioned_company' then
    return new;
  end if;
  if v_email <> '' and exists (
    select 1 from public.employees e
    where lower(trim(coalesce(e.work_email, ''))) = v_email
       or lower(trim(coalesce(e.personal_email, ''))) = v_email
  ) then
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
