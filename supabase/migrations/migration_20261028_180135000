create or replace function public.purge_employee_data()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Employee-scoped data is removed; recruitment data (candidates, offers,
  -- interviews, evaluations) is preserved and only unlinked.
  delete from public.onboarding_records where employee_id = old.id;
  delete from public.activity_logs where entity_type = 'employee' and entity_id = old.id;
  return old;
end;
$$;

create trigger purge_employee_data_t
  after delete on public.employees
  for each row execute function public.purge_employee_data();