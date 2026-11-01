alter table public.department_positions
  add column if not exists is_management boolean not null default false;

update public.department_positions set is_management = true
where title in ('Backend Engineer', 'Account Manager', 'Kế toán tổng hợp')
  and is_management = false;