alter table public.onboarding_records drop constraint if exists onboarding_records_status_check;
alter table public.onboarding_records
  add constraint onboarding_records_status_check check (status in ('pending','in_progress','completed','cancelled'));

create or replace function public.sync_onboarding_with_candidate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'offer_accepted' and old.status is distinct from 'offer_accepted' then
    insert into public.onboarding_records (
      company_id, candidate_id, full_name, email, phone, date_of_birth, gender, address,
      position, department, work_location, hire_date, base_salary, allowance, status
    )
    select
      new.company_id, new.id, new.full_name, new.email, new.phone, new.date_of_birth, new.gender, new.address,
      coalesce(o.position, new.position_applied), o.department, o.work_location,
      o.onboarding_date, o.base_salary, o.allowance, 'pending'
    from (select 1) as seed
    left join public.candidate_offers o on o.id = (
      select id from public.candidate_offers where candidate_id = new.id order by created_at desc limit 1
    )
    where not exists (
      select 1 from public.onboarding_records r
      where r.candidate_id = new.id and r.status in ('pending', 'in_progress')
    );

  elsif new.status = 'offer_declined' and old.status is distinct from 'offer_declined' then
    update public.onboarding_records
    set status = 'cancelled'
    where candidate_id = new.id and status in ('pending', 'in_progress');
  end if;

  return new;
end;
$$;

create trigger sync_onboarding_with_candidate_t
  after update of status on public.candidates
  for each row execute function public.sync_onboarding_with_candidate();