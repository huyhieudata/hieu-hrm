alter table public.permission_groups drop constraint if exists permission_groups_name_key;
create unique index if not exists permission_groups_company_name_key on public.permission_groups (company_id, name) where company_id is not null;
create unique index if not exists permission_groups_global_name_key on public.permission_groups (name) where company_id is null;