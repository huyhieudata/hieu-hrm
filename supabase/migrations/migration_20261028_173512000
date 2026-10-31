-- Sample data variety: one partially completed onboarding, one withdrawn record
update public.onboarding_records r
set checklist = (
  select jsonb_agg(
    jsonb_build_object('id', t.id, 'label', t.label, 'required', t.required, 'completed', t.sort_order <= 3)
    order by t.sort_order
  )
  from public.onboarding_checklist_templates t
  where t.company_id = r.company_id
),
status = 'in_progress'
where r.candidate_id = 'd3000000-0000-4000-8000-000000000009' and r.status = 'pending';

update public.candidates set status = 'offer_declined' where id = 'd3000000-0000-4000-8000-00000000000a';