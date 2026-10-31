-- Mô-đun 4: Đánh giá – biểu mẫu tiêu chí (AC-4.1) và phiếu đánh giá theo biểu mẫu,
-- gắn với ứng viên + vòng phỏng vấn (AC-4.2), khoá phiếu đã nộp (BR-4.2, AC-4.3).
-- Quyền mới evaluations.view/create/edit/delete: owner/admin/hr toàn quyền, manager được xem
-- biểu mẫu. Phiếu đánh giá ứng viên vẫn theo quyền tuyển dụng như cũ.

create or replace function public.all_permission_keys()
returns text[] language sql immutable set search_path = public as $$
  select array_cat(
    array(
      select m || '.' || a
      from unnest(array[
        'employees','contracts','insurance','attendance','shifts','requests','leave',
        'payroll','recruitment','planning','members','settings','assets','onboarding','news',
        'evaluations'
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
      'onboarding.view','assets.view','members.view','news.view','evaluations.view'
    ]::text[]
    when 'employee' then array[
      'employees.view','attendance.view','requests.view','leave.view','assets.view','members.view',
      'news.view'
    ]::text[]
    else '{}'::text[]
  end;
$$;

-- Bổ sung quyền đánh giá cho cấu hình vai trò đã lưu (chỉ thêm, không bớt quyền nào).
update public.company_role_permissions crp
set permissions = (
  select array_agg(distinct k) from unnest(
    crp.permissions || case
      when crp.role in ('admin','hr') then
        array['evaluations.view','evaluations.create','evaluations.edit','evaluations.delete']
      else array['evaluations.view'] end
  ) as k
)
where crp.role in ('admin','hr','manager')
  and not ('evaluations.view' = any(crp.permissions));

-- Biểu mẫu + tiêu chí ---------------------------------------------------------
create table if not exists public.evaluation_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 200),
  kind text not null default 'interview' check (kind in ('interview','probation','periodic')),
  description text,
  scale_max integer not null default 5 check (scale_max between 2 and 10),
  version integer not null default 1 check (version >= 1),
  previous_version_id uuid references public.evaluation_templates(id) on delete set null,
  is_active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists evaluation_templates_company_idx
  on public.evaluation_templates (company_id, kind, is_active);

create table if not exists public.evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.evaluation_templates(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  group_name text,
  name text not null check (length(btrim(name)) between 1 and 200),
  description text,
  weight numeric(6,2) not null default 1 check (weight > 0 and weight <= 1000),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists evaluation_criteria_template_idx
  on public.evaluation_criteria (template_id, sort_order);

-- Phiếu đánh giá ứng viên: thêm biểu mẫu, vòng phỏng vấn, câu trả lời, điểm tổng, trạng thái.
-- answers: {"<criterion_id>": {"score": 4, "comment": "..."}}. Phiếu cũ (4 tiêu chí cố định)
-- giữ nguyên và coi như đã nộp.
alter table public.candidate_evaluations
  add column if not exists template_id uuid references public.evaluation_templates(id) on delete restrict,
  add column if not exists interview_id uuid references public.candidate_interviews(id) on delete set null,
  add column if not exists answers jsonb not null default '{}'::jsonb,
  add column if not exists total_score numeric(6,2),
  add column if not exists status text not null default 'submitted',
  add column if not exists submitted_at timestamptz;
do $$ begin
  alter table public.candidate_evaluations
    add constraint candidate_evaluations_status_check check (status in ('draft','submitted'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.candidate_evaluations
    add constraint candidate_evaluations_answers_object check (jsonb_typeof(answers) = 'object');
exception when duplicate_object then null; end $$;
update public.candidate_evaluations set submitted_at = created_at where submitted_at is null and status = 'submitted';
create index if not exists candidate_evaluations_template_idx on public.candidate_evaluations (template_id);
create index if not exists candidate_evaluations_interview_idx on public.candidate_evaluations (interview_id);

-- Hàm nội bộ ----------------------------------------------------------------------
create or replace function public.evaluation_template_in_use(target_template uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.candidate_evaluations where template_id = target_template);
$$;
revoke all on function public.evaluation_template_in_use(uuid) from public, anon;
grant execute on function public.evaluation_template_in_use(uuid) to authenticated;

create or replace function public.evaluation_templates_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    new.company_id := old.company_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    -- BR-4.1: biểu mẫu đã dùng thì không đổi thang điểm/phiên bản, phải tạo phiên bản mới.
    if (new.scale_max <> old.scale_max or new.version <> old.version or new.kind <> old.kind)
       and public.evaluation_template_in_use(old.id) then
      raise exception 'Biểu mẫu đã được dùng để đánh giá, không đổi được loại/thang điểm. Hãy tạo phiên bản mới.';
    end if;
  else
    new.created_by := auth.uid();
  end if;
  if new.previous_version_id is not null and not exists (
    select 1 from public.evaluation_templates t
    where t.id = new.previous_version_id and t.company_id = new.company_id
  ) then
    raise exception 'Phiên bản trước không thuộc công ty này.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.evaluation_templates_before_write() from public, anon, authenticated;

drop trigger if exists evaluation_templates_before_write on public.evaluation_templates;
create trigger evaluation_templates_before_write before insert or update on public.evaluation_templates
  for each row execute function public.evaluation_templates_before_write();

create or replace function public.evaluation_criteria_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- BR-4.1: không thêm/sửa/xoá tiêu chí của biểu mẫu đã dùng.
  if public.evaluation_template_in_use(case when tg_op = 'DELETE' then old.template_id else new.template_id end)
     or (tg_op = 'UPDATE' and public.evaluation_template_in_use(old.template_id)) then
    raise exception 'Biểu mẫu đã được dùng để đánh giá, không sửa được tiêu chí. Hãy tạo phiên bản mới.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  select company_id into new.company_id from public.evaluation_templates where id = new.template_id;
  if new.company_id is null then
    raise exception 'Không tìm thấy biểu mẫu.';
  end if;
  return new;
end;
$$;
revoke all on function public.evaluation_criteria_before_write() from public, anon, authenticated;

drop trigger if exists evaluation_criteria_before_write on public.evaluation_criteria;
create trigger evaluation_criteria_before_write before insert or update or delete on public.evaluation_criteria
  for each row execute function public.evaluation_criteria_before_write();

-- Kiểm tra phiếu đánh giá: biểu mẫu/vòng phỏng vấn cùng công ty/ứng viên, điểm trong thang,
-- tính điểm tổng có trọng số phía máy chủ (BR-4.3), khoá phiếu đã nộp (BR-4.2).
create or replace function public.validate_candidate_evaluation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_template public.evaluation_templates%rowtype;
  v_key text;
  v_score numeric;
  v_sum numeric := 0;
  v_weight numeric := 0;
  v_missing integer;
begin
  if tg_op = 'UPDATE' then
    if old.status = 'submitted' and auth.uid() is not null
       and not public.has_permission(old.company_id, 'recruitment.edit') then
      raise exception 'Phiếu đánh giá đã nộp, chỉ người có quyền sửa tuyển dụng mới chỉnh được.';
    end if;
    new.company_id := old.company_id;
    new.candidate_id := old.candidate_id;
    new.reviewer_id := old.reviewer_id;
    new.created_at := old.created_at;
    if new.template_id is distinct from old.template_id then
      raise exception 'Không đổi được biểu mẫu của phiếu đã tạo.';
    end if;
  elsif auth.uid() is not null then
    new.reviewer_id := auth.uid();
  end if;

  if new.interview_id is not null and not exists (
    select 1 from public.candidate_interviews i
    where i.id = new.interview_id and i.candidate_id = new.candidate_id
  ) then
    raise exception 'Vòng phỏng vấn không thuộc ứng viên này.';
  end if;

  if new.template_id is null then
    new.answers := '{}'::jsonb;
    new.total_score := null;
  else
    select * into v_template from public.evaluation_templates where id = new.template_id;
    if v_template.id is null or v_template.company_id <> new.company_id then
      raise exception 'Biểu mẫu đánh giá không thuộc công ty này.';
    end if;
    if tg_op = 'INSERT' and not v_template.is_active then
      raise exception 'Biểu mẫu đã ngừng dùng.';
    end if;
    for v_key in select jsonb_object_keys(new.answers) loop
      if not exists (
        select 1 from public.evaluation_criteria c
        where c.template_id = new.template_id and c.id::text = v_key
      ) then
        raise exception 'Tiêu chí không thuộc biểu mẫu.';
      end if;
      if jsonb_typeof(new.answers -> v_key) <> 'object' then
        raise exception 'Câu trả lời không hợp lệ.';
      end if;
      if (new.answers -> v_key ->> 'score') is not null then
        if jsonb_typeof(new.answers -> v_key -> 'score') <> 'number' then
          raise exception 'Điểm phải là số.';
        end if;
        v_score := (new.answers -> v_key ->> 'score')::numeric;
        if v_score <> trunc(v_score) or v_score < 1 or v_score > v_template.scale_max then
          raise exception 'Điểm phải là số nguyên từ 1 đến %.', v_template.scale_max;
        end if;
      end if;
    end loop;

    select coalesce(sum((new.answers -> c.id::text ->> 'score')::numeric * c.weight), 0),
           coalesce(sum(c.weight) filter (where (new.answers -> c.id::text ->> 'score') is not null), 0),
           count(*) filter (where (new.answers -> c.id::text ->> 'score') is null)
      into v_sum, v_weight, v_missing
    from public.evaluation_criteria c
    where c.template_id = new.template_id;

    if new.status = 'submitted' and v_missing > 0 then
      raise exception 'Còn % tiêu chí chưa chấm điểm, chưa nộp được phiếu.', v_missing;
    end if;
    new.total_score := case when v_weight > 0 then round(v_sum / v_weight, 2) end;
  end if;

  if new.status = 'submitted' then
    new.submitted_at := coalesce(case when tg_op = 'UPDATE' then old.submitted_at end, now());
  else
    new.submitted_at := null;
  end if;
  return new;
end;
$$;
revoke all on function public.validate_candidate_evaluation() from public, anon, authenticated;

drop trigger if exists validate_candidate_evaluation on public.candidate_evaluations;
create trigger validate_candidate_evaluation before insert or update on public.candidate_evaluations
  for each row execute function public.validate_candidate_evaluation();

-- Người đánh giá chỉ xoá được phiếu nháp của mình; phiếu đã nộp cần quyền xoá tuyển dụng.
alter policy "evaluations_delete" on public.candidate_evaluations
  using (
    public.has_permission(company_id, 'recruitment.delete')
    or (reviewer_id = auth.uid() and status = 'draft')
  );

-- Tạo phiên bản mới của biểu mẫu (BR-4.1): chép tiêu chí, ngừng dùng bản cũ.
create or replace function public.create_evaluation_template_version(source_template uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_src public.evaluation_templates%rowtype;
  v_new uuid;
begin
  select * into v_src from public.evaluation_templates where id = source_template;
  if v_src.id is null then
    raise exception 'Không tìm thấy biểu mẫu.';
  end if;
  insert into public.evaluation_templates (company_id, name, kind, description, scale_max, version, previous_version_id)
  values (
    v_src.company_id, v_src.name, v_src.kind, v_src.description, v_src.scale_max,
    (select coalesce(max(version), 0) + 1 from public.evaluation_templates
      where company_id = v_src.company_id and lower(btrim(name)) = lower(btrim(v_src.name))),
    v_src.id
  )
  returning id into v_new;
  insert into public.evaluation_criteria (template_id, company_id, group_name, name, description, weight, sort_order)
  select v_new, v_src.company_id, group_name, name, description, weight, sort_order
  from public.evaluation_criteria where template_id = v_src.id;
  update public.evaluation_templates set is_active = false where id = v_src.id;
  return v_new;
end;
$$;
revoke all on function public.create_evaluation_template_version(uuid) from public, anon;
grant execute on function public.create_evaluation_template_version(uuid) to authenticated;

-- RLS ---------------------------------------------------------------------------------
alter table public.evaluation_templates enable row level security;
alter table public.evaluation_criteria enable row level security;
revoke all on public.evaluation_templates from anon;
revoke all on public.evaluation_criteria from anon;
grant select, insert, update, delete on public.evaluation_templates to authenticated;
grant select, insert, update, delete on public.evaluation_criteria to authenticated;

drop policy if exists "evaluation_templates_select" on public.evaluation_templates;
create policy "evaluation_templates_select" on public.evaluation_templates
  for select to authenticated using (
    public.has_permission(company_id, 'evaluations.view') or public.can_view_recruitment(company_id)
  );
drop policy if exists "evaluation_templates_insert" on public.evaluation_templates;
create policy "evaluation_templates_insert" on public.evaluation_templates
  for insert to authenticated with check (public.has_permission(company_id, 'evaluations.create'));
drop policy if exists "evaluation_templates_update" on public.evaluation_templates;
create policy "evaluation_templates_update" on public.evaluation_templates
  for update to authenticated using (public.has_permission(company_id, 'evaluations.edit'))
  with check (public.has_permission(company_id, 'evaluations.edit'));
drop policy if exists "evaluation_templates_delete" on public.evaluation_templates;
create policy "evaluation_templates_delete" on public.evaluation_templates
  for delete to authenticated using (public.has_permission(company_id, 'evaluations.delete'));

drop policy if exists "evaluation_criteria_select" on public.evaluation_criteria;
create policy "evaluation_criteria_select" on public.evaluation_criteria
  for select to authenticated using (
    public.has_permission(company_id, 'evaluations.view') or public.can_view_recruitment(company_id)
  );
drop policy if exists "evaluation_criteria_insert" on public.evaluation_criteria;
create policy "evaluation_criteria_insert" on public.evaluation_criteria
  for insert to authenticated with check (
    public.has_permission(company_id, 'evaluations.create') or public.has_permission(company_id, 'evaluations.edit')
  );
drop policy if exists "evaluation_criteria_update" on public.evaluation_criteria;
create policy "evaluation_criteria_update" on public.evaluation_criteria
  for update to authenticated using (public.has_permission(company_id, 'evaluations.edit'))
  with check (public.has_permission(company_id, 'evaluations.edit'));
drop policy if exists "evaluation_criteria_delete" on public.evaluation_criteria;
create policy "evaluation_criteria_delete" on public.evaluation_criteria
  for delete to authenticated using (
    public.has_permission(company_id, 'evaluations.edit') or public.has_permission(company_id, 'evaluations.delete')
  );
