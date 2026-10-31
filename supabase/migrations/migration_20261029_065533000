alter table public.service_plans
  add column if not exists duration_months integer not null default 12;

update public.service_plans set duration_months = 1 where code = 'STARTER';
update public.service_plans set duration_months = 12 where code = 'BUSINESS';
update public.service_plans set duration_months = 24 where code = 'ENTERPRISE';