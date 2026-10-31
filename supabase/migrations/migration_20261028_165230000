create table public.candidate_offers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  position text,
  department text,
  base_salary numeric(14,2),
  allowance numeric(14,2),
  other_benefits text,
  onboarding_date date,
  work_location text,
  status text not null default 'draft' check (status in ('draft','sent','accepted','declined')),
  note text,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index candidate_offers_candidate_idx on public.candidate_offers (candidate_id);
alter table public.candidate_offers enable row level security;

create trigger candidate_offers_set_updated_at before update on public.candidate_offers
  for each row execute function public.set_updated_at();
create trigger stamp_company_offers before insert on public.candidate_offers
  for each row execute function public.stamp_candidate_company();

create policy "offers_select" on public.candidate_offers
  for select to authenticated using (public.can_view_recruitment(company_id));
create policy "offers_insert" on public.candidate_offers
  for insert to authenticated with check (public.can_manage_recruitment(company_id));
create policy "offers_update" on public.candidate_offers
  for update to authenticated using (public.can_manage_recruitment(company_id)) with check (public.can_manage_recruitment(company_id));
create policy "offers_delete" on public.candidate_offers
  for delete to authenticated using (public.can_manage_recruitment(company_id));

-- Move the previously captured hiring details into offers
insert into public.candidate_offers (
  company_id, candidate_id, position, base_salary, onboarding_date, work_location, status, note
)
select
  c.company_id,
  c.id,
  c.position_applied,
  c.hired_salary,
  c.onboarding_date,
  c.work_location,
  case
    when c.status in ('offer_accepted', 'started') then 'accepted'
    when c.status = 'offer_declined' then 'declined'
    when c.status = 'offer_sent' then 'sent'
    else 'draft'
  end,
  'Chuyển từ thông tin nhận việc đã nhập trước đây.'
from public.candidates c
where c.hired_salary is not null or c.onboarding_date is not null or c.work_location is not null;