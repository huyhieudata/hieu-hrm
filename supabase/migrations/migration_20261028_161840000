alter table public.candidates
  add column if not exists cv_path text,
  add column if not exists cv_file_name text;

create table public.candidate_evaluations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  reviewer_id uuid default auth.uid() references auth.users(id) on delete set null,
  reviewer_name text,
  technical_score integer check (technical_score between 1 and 5),
  communication_score integer check (communication_score between 1 and 5),
  culture_score integer check (culture_score between 1 and 5),
  attitude_score integer check (attitude_score between 1 and 5),
  recommendation text not null default 'hold' check (recommendation in ('advance','hold','reject')),
  strengths text,
  weaknesses text,
  note text,
  created_at timestamptz not null default now()
);
create index candidate_evaluations_candidate_idx on public.candidate_evaluations (candidate_id);
alter table public.candidate_evaluations enable row level security;

create trigger stamp_company_evaluations before insert on public.candidate_evaluations
  for each row execute function public.stamp_candidate_company();

create policy "evaluations_select" on public.candidate_evaluations
  for select to authenticated using (public.can_view_recruitment(company_id));
create policy "evaluations_insert" on public.candidate_evaluations
  for insert to authenticated
  with check (public.can_view_recruitment(company_id) and reviewer_id = auth.uid());
create policy "evaluations_update" on public.candidate_evaluations
  for update to authenticated
  using (public.can_manage_recruitment(company_id) or reviewer_id = auth.uid())
  with check (public.can_view_recruitment(company_id));
create policy "evaluations_delete" on public.candidate_evaluations
  for delete to authenticated
  using (public.can_manage_recruitment(company_id) or reviewer_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recruitment-cvs',
  'recruitment-cvs',
  false,
  10 * 1024 * 1024,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg', 'image/png', 'image/webp'
  ]::text[]
)
on conflict (id) do nothing;

create policy "recruitment_cvs_read"
on storage.objects for select to authenticated
using (
  bucket_id = 'recruitment-cvs'
  and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/'
  and public.can_view_recruitment(split_part(name, '/', 1)::uuid)
);

create policy "recruitment_cvs_write"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'recruitment-cvs'
  and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/'
  and public.can_manage_recruitment(split_part(name, '/', 1)::uuid)
);

create policy "recruitment_cvs_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'recruitment-cvs'
  and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/'
  and public.can_manage_recruitment(split_part(name, '/', 1)::uuid)
);