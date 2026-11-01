-- Khảo sát nội bộ + Tài liệu công ty (Storage private). RLS theo công ty.

create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  description text,
  -- [{id, type: 'single'|'multi'|'text'|'rating', label, options: [..]}]
  questions jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
  status text not null default 'open' check (status in ('draft','open','closed')),
  anonymous boolean not null default false,
  closes_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists surveys_company_idx on public.surveys (company_id, created_at desc);
alter table public.surveys enable row level security;

drop policy if exists surveys_select on public.surveys;
create policy surveys_select on public.surveys for select to authenticated using (
  public.has_company_role(company_id, array['owner','admin','hr'])
  or (status <> 'draft' and public.is_company_member(company_id))
);
drop policy if exists surveys_write on public.surveys;
create policy surveys_write on public.surveys for all to authenticated
  using (public.has_company_role(company_id, array['owner','admin','hr']))
  with check (public.has_company_role(company_id, array['owner','admin','hr']));

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  created_at timestamptz not null default now(),
  unique (survey_id, user_id)
);
alter table public.survey_responses enable row level security;

-- Nhân viên chỉ thấy/ghi câu trả lời của mình; HR xem kết quả qua RPC survey_results (ẩn danh nếu khảo sát ẩn danh).
drop policy if exists survey_responses_select on public.survey_responses;
create policy survey_responses_select on public.survey_responses for select to authenticated using (user_id = auth.uid());
drop policy if exists survey_responses_insert on public.survey_responses;
create policy survey_responses_insert on public.survey_responses for insert to authenticated with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.surveys s
    where s.id = survey_id and s.company_id = survey_responses.company_id and s.status = 'open'
      and (s.closes_at is null or s.closes_at > now())
      and public.is_company_member(s.company_id)
  )
);

create or replace function public.survey_results(p_survey_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_s public.surveys;
begin
  select * into v_s from public.surveys where id = p_survey_id;
  if v_s.id is null or not public.has_company_role(v_s.company_id, array['owner','admin','hr']) then
    raise exception 'Bạn không có quyền xem kết quả khảo sát này.';
  end if;
  return jsonb_build_object(
    'survey', to_jsonb(v_s),
    'members', (select count(*) from public.company_members m where m.company_id = v_s.company_id and m.status = 'active'),
    'responses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'answers', r.answers, 'created_at', r.created_at,
        'name', case when v_s.anonymous then null else coalesce(p.full_name, u.email) end
      ) order by r.created_at)
      from public.survey_responses r
      left join public.profiles p on p.id = r.user_id
      left join auth.users u on u.id = r.user_id
      where r.survey_id = v_s.id
    ), '[]'::jsonb)
  );
end $$;
revoke all on function public.survey_results(uuid) from public, anon;
grant execute on function public.survey_results(uuid) to authenticated;

-- Tài liệu công ty
create table if not exists public.company_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 200),
  category text not null default 'Chung',
  description text,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists company_documents_company_idx on public.company_documents (company_id, created_at desc);
alter table public.company_documents enable row level security;
drop policy if exists company_documents_select on public.company_documents;
create policy company_documents_select on public.company_documents for select to authenticated
  using (public.is_company_member(company_id));
drop policy if exists company_documents_write on public.company_documents;
create policy company_documents_write on public.company_documents for all to authenticated
  using (public.has_company_role(company_id, array['owner','admin','hr']))
  with check (
    public.has_company_role(company_id, array['owner','admin','hr'])
    and storage_path like company_id::text || '/%'
  );

insert into storage.buckets (id, name, public, file_size_limit)
values ('company-docs', 'company-docs', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Đường dẫn: <company_id>/<uuid>-<tên tệp>. Đọc: thành viên công ty; ghi/xoá: owner/admin/hr.
drop policy if exists company_docs_read on storage.objects;
create policy company_docs_read on storage.objects for select to authenticated using (
  bucket_id = 'company-docs'
  and name ~ '^[0-9a-fA-F-]{36}/'
  and public.is_company_member(((storage.foldername(name))[1])::uuid)
);
drop policy if exists company_docs_insert on storage.objects;
create policy company_docs_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'company-docs'
  and name ~ '^[0-9a-fA-F-]{36}/'
  and public.has_company_role(((storage.foldername(name))[1])::uuid, array['owner','admin','hr'])
);
drop policy if exists company_docs_delete on storage.objects;
create policy company_docs_delete on storage.objects for delete to authenticated using (
  bucket_id = 'company-docs'
  and name ~ '^[0-9a-fA-F-]{36}/'
  and public.has_company_role(((storage.foldername(name))[1])::uuid, array['owner','admin','hr'])
);
