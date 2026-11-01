alter table public.candidate_offers
  add column if not exists response_deadline date;

update public.candidate_offers
set response_deadline = onboarding_date - 3
where response_deadline is null and onboarding_date is not null;