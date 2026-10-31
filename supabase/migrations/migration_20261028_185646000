create table public.document_checklist_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  label text not null,
  category text not null default 'other' check (category in ('contract','identity','degree','certificate','insurance','medical','other')),
  required boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index document_checklist_company_idx on public.document_checklist_templates (company_id);
alter table public.document_checklist_templates enable row level security;

create trigger document_checklist_set_updated_at before update on public.document_checklist_templates
  for each row execute function public.set_updated_at();

create policy "document_checklist_select" on public.document_checklist_templates
  for select to authenticated using (public.can_view_recruitment(company_id));
create policy "document_checklist_insert" on public.document_checklist_templates
  for insert to authenticated with check (public.can_manage_recruitment(company_id));
create policy "document_checklist_update" on public.document_checklist_templates
  for update to authenticated using (public.can_manage_recruitment(company_id)) with check (public.can_manage_recruitment(company_id));
create policy "document_checklist_delete" on public.document_checklist_templates
  for delete to authenticated using (public.can_manage_recruitment(company_id));

insert into public.document_checklist_templates (company_id, label, category, sort_order)
select c.id, t.label, t.category, t.ord
from public.companies c
cross join (values
  ('Hợp đồng lao động', 'contract', 1),
  ('CCCD / CMND', 'identity', 2),
  ('Bằng cấp', 'degree', 3),
  ('Chứng chỉ / Bằng nghề', 'certificate', 4),
  ('Sổ bảo hiểm xã hội', 'insurance', 5),
  ('Giấy khám sức khoẻ', 'medical', 6),
  ('Ảnh thẻ / Giấy tờ khác', 'other', 7)
) as t(label, category, ord)
where not exists (select 1 from public.document_checklist_templates x where x.company_id = c.id);