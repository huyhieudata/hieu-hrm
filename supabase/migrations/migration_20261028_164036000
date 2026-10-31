alter table public.candidates drop constraint if exists candidates_status_check;
alter table public.candidates
  add constraint candidates_status_check check (status in (
    'received','screening','qualified','interview_scheduled','interview_declined',
    'interview_attended','interview_passed','interview_failed','rejected','offer_sent','offer_accepted','started'
  ));

alter table public.recruitment_campaigns
  add column if not exists sla_days integer not null default 30;

alter table public.recruitment_campaigns drop constraint if exists recruitment_campaigns_sla_days_check;
alter table public.recruitment_campaigns
  add constraint recruitment_campaigns_sla_days_check check (sla_days between 1 and 365);