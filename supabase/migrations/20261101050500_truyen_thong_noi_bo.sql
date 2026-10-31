-- Mô-đun 5: Truyền thông nội bộ (tin tức + danh mục).
-- Quyền mới: news.view/create/edit/delete. owner/admin/hr được toàn quyền,
-- manager/employee được xem. Bài chỉ hiện với mọi thành viên khi đã đăng (BR-5.1).

create or replace function public.all_permission_keys()
returns text[] language sql immutable set search_path = public as $$
  select array_cat(
    array(
      select m || '.' || a
      from unnest(array[
        'employees','contracts','insurance','attendance','shifts','requests','leave',
        'payroll','recruitment','planning','members','settings','assets','onboarding','news'
      ]) as m
      cross join unnest(array['view','create','edit','delete']) as a
    ),
    array[
      'company.manage','members.view','members.invite','members.manage',
      'employees.view','employees.manage','recruitment.view','recruitment.manage',
      'attendance.view','attendance.manage','leave.view','leave.approve',
      'payroll.view','payroll.manage'
    ]::text[]
  );
$$;

create or replace function public.default_role_permissions(target_role text)
returns text[] language sql immutable set search_path = public as $$
  select case target_role
    when 'owner' then public.all_permission_keys()
    when 'admin' then public.all_permission_keys()
    when 'hr' then (
      select array_agg(key)
      from unnest(public.all_permission_keys()) as key
      where key not in (
        'company.manage','members.manage',
        'members.create','members.edit','members.delete'
      )
    )
    when 'manager' then array[
      'employees.view','attendance.view','shifts.view','requests.view','requests.edit',
      'leave.view','leave.approve','recruitment.view','recruitment.edit',
      'onboarding.view','assets.view','members.view','news.view'
    ]::text[]
    when 'employee' then array[
      'employees.view','attendance.view','requests.view','leave.view','assets.view','members.view',
      'news.view'
    ]::text[]
    else '{}'::text[]
  end;
$$;

-- Bổ sung quyền tin tức cho cấu hình vai trò đã lưu (chỉ thêm, không bớt quyền nào).
update public.company_role_permissions crp
set permissions = (
  select array_agg(distinct k) from unnest(
    crp.permissions || case
      when crp.role in ('admin','hr') then array['news.view','news.create','news.edit','news.delete']
      else array['news.view'] end
  ) as k
)
where crp.role in ('admin','hr','manager','employee')
  and not ('news.view' = any(crp.permissions));

create table if not exists public.news_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists news_categories_company_name_uidx
  on public.news_categories (company_id, lower(btrim(name)));

create table if not exists public.news_posts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  -- BR-5.2: không xoá được danh mục còn bài, phải chuyển bài trước.
  category_id uuid references public.news_categories(id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 300),
  summary text,
  content text not null default '',
  cover_image_url text check (cover_image_url is null or cover_image_url ~* '^https://'),
  status text not null default 'draft' check (status in ('draft','published','hidden')),
  show_on_home boolean not null default true,
  pinned boolean not null default false,
  published_at timestamptz,
  author_id uuid default auth.uid(),
  author_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists news_posts_company_published_idx
  on public.news_posts (company_id, status, published_at desc);
create index if not exists news_posts_category_idx on public.news_posts (category_id);

-- Danh mục phải cùng công ty; tự đặt thời gian đăng, người đăng.
create or replace function public.news_posts_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.news_categories c where c.id = new.category_id and c.company_id = new.company_id
  ) then
    raise exception 'Danh mục không thuộc công ty này.';
  end if;
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  if tg_op = 'INSERT' then
    new.author_id := auth.uid();
    new.author_name := (select full_name from public.profiles where id = auth.uid());
  else
    new.author_id := old.author_id;
    new.author_name := old.author_name;
    new.company_id := old.company_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.news_posts_before_write() from public, anon, authenticated;

drop trigger if exists news_posts_before_write on public.news_posts;
create trigger news_posts_before_write before insert or update on public.news_posts
  for each row execute function public.news_posts_before_write();

drop trigger if exists news_categories_updated_at on public.news_categories;
create trigger news_categories_updated_at before update on public.news_categories
  for each row execute function public.set_updated_at();

alter table public.news_categories enable row level security;
alter table public.news_posts enable row level security;

revoke all on public.news_categories from anon;
revoke all on public.news_posts from anon;
grant select, insert, update, delete on public.news_categories to authenticated;
grant select, insert, update, delete on public.news_posts to authenticated;

create policy "news_categories_select" on public.news_categories
  for select to authenticated using (public.is_company_member(company_id));
create policy "news_categories_insert" on public.news_categories
  for insert to authenticated with check (public.has_permission(company_id, 'news.create'));
create policy "news_categories_update" on public.news_categories
  for update to authenticated using (public.has_permission(company_id, 'news.edit'))
  with check (public.has_permission(company_id, 'news.edit'));
create policy "news_categories_delete" on public.news_categories
  for delete to authenticated using (public.has_permission(company_id, 'news.delete'));

create policy "news_posts_select" on public.news_posts
  for select to authenticated using (
    public.has_permission(company_id, 'news.edit')
    or public.has_permission(company_id, 'news.create')
    or (
      status = 'published' and published_at <= now()
      and public.has_permission(company_id, 'news.view')
    )
  );
create policy "news_posts_insert" on public.news_posts
  for insert to authenticated with check (public.has_permission(company_id, 'news.create'));
create policy "news_posts_update" on public.news_posts
  for update to authenticated using (public.has_permission(company_id, 'news.edit'))
  with check (public.has_permission(company_id, 'news.edit'));
create policy "news_posts_delete" on public.news_posts
  for delete to authenticated using (public.has_permission(company_id, 'news.delete'));
