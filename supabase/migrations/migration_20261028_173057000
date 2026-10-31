-- Restore demo state: accept offer again (creates a fresh pending record) and drop the cancelled test row
update public.candidates set status = 'offer_accepted' where id = 'd3000000-0000-4000-8000-000000000006';
delete from public.onboarding_records where candidate_id = 'd3000000-0000-4000-8000-000000000006' and status = 'cancelled';