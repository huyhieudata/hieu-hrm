alter table public.candidates drop constraint if exists candidates_status_check;
alter table public.candidates
  add constraint candidates_status_check check (status in (
    'received','screening','qualified','interview_scheduled','interview_declined','interview_no_show',
    'interview_attended','interview_passed','interview_failed','rejected','offer_sent','offer_accepted',
    'offer_declined','started'
  ));

-- Interview status changes update the candidate stage
create or replace function public.sync_candidate_from_interview()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('nova.recruitment_sync', true), '') = '1' then
    return new;
  end if;

  perform set_config('nova.recruitment_sync', '1', true);

  if new.status = 'scheduled' then
    update public.candidates set status = 'interview_scheduled'
    where id = new.candidate_id and status in ('received', 'screening', 'qualified');
  elsif new.status = 'completed' then
    update public.candidates set status = 'interview_attended'
    where id = new.candidate_id and status in ('interview_scheduled', 'interview_declined');
  elsif new.status = 'no_show' then
    update public.candidates set status = 'interview_no_show'
    where id = new.candidate_id and status in ('interview_scheduled', 'interview_attended');
  end if;

  perform set_config('nova.recruitment_sync', '', true);
  return new;
end;
$$;

create trigger sync_candidate_from_interview_t
  after insert or update of status on public.candidate_interviews
  for each row execute function public.sync_candidate_from_interview();

-- Candidate stage changes update the interview status
create or replace function public.sync_interview_from_candidate()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(current_setting('nova.recruitment_sync', true), '') = '1' then
    return new;
  end if;

  perform set_config('nova.recruitment_sync', '1', true);

  if new.status = 'interview_attended' then
    update public.candidate_interviews set status = 'completed'
    where candidate_id = new.id and status = 'scheduled';
  elsif new.status = 'interview_no_show' then
    update public.candidate_interviews set status = 'no_show'
    where candidate_id = new.id and status = 'scheduled';
  elsif new.status = 'interview_declined' then
    update public.candidate_interviews set status = 'cancelled'
    where candidate_id = new.id and status = 'scheduled';
  end if;

  perform set_config('nova.recruitment_sync', '', true);
  return new;
end;
$$;

create trigger sync_interview_from_candidate_t
  after update of status on public.candidates
  for each row execute function public.sync_interview_from_candidate();