-- Nova HRM phase 1: profiles, multi-company workspaces, memberships, invites

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  job_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  industry text,
  company_size text,
  tax_code text,
  address text,
  logo_url text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.companies enable row level security;

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'employee' check (role in ('owner','admin','hr','manager','employee')),
  status text not null default 'active' check (status in ('active','suspended')),
  job_title text,
  department text,
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  unique (company_id, user_id)
);
create index company_members_user_idx on public.company_members (user_id);
create index company_members_company_idx on public.company_members (company_id);
alter table public.company_members enable row level security;

create table public.company_invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  email text,
  role text not null default 'employee' check (role in ('owner','admin','hr','manager','employee')),
  job_title text,
  department text,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
create index company_invites_company_idx on public.company_invites (company_id);
alter table public.company_invites enable row level security;

-- ---------- security definer helpers (avoid recursive RLS) ----------
create or replace function public.is_company_member(target_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = target_company and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create or replace function public.company_role(target_company uuid)
returns text language sql stable security definer set search_path = public as $$
  select m.role from public.company_members m
  where m.company_id = target_company and m.user_id = auth.uid() and m.status = 'active'
  limit 1;
$$;

create or replace function public.has_company_role(target_company uuid, roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = target_company and m.user_id = auth.uid()
      and m.status = 'active' and m.role = any(roles)
  );
$$;

create or replace function public.shares_company_with(target_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.company_members me
    join public.company_members them on them.company_id = me.company_id
    where me.user_id = auth.uid() and them.user_id = target_user and me.status = 'active'
  );
$$;

create or replace function public.is_only_owner(target_company uuid, target_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members
    where company_id = target_company and user_id = target_user and role = 'owner'
  ) and (
    select count(*) from public.company_members
    where company_id = target_company and role = 'owner'
  ) <= 1;
$$;

-- ---------- triggers ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_new_company()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null then
    insert into public.company_members (company_id, user_id, role)
    values (new.id, new.created_by, 'owner')
    on conflict (company_id, user_id) do update set role = 'owner', status = 'active';
  end if;
  return new;
end;
$$;

create trigger on_company_created
  after insert on public.companies
  for each row execute function public.handle_new_company();

create or replace function public.guard_last_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  remaining int;
begin
  if old.role = 'owner' and (new.role <> 'owner' or new.status <> 'active') then
    select count(*) into remaining
    from public.company_members
    where company_id = old.company_id and role = 'owner' and status = 'active' and id <> old.id;
    if remaining = 0 then
      raise exception 'Công ty phải còn ít nhất một chủ sở hữu đang hoạt động.';
    end if;
  end if;
  return new;
end;
$$;

create trigger company_members_last_owner_guard
  before update on public.company_members
  for each row execute function public.guard_last_owner();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger companies_set_updated_at before update on public.companies
  for each row execute function public.set_updated_at();

-- ---------- RLS policies: profiles ----------
create policy "profiles_select_self_or_teammates" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_company_with(id));

create policy "profiles_insert_self" on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

create policy "profiles_update_self" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------- RLS policies: companies ----------
create policy "companies_select_member" on public.companies
  for select to authenticated
  using (public.is_company_member(id));

create policy "companies_insert_self" on public.companies
  for insert to authenticated
  with check (created_by = auth.uid());

create policy "companies_update_admin" on public.companies
  for update to authenticated
  using (public.has_company_role(id, array['owner','admin']))
  with check (public.has_company_role(id, array['owner','admin']));

create policy "companies_delete_owner" on public.companies
  for delete to authenticated
  using (public.has_company_role(id, array['owner']));

-- ---------- RLS policies: company_members ----------
create policy "members_select_teammates" on public.company_members
  for select to authenticated
  using (public.is_company_member(company_id));

create policy "members_insert_admin" on public.company_members
  for insert to authenticated
  with check (
    public.has_company_role(company_id, array['owner','admin'])
    and (role <> 'owner' or public.company_role(company_id) = 'owner')
  );

create policy "members_update_admin" on public.company_members
  for update to authenticated
  using (public.has_company_role(company_id, array['owner','admin']))
  with check (
    public.has_company_role(company_id, array['owner','admin'])
    and (role <> 'owner' or public.company_role(company_id) = 'owner')
  );

create policy "members_delete_admin_or_self" on public.company_members
  for delete to authenticated
  using (
    (
      (user_id = auth.uid() and role <> 'owner')
      or public.has_company_role(company_id, array['owner'])
      or (public.has_company_role(company_id, array['admin']) and role in ('hr','manager','employee'))
    )
    and not public.is_only_owner(company_id, user_id)
  );

-- ---------- RLS policies: company_invites ----------
create policy "invites_select_managers" on public.company_invites
  for select to authenticated
  using (public.has_company_role(company_id, array['owner','admin','hr']));

create policy "invites_insert_managers" on public.company_invites
  for insert to authenticated
  with check (
    public.has_company_role(company_id, array['owner','admin','hr'])
    and invited_by = auth.uid()
    and (role <> 'owner' or public.company_role(company_id) = 'owner')
  );

create policy "invites_update_managers" on public.company_invites
  for update to authenticated
  using (public.has_company_role(company_id, array['owner','admin','hr']))
  with check (public.has_company_role(company_id, array['owner','admin','hr']));

create policy "invites_delete_managers" on public.company_invites
  for delete to authenticated
  using (public.has_company_role(company_id, array['owner','admin','hr']));

-- ---------- RPC: accept invite ----------
create or replace function public.accept_company_invite(invite_token text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  inv public.company_invites;
  actor uuid := auth.uid();
  actor_email text;
begin
  if actor is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into inv from public.company_invites where token = invite_token for update;
  if not found then raise exception 'INVITE_NOT_FOUND'; end if;
  if inv.revoked then raise exception 'INVITE_REVOKED'; end if;
  if inv.accepted_at is not null then raise exception 'INVITE_USED'; end if;
  if inv.expires_at < now() then raise exception 'INVITE_EXPIRED'; end if;

  select lower(email) into actor_email from auth.users where id = actor;
  if inv.email is not null and lower(inv.email) <> coalesce(actor_email, '') then
    raise exception 'INVITE_EMAIL_MISMATCH';
  end if;

  insert into public.company_members (company_id, user_id, role, job_title, department, invited_by)
  values (inv.company_id, actor, inv.role, inv.job_title, inv.department, inv.invited_by)
  on conflict (company_id, user_id) do update set status = 'active';

  update public.company_invites
  set accepted_at = now(), accepted_by = actor
  where id = inv.id;

  return inv.company_id;
end;
$$;

-- ---------- RPC: peek invite (invite link landing page) ----------
create or replace function public.peek_company_invite(invite_token text)
returns table (
  company_id uuid,
  company_name text,
  role text,
  email text,
  expires_at timestamptz,
  accepted_at timestamptz,
  revoked boolean
) language sql stable security definer set search_path = public as $$
  select i.company_id, c.name, i.role, i.email, i.expires_at, i.accepted_at, i.revoked
  from public.company_invites i
  join public.companies c on c.id = i.company_id
  where i.token = invite_token;
$$;

revoke all on function public.accept_company_invite(text) from anon;
revoke all on function public.peek_company_invite(text) from anon;
grant execute on function public.accept_company_invite(text) to authenticated;
grant execute on function public.peek_company_invite(text) to authenticated;