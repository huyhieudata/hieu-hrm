-- Decline path: candidate + pending onboarding must flip to declined / cancelled
update public.candidates set status = 'offer_declined' where id = 'd3000000-0000-4000-8000-000000000003';