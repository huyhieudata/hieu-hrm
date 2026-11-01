create table public.onboarding_comments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  onboarding_id uuid not null references public.onboarding_records(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  author_name text,
  content text not null,
  created_at timestamptz not null default now()
);
create index onboarding_comments_record_idx on public.onboarding_comments (onboarding_id, created_at);
alter table public.onboarding_comments enable row level security;
create policy "onboarding_comments_select" on public.onboarding_comments for select to authenticated
  using (public.has_company_role(company_id, array['owner','admin','hr','manager']));
create policy "onboarding_comments_insert" on public.onboarding_comments for insert to authenticated
  with check (public.has_company_role(company_id, array['owner','admin','hr','manager']) and author_id = auth.uid());
create policy "onboarding_comments_delete" on public.onboarding_comments for delete to authenticated
  using (author_id = auth.uid() or public.has_company_role(company_id, array['owner','admin','hr']));