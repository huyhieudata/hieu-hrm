alter table public.candidates drop constraint if exists candidates_status_check;
alter table public.candidates
  add constraint candidates_status_check check (status in (
    'received','screening','qualified','interview_scheduled','interview_declined',
    'interview_attended','interview_passed','interview_failed','rejected','offer_sent',
    'offer_accepted','offer_declined','started'
  ));

alter table public.candidates
  add column if not exists hired_salary numeric(14,2),
  add column if not exists onboarding_date date,
  add column if not exists work_location text;