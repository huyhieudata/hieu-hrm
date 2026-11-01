alter table public.service_plans
  add column if not exists max_workspaces integer not null default 1,
  add column if not exists duration_days integer;

update public.service_plans set max_workspaces = 1 where code = 'STARTER';
update public.service_plans set max_workspaces = 3 where code = 'BUSINESS';
update public.service_plans set max_workspaces = 10 where code = 'ENTERPRISE';

insert into public.service_plans
  (name, code, price_monthly, price_yearly, max_members, max_workspaces, duration_months, duration_days, features, active)
select 'Dùng thử 30 ngày', 'TRIAL', 0, 0, 10, 1, 1, 30,
       array['Đầy đủ tính năng cơ bản', 'Tối đa 10 nhân sự', '1 workspace', 'Hỗ trợ qua email'], true
where not exists (select 1 from public.service_plans where code = 'TRIAL');

create or replace function public.provision_trial_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_plan uuid;
  v_company uuid;
  v_name text;
begin
  select id into v_plan from public.service_plans where code = 'TRIAL' limit 1;
  v_name := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    split_part(coalesce(new.email, 'Người dùng'), '@', 1)
  );

  insert into public.companies (name, plan_id, workspace_status, subscription_expires_at, created_by)
  values (v_name || ' Workspace', v_plan, 'trial', current_date + 30, new.id)
  returning id into v_company;

  insert into public.employees (company_id, user_id, code, full_name, position, status, work_email, personal_email, phone)
  values (
    v_company, new.id, 'NV001', v_name, 'Quản trị viên', 'active',
    new.email, new.email, new.raw_user_meta_data ->> 'phone'
  );

  return new;
end $$;

create trigger on_auth_user_created_trial
after insert on auth.users
for each row execute function public.provision_trial_workspace();