-- ================= RECRUITMENT MODULE =================

create or replace function public.can_view_recruitment(target_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_company_role(target_company, array['owner','admin','hr','manager']);
$$;

create or replace function public.can_manage_recruitment(target_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_company_role(target_company, array['owner','admin','hr']);
$$;

create table public.job_descriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text,
  title text not null,
  department text,
  level text,
  employment_type text,
  location text,
  salary_min numeric(14,2),
  salary_max numeric(14,2),
  summary text,
  responsibilities text,
  requirements text,
  benefits text,
  status text not null default 'draft' check (status in ('draft','open','closed')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index job_descriptions_company_idx on public.job_descriptions (company_id);
alter table public.job_descriptions enable row level security;

create table public.recruitment_campaigns (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  job_description_id uuid references public.job_descriptions(id) on delete set null,
  title text not null,
  department text,
  headcount integer not null default 1 check (headcount > 0),
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'open' check (status in ('draft','open','on_hold','closed')),
  start_date date,
  end_date date,
  hiring_manager text,
  description text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recruitment_campaigns_company_idx on public.recruitment_campaigns (company_id);
alter table public.recruitment_campaigns enable row level security;

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  campaign_id uuid references public.recruitment_campaigns(id) on delete set null,
  full_name text not null,
  email text,
  phone text,
  date_of_birth date,
  gender text,
  address text,
  position_applied text,
  source text,
  experience_years numeric(4,1),
  current_salary numeric(14,2),
  expected_salary numeric(14,2),
  education text,
  status text not null default 'received' check (status in (
    'received','screening','qualified','interview_scheduled','interview_declined',
    'interview_attended','interview_passed','interview_failed','rejected','offer_sent','offer_accepted'
  )),
  note text,
  cv_url text,
  form_token text unique default replace(gen_random_uuid()::text, '-', ''),
  form_sent_at timestamptz,
  form_submitted_at timestamptz,
  profile_data jsonb,
  applied_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index candidates_company_idx on public.candidates (company_id);
create index candidates_status_idx on public.candidates (company_id, status);
alter table public.candidates enable row level security;

create table public.candidate_interviews (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 60,
  mode text not null default 'onsite' check (mode in ('onsite','online','phone')),
  location text,
  interviewer text,
  status text not null default 'scheduled' check (status in ('scheduled','completed','cancelled','no_show')),
  note text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index candidate_interviews_company_idx on public.candidate_interviews (company_id, scheduled_at);
alter table public.candidate_interviews enable row level security;

create table public.candidate_comments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  author_id uuid default auth.uid() references auth.users(id) on delete set null,
  author_name text,
  content text not null,
  created_at timestamptz not null default now()
);
create index candidate_comments_company_idx on public.candidate_comments (candidate_id);
alter table public.candidate_comments enable row level security;

create table public.candidate_emails (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  subject text not null,
  body text,
  sent_to text,
  template text,
  status text not null default 'sent' check (status in ('sent','failed')),
  sent_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null
);
create index candidate_emails_company_idx on public.candidate_emails (candidate_id);
alter table public.candidate_emails enable row level security;

-- updated_at triggers
create trigger job_descriptions_set_updated_at before update on public.job_descriptions
  for each row execute function public.set_updated_at();
create trigger recruitment_campaigns_set_updated_at before update on public.recruitment_campaigns
  for each row execute function public.set_updated_at();
create trigger candidates_set_updated_at before update on public.candidates
  for each row execute function public.set_updated_at();

-- child tables inherit company from the candidate
create or replace function public.stamp_candidate_company()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select company_id into new.company_id from public.candidates where id = new.candidate_id;
  if new.company_id is null then
    raise exception 'CANDIDATE_NOT_FOUND';
  end if;
  return new;
end;
$$;

create trigger stamp_company_interviews before insert on public.candidate_interviews
  for each row execute function public.stamp_candidate_company();
create trigger stamp_company_comments before insert on public.candidate_comments
  for each row execute function public.stamp_candidate_company();
create trigger stamp_company_emails before insert on public.candidate_emails
  for each row execute function public.stamp_candidate_company();

-- policies
create policy "jd_select" on public.job_descriptions for select to authenticated using (public.can_view_recruitment(company_id));
create policy "jd_insert" on public.job_descriptions for insert to authenticated with check (public.can_manage_recruitment(company_id));
create policy "jd_update" on public.job_descriptions for update to authenticated using (public.can_manage_recruitment(company_id)) with check (public.can_manage_recruitment(company_id));
create policy "jd_delete" on public.job_descriptions for delete to authenticated using (public.can_manage_recruitment(company_id));

create policy "campaigns_select" on public.recruitment_campaigns for select to authenticated using (public.can_view_recruitment(company_id));
create policy "campaigns_insert" on public.recruitment_campaigns for insert to authenticated with check (public.can_manage_recruitment(company_id));
create policy "campaigns_update" on public.recruitment_campaigns for update to authenticated using (public.can_manage_recruitment(company_id)) with check (public.can_manage_recruitment(company_id));
create policy "campaigns_delete" on public.recruitment_campaigns for delete to authenticated using (public.can_manage_recruitment(company_id));

create policy "candidates_select" on public.candidates for select to authenticated using (public.can_view_recruitment(company_id));
create policy "candidates_insert" on public.candidates for insert to authenticated with check (public.can_manage_recruitment(company_id));
create policy "candidates_update" on public.candidates for update to authenticated using (public.can_manage_recruitment(company_id)) with check (public.can_manage_recruitment(company_id));
create policy "candidates_delete" on public.candidates for delete to authenticated using (public.can_manage_recruitment(company_id));

create policy "interviews_select" on public.candidate_interviews for select to authenticated using (public.can_view_recruitment(company_id));
create policy "interviews_insert" on public.candidate_interviews for insert to authenticated with check (public.can_manage_recruitment(company_id));
create policy "interviews_update" on public.candidate_interviews for update to authenticated using (public.can_manage_recruitment(company_id)) with check (public.can_manage_recruitment(company_id));
create policy "interviews_delete" on public.candidate_interviews for delete to authenticated using (public.can_manage_recruitment(company_id));

create policy "comments_select" on public.candidate_comments for select to authenticated using (public.can_view_recruitment(company_id));
create policy "comments_insert" on public.candidate_comments for insert to authenticated with check (public.can_view_recruitment(company_id) and author_id = auth.uid());
create policy "comments_delete" on public.candidate_comments for delete to authenticated using (public.can_manage_recruitment(company_id) or author_id = auth.uid());

create policy "emails_select" on public.candidate_emails for select to authenticated using (public.can_view_recruitment(company_id));
create policy "emails_insert" on public.candidate_emails for insert to authenticated with check (public.can_manage_recruitment(company_id));
create policy "emails_delete" on public.candidate_emails for delete to authenticated using (public.can_manage_recruitment(company_id));

-- public self-declaration form via token (no anonymous table access)
create or replace function public.peek_candidate_form(form_token text)
returns table (
  candidate_name text,
  position_applied text,
  company_name text,
  already_submitted boolean
) language sql stable security definer set search_path = public as $$
  select c.full_name, c.position_applied, co.name, c.form_submitted_at is not null
  from public.candidates c
  join public.companies co on co.id = c.company_id
  where c.form_token = form_token
  limit 1;
$$;

create or replace function public.submit_candidate_form(form_token text, payload jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  target public.candidates;
begin
  select * into target from public.candidates where form_token = form_token limit 1;
  if not found then
    raise exception 'FORM_NOT_FOUND';
  end if;

  update public.candidates
  set full_name = coalesce(nullif(payload->>'full_name', ''), full_name),
      email = coalesce(nullif(payload->>'email', ''), email),
      phone = coalesce(nullif(payload->>'phone', ''), phone),
      date_of_birth = nullif(payload->>'date_of_birth', '')::date,
      gender = nullif(payload->>'gender', ''),
      address = nullif(payload->>'address', ''),
      position_applied = coalesce(nullif(payload->>'position_applied', ''), position_applied),
      experience_years = nullif(payload->>'experience_years', '')::numeric,
      current_salary = nullif(payload->>'current_salary', '')::numeric,
      expected_salary = nullif(payload->>'expected_salary', '')::numeric,
      education = nullif(payload->>'education', ''),
      note = nullif(payload->>'note', ''),
      profile_data = payload,
      form_submitted_at = now()
  where id = target.id;

  return true;
end;
$$;

revoke all on function public.peek_candidate_form(text) from public;
revoke all on function public.submit_candidate_form(text, jsonb) from public;
grant execute on function public.peek_candidate_form(text) to anon, authenticated;
grant execute on function public.submit_candidate_form(text, jsonb) to anon, authenticated;