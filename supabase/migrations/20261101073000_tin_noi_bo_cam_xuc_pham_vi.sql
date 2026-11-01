-- Tin nội bộ: (1) giới hạn người xem theo phòng ban, (2) thả cảm xúc.
-- audience_department_ids rỗng = cả công ty (mặc định). Có giá trị: chỉ nhân viên thuộc các phòng ban đó
-- (kể cả phòng ban con) mới xem; người có news.create/news.edit vẫn xem mọi bài để quản lý.

alter table public.news_posts
  add column if not exists audience_department_ids uuid[] not null default '{}';

create or replace function public.news_audience_includes_me(p_company uuid, p_departments uuid[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(cardinality(p_departments), 0) = 0
    or exists (
      with recursive tree as (
        select d.id from public.departments d
        where d.company_id = p_company and d.id = any(p_departments)
        union
        select c.id from public.departments c join tree t on c.parent_id = t.id
        where c.company_id = p_company
      )
      select 1 from public.employees e
      join tree on tree.id = e.department_id
      where e.company_id = p_company and e.user_id = auth.uid()
    );
$$;
revoke all on function public.news_audience_includes_me(uuid, uuid[]) from public, anon;
grant execute on function public.news_audience_includes_me(uuid, uuid[]) to authenticated;

create or replace function public.validate_news_audience()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.audience_department_ids := coalesce(array(select distinct x from unnest(new.audience_department_ids) x), '{}');
  if exists (
    select 1 from unnest(new.audience_department_ids) x
    where not exists (select 1 from public.departments d where d.id = x and d.company_id = new.company_id)
  ) then
    raise exception 'Phòng ban nhận tin không thuộc công ty.';
  end if;
  return new;
end $$;
revoke all on function public.validate_news_audience() from public, anon, authenticated;
drop trigger if exists validate_news_audience on public.news_posts;
create trigger validate_news_audience before insert or update of audience_department_ids, company_id on public.news_posts
  for each row execute function public.validate_news_audience();

drop policy if exists "news_posts_select" on public.news_posts;
create policy "news_posts_select" on public.news_posts
  for select to authenticated using (
    public.has_permission(company_id, 'news.edit')
    or public.has_permission(company_id, 'news.create')
    or (
      status = 'published' and published_at <= now()
      and public.has_permission(company_id, 'news.view')
      and public.news_audience_includes_me(company_id, audience_department_ids)
    )
  );

create table if not exists public.news_reactions (
  post_id uuid not null references public.news_posts(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('like','love','haha','wow','sad','clap')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists news_reactions_company_idx on public.news_reactions(company_id);

create or replace function public.set_news_reaction_company()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select p.company_id into new.company_id from public.news_posts p where p.id = new.post_id;
  if new.company_id is null then raise exception 'Bài viết không tồn tại.'; end if;
  if tg_op = 'UPDATE' and (new.post_id <> old.post_id or new.user_id <> old.user_id) then
    raise exception 'Không đổi được bài viết/người thả cảm xúc.';
  end if;
  return new;
end $$;
revoke all on function public.set_news_reaction_company() from public, anon, authenticated;
drop trigger if exists set_news_reaction_company on public.news_reactions;
create trigger set_news_reaction_company before insert or update on public.news_reactions
  for each row execute function public.set_news_reaction_company();

alter table public.news_reactions enable row level security;
-- Thấy cảm xúc của bài mình xem được (subquery chịu RLS của news_posts).
create policy "news_reactions_select" on public.news_reactions for select to authenticated
  using (exists (select 1 from public.news_posts p where p.id = post_id));
-- Chỉ thả cảm xúc của chính mình vào bài đã đăng mà mình xem được.
create policy "news_reactions_insert" on public.news_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.news_posts p where p.id = post_id and p.status = 'published' and p.published_at <= now())
  );
create policy "news_reactions_update" on public.news_reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "news_reactions_delete" on public.news_reactions for delete to authenticated
  using (user_id = auth.uid());
revoke all on public.news_reactions from anon;
grant select, insert, update, delete on public.news_reactions to authenticated;
