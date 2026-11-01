-- Demo: give campaigns realistic hiring deadlines (days from start date)
update public.recruitment_campaigns set sla_days = 45 where id = 'd2000000-0000-4000-8000-000000000001';
update public.recruitment_campaigns set sla_days = 30 where id = 'd2000000-0000-4000-8000-000000000002';
update public.recruitment_campaigns set sla_days = 30 where id = 'd2000000-0000-4000-8000-000000000003';