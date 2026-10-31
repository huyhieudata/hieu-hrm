-- Demo: give the pending onboarding record a partially completed checklist (2/6)
update public.onboarding_records r
set checklist = (
  select jsonb_agg(
    jsonb_build_object('id', t.id, 'label', t.label, 'required', t.required, 'completed', t.sort_order <= 2)
    order by t.sort_order
  )
  from public.onboarding_checklist_templates t
  where t.company_id = r.company_id
)
where r.candidate_id = 'd3000000-0000-4000-8000-000000000006' and r.status = 'pending';