-- Advisors hiệu năng: index cho khoá ngoại chưa có index + auth_rls_initplan (survey_responses). Idempotent.
create index if not exists attendance_qr_secrets_company_id_idx on public.attendance_qr_secrets(company_id);
create index if not exists attendance_qr_uses_location_id_idx on public.attendance_qr_uses(location_id);
create index if not exists company_documents_created_by_idx on public.company_documents(created_by);
create index if not exists survey_responses_company_id_idx on public.survey_responses(company_id);
create index if not exists survey_responses_user_id_idx on public.survey_responses(user_id);
create index if not exists surveys_created_by_idx on public.surveys(created_by);
create index if not exists user_notifications_company_id_idx on public.user_notifications(company_id);

do $$
declare p record; q text; w text;
begin
  for p in select policyname, qual, with_check from pg_policies
           where schemaname='public' and tablename='survey_responses'
             and policyname in ('survey_responses_insert','survey_responses_select') loop
    q := p.qual; w := p.with_check;
    if q is not null and q !~* 'select auth\.uid\(\)' then
      execute format('alter policy %I on public.survey_responses using (%s)', p.policyname,
        replace(q, 'auth.uid()', '(select auth.uid())'));
    end if;
    if w is not null and w !~* 'select auth\.uid\(\)' then
      execute format('alter policy %I on public.survey_responses with check (%s)', p.policyname,
        replace(w, 'auth.uid()', '(select auth.uid())'));
    end if;
  end loop;
end $$;
