alter table public.payroll_items add column if not exists adjusted_at timestamptz;
alter table public.payroll_items add column if not exists adjusted_by uuid references auth.users(id) on delete set null;

create or replace function public.stamp_payroll_item_adjustment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.adjusted_at is not distinct from old.adjusted_at then
    new.adjusted_at := now();
    new.adjusted_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger payroll_items_adjustment
  before update on public.payroll_items
  for each row execute function public.stamp_payroll_item_adjustment();