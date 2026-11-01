create or replace function public.can_create_recruitment(target_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_permission(target_company, 'recruitment.create')
    or public.has_permission(target_company, 'recruitment.manage');
$$;

create or replace function public.can_edit_recruitment(target_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_permission(target_company, 'recruitment.edit')
    or public.has_permission(target_company, 'recruitment.manage');
$$;

create or replace function public.can_delete_recruitment(target_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_permission(target_company, 'recruitment.delete')
    or public.has_permission(target_company, 'recruitment.manage');
$$;

alter policy "jd_insert" on public.job_descriptions
  with check (public.can_create_recruitment(company_id));
alter policy "jd_update" on public.job_descriptions
  using (public.can_edit_recruitment(company_id)) with check (public.can_edit_recruitment(company_id));
alter policy "jd_delete" on public.job_descriptions
  using (public.can_delete_recruitment(company_id));

alter policy "campaigns_insert" on public.recruitment_campaigns
  with check (public.can_create_recruitment(company_id));
alter policy "campaigns_update" on public.recruitment_campaigns
  using (public.can_edit_recruitment(company_id)) with check (public.can_edit_recruitment(company_id));
alter policy "campaigns_delete" on public.recruitment_campaigns
  using (public.can_delete_recruitment(company_id));

alter policy "candidates_insert" on public.candidates
  with check (public.can_create_recruitment(company_id));
alter policy "candidates_update" on public.candidates
  using (public.can_edit_recruitment(company_id)) with check (public.can_edit_recruitment(company_id));
alter policy "candidates_delete" on public.candidates
  using (public.can_delete_recruitment(company_id));

alter policy "interviews_insert" on public.candidate_interviews
  with check (public.can_create_recruitment(company_id));
alter policy "interviews_update" on public.candidate_interviews
  using (public.can_edit_recruitment(company_id)) with check (public.can_edit_recruitment(company_id));
alter policy "interviews_delete" on public.candidate_interviews
  using (public.can_delete_recruitment(company_id));

alter policy "offers_insert" on public.candidate_offers
  with check (public.can_create_recruitment(company_id));
alter policy "offers_update" on public.candidate_offers
  using (public.can_edit_recruitment(company_id)) with check (public.can_edit_recruitment(company_id));
alter policy "offers_delete" on public.candidate_offers
  using (public.can_delete_recruitment(company_id));

alter policy "candidate_applications_insert" on public.candidate_applications
  with check (public.can_create_recruitment(company_id));
alter policy "candidate_applications_update" on public.candidate_applications
  using (public.can_edit_recruitment(company_id)) with check (public.can_edit_recruitment(company_id));
alter policy "candidate_applications_delete" on public.candidate_applications
  using (public.can_delete_recruitment(company_id));

alter policy "emails_insert" on public.candidate_emails
  with check (public.can_create_recruitment(company_id));
alter policy "emails_delete" on public.candidate_emails
  using (public.can_delete_recruitment(company_id));

alter policy "recruitment_cvs_write" on storage.objects
  with check (
    bucket_id = 'recruitment-cvs'
    and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/'
    and (public.can_create_recruitment((split_part(name, '/', 1))::uuid)
      or public.can_edit_recruitment((split_part(name, '/', 1))::uuid))
  );
alter policy "recruitment_cvs_delete" on storage.objects
  using (
    bucket_id = 'recruitment-cvs'
    and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/'
    and (public.can_delete_recruitment((split_part(name, '/', 1))::uuid)
      or public.can_edit_recruitment((split_part(name, '/', 1))::uuid))
  );