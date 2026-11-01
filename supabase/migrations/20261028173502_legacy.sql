-- Accepting the offer creates the pending onboarding records (trigger)
update public.candidates
set status = 'offer_accepted'
where id in (
  'd3000000-0000-4000-8000-000000000008',
  'd3000000-0000-4000-8000-000000000009',
  'd3000000-0000-4000-8000-00000000000a'
);