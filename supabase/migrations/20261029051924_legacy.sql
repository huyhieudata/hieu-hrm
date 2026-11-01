update public.companies
set plan_id = (select id from public.service_plans where code = 'BUSINESS'),
    subscription_expires_at = current_date + 60,
    workspace_status = 'active'
where plan_id is null;