-- Backfill a pending onboarding record for the demo candidate who accepted before the trigger existed
update public.candidates set status = 'offer_sent' where id = 'd3000000-0000-4000-8000-000000000006';
update public.candidates set status = 'offer_accepted' where id = 'd3000000-0000-4000-8000-000000000006';