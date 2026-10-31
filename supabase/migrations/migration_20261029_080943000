alter table public.candidates
  add column if not exists rejection_reason text;

update public.candidates
set rejection_reason = coalesce(rejection_reason, note, 'Không đạt yêu cầu tuyển dụng'),
    status = 'rejected'
where status in ('interview_declined', 'interview_no_show', 'interview_failed', 'offer_declined');