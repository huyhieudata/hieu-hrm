-- Test withdraw: leaving “Đồng ý offer” must cancel the pending onboarding record
update public.candidates set status = 'offer_sent' where id = 'd3000000-0000-4000-8000-000000000006';