-- SEC-07: audit đọc/xuất dữ liệu nhạy cảm. Chỉ ghi ai/khi nào/loại/số dòng, KHÔNG ghi giá trị.
create table if not exists public.data_access_audit (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid,
  actor_name text,
  kind text not null check (kind in ('sensitive_read','sensitive_bulk_read','export_excel','export_pdf')),
  target text,
  employee_id uuid,
  row_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists data_access_audit_company_created_idx on public.data_access_audit(company_id, created_at desc);
alter table public.data_access_audit enable row level security;
drop policy if exists data_access_audit_select on public.data_access_audit;
create policy data_access_audit_select on public.data_access_audit for select to authenticated
  using (public.has_company_role(company_id, array['owner','admin']));
revoke insert, update, delete on public.data_access_audit from anon, authenticated;
comment on table public.data_access_audit is 'SEC-07: nhật ký đọc/xuất dữ liệu nhạy cảm (chỉ metadata). Ghi qua hàm SECURITY DEFINER.';

create or replace function public.log_data_access(p_company uuid, p_kind text, p_target text, p_row_count integer)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null or not public.is_company_member(p_company) then raise exception 'FORBIDDEN'; end if;
  if p_kind not in ('export_excel','export_pdf') then raise exception 'KIND_NOT_ALLOWED'; end if;
  insert into public.data_access_audit(company_id, actor_id, actor_name, kind, target, row_count)
  values (p_company, auth.uid(), (select full_name from public.profiles where id = auth.uid()),
          p_kind, left(coalesce(p_target,''), 120), greatest(0, least(coalesce(p_row_count,0), 1000000)));
end; $$;
revoke all on function public.log_data_access(uuid,text,text,integer) from public, anon;
grant execute on function public.log_data_access(uuid,text,text,integer) to authenticated;

-- employee_sensitive_fields: giữ nguyên chữ ký/kết quả, thêm ghi audit khi xem dữ liệu của NGƯỜI KHÁC; giới hạn 2000 dòng.
create or replace function public.employee_sensitive_fields(p_company uuid, p_employee uuid default null)
returns table(employee_id uuid, national_id text, national_id_issue_date date, national_id_issue_place text, bank_name text, bank_account text, bank_branch text, tax_code text)
language plpgsql volatile security definer set search_path to 'public' as $$
declare v_count integer;
begin
  return query
  select e.id, e.national_id, e.national_id_issue_date, e.national_id_issue_place,
         e.bank_name, e.bank_account, e.bank_branch, e.tax_code
  from public.employees e
  where e.company_id = p_company
    and (p_employee is null or e.id = p_employee)
    and (e.user_id = auth.uid() or public.has_company_role(p_company, array['owner','admin','hr']))
  order by e.id
  limit 2000;
  get diagnostics v_count = row_count;
  if v_count > 0 and public.has_company_role(p_company, array['owner','admin','hr'])
     and not (p_employee is not null and exists (select 1 from public.employees x where x.id = p_employee and x.user_id = auth.uid())) then
    insert into public.data_access_audit(company_id, actor_id, actor_name, kind, employee_id, row_count)
    values (p_company, auth.uid(), (select full_name from public.profiles where id = auth.uid()),
            case when p_employee is null then 'sensitive_bulk_read' else 'sensitive_read' end, p_employee, v_count);
  end if;
end; $$;
