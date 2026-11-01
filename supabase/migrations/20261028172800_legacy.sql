-- Test: accepting an offer creates a pending onboarding record
update public.candidates set status = 'offer_accepted' where id = 'd3000000-0000-4000-8000-000000000003';