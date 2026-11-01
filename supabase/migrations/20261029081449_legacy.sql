alter table public.recruitment_campaigns
  add column if not exists code text;

update public.recruitment_campaigns c
set code = 'CD-' || extract(year from coalesce(c.created_at, now()))::int || '-' || lpad(sub.rn::text, 3, '0')
from (
  select id, row_number() over (partition by company_id order by created_at) as rn
  from public.recruitment_campaigns
) sub
where c.id = sub.id and c.code is null;

create table public.candidate_applications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  campaign_id uuid not null references public.recruitment_campaigns(id) on delete cascade,
  status text not null default 'received',
  note text,
  rejection_reason text,
  applied_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index candidate_applications_candidate_idx on public.candidate_applications (candidate_id);
create index candidate_applications_campaign_idx on public.candidate_applications (campaign_id);
alter table public.candidate_applications enable row level security;
create policy "candidate_applications_select" on public.candidate_applications for select to authenticated
  using (public.has_company_role(company_id, array['owner','admin','hr','manager']));
create policy "candidate_applications_insert" on public.candidate_applications for insert to authenticated
  with check (public.has_company_role(company_id, array['owner','admin','hr']));
create policy "candidate_applications_update" on public.candidate_applications for update to authenticated
  using (public.has_company_role(company_id, array['owner','admin','hr']))
  with check (public.has_company_role(company_id, array['owner','admin','hr']));
create policy "candidate_applications_delete" on public.candidate_applications for delete to authenticated
  using (public.has_company_role(company_id, array['owner','admin','hr']));

insert into public.candidate_applications (company_id, candidate_id, campaign_id, status, applied_at)
select c.company_id, c.id, c.campaign_id, c.status, coalesce(c.applied_at, c.created_at)
from public.candidates c
where c.campaign_id is not null
  and not exists (
    select 1 from public.candidate_applications a
    where a.candidate_id = c.id and a.campaign_id = c.campaign_id
  );