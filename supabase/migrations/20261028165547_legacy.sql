-- Sync test on demo candidate Phạm Thu Trang (status change -> interview status)
update public.candidates set status = 'interview_attended' where id = 'd3000000-0000-4000-8000-000000000004';

-- reverse direction (interview status -> candidate status)
update public.candidate_interviews set status = 'no_show' where id = 'd4000000-0000-4000-8000-000000000002';