-- Mô-đun 4: Đánh giá nhân viên (thử việc, định kỳ) theo biểu mẫu, gắn với hồ sơ nhân viên.
-- Dùng lại biểu mẫu/tiêu chí của 20261101060500; điểm tổng có trọng số tính phía máy chủ (BR-4.3),
-- phiếu đã nộp bị khoá trừ người có evaluations.edit (BR-4.2), biểu mẫu đã dùng không sửa được (BR-4.1).
-- Quyền: owner/admin/hr (evaluations.create/edit/delete) toàn công ty; quản lý trực tiếp/phòng ban
-- (is_manager_of_employee) được tạo và xem phiếu của nhân viên mình quản lý; nhân viên chỉ xem phiếu
-- đã nộp của chính mình.

create table if not exists public.employee_evaluations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  template_id uuid not null references public.evaluation_templates(id) on delete restrict,
  kind text not null default 'periodic' check (kind in ('probation','periodic')),
  period_label text check (period_label is null or length(btrim(period_label)) <= 100),
  period_start date,
  period_end date,
  reviewer_id uuid default auth.uid(),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  total_score numeric(6,2),
  recommendation text check (recommendation is null or recommendation in (
    'pass','extend','fail','excellent','good','fair','poor')),
  strengths text,
  improvements text,
  overall_comment text,
  status text not null default 'draft' check (status in ('draft','submitted')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_evaluations_period_check check (
    period_start is null or period_end is null or period_end >= period_start)
);
create index if not exists employee_evaluations_employee_idx
  on public.employee_evaluations (employee_id, created_at desc);
create index if not exists employee_evaluations_company_idx
  on public.employee_evaluations (company_id, kind, status);
create index if not exists employee_evaluations_template_idx
  on public.employee_evaluations (template_id);

-- Biểu mẫu được coi là "đã dùng" khi có phiếu ứng viên hoặc phiếu nhân viên.
create or replace function public.evaluation_template_in_use(target_template uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.candidate_evaluations where template_id = target_template)
      or exists (select 1 from public.employee_evaluations where template_id = target_template);
$$;
revoke all on function public.evaluation_template_in_use(uuid) from public, anon;
grant execute on function public.evaluation_template_in_use(uuid) to authenticated;

create or replace function public.validate_employee_evaluation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_template public.evaluation_templates%rowtype;
  v_emp_company uuid;
  v_key text;
  v_score numeric;
  v_sum numeric := 0;
  v_weight numeric := 0;
  v_missing integer;
begin
  if tg_op = 'UPDATE' then
    if old.status = 'submitted' and auth.uid() is not null
       and not public.has_permission(old.company_id, 'evaluations.edit') then
      raise exception 'Phiếu đánh giá đã nộp, chỉ người có quyền sửa đánh giá mới chỉnh được.';
    end if;
    new.company_id := old.company_id;
    new.employee_id := old.employee_id;
    new.reviewer_id := old.reviewer_id;
    new.created_at := old.created_at;
    if new.template_id is distinct from old.template_id then
      raise exception 'Không đổi được biểu mẫu của phiếu đã tạo.';
    end if;
  elsif auth.uid() is not null then
    new.reviewer_id := auth.uid();
  end if;

  select company_id into v_emp_company from public.employees where id = new.employee_id;
  if v_emp_company is null or v_emp_company <> new.company_id then
    raise exception 'Nhân viên không thuộc công ty này.';
  end if;

  select * into v_template from public.evaluation_templates where id = new.template_id;
  if v_template.id is null or v_template.company_id <> new.company_id then
    raise exception 'Biểu mẫu đánh giá không thuộc công ty này.';
  end if;
  if v_template.kind not in ('probation','periodic') then
    raise exception 'Chỉ dùng biểu mẫu thử việc hoặc định kỳ để đánh giá nhân viên.';
  end if;
  if tg_op = 'INSERT' and not v_template.is_active then
    raise exception 'Biểu mẫu đã ngừng dùng.';
  end if;
  new.kind := v_template.kind;

  if new.recommendation is not null and (
       (new.kind = 'probation' and new.recommendation not in ('pass','extend','fail'))
    or (new.kind = 'periodic' and new.recommendation not in ('excellent','good','fair','poor'))) then
    raise exception 'Đề xuất không hợp lệ với loại đánh giá.';
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

  if new.status = 'submitted' then
    new.submitted_at := coalesce(case when tg_op = 'UPDATE' then old.submitted_at end, now());
  else
    new.submitted_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.validate_employee_evaluation() from public, anon, authenticated;

drop trigger if exists validate_employee_evaluation on public.employee_evaluations;
create trigger validate_employee_evaluation before insert or update on public.employee_evaluations
  for each row execute function public.validate_employee_evaluation();

alter table public.employee_evaluations enable row level security;
revoke all on public.employee_evaluations from anon;
grant select, insert, update, delete on public.employee_evaluations to authenticated;

drop policy if exists "employee_evaluations_select" on public.employee_evaluations;
create policy "employee_evaluations_select" on public.employee_evaluations
  for select to authenticated using (
    public.has_permission(company_id, 'evaluations.create')
    or public.has_permission(company_id, 'evaluations.edit')
    or reviewer_id = auth.uid()
    or public.is_manager_of_employee(employee_id)
    or (status = 'submitted' and exists (
      select 1 from public.employees e where e.id = employee_id and e.user_id = auth.uid()))
  );
drop policy if exists "employee_evaluations_insert" on public.employee_evaluations;
create policy "employee_evaluations_insert" on public.employee_evaluations
  for insert to authenticated with check (
    public.has_permission(company_id, 'evaluations.create')
    or public.is_manager_of_employee(employee_id)
  );
drop policy if exists "employee_evaluations_update" on public.employee_evaluations;
create policy "employee_evaluations_update" on public.employee_evaluations
  for update to authenticated
  using (public.has_permission(company_id, 'evaluations.edit') or (reviewer_id = auth.uid() and status = 'draft'))
  with check (public.has_permission(company_id, 'evaluations.edit') or reviewer_id = auth.uid());
drop policy if exists "employee_evaluations_delete" on public.employee_evaluations;
create policy "employee_evaluations_delete" on public.employee_evaluations
  for delete to authenticated using (
    public.has_permission(company_id, 'evaluations.delete')
    or (reviewer_id = auth.uid() and status = 'draft')
  );
