alter table public.leave_policies
  add column if not exists auto_annual_leave boolean not null default true;