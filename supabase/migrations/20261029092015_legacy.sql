alter table public.onboarding_checklist_templates
  add column if not exists attachment_path text,
  add column if not exists attachment_name text;

insert into storage.buckets (id, name, public, file_size_limit)
values ('onboarding-forms', 'onboarding-forms', false, 15 * 1024 * 1024)
on conflict (id) do nothing;

create policy "onboarding_forms_read" on storage.objects for select to authenticated
using (
  bucket_id = 'onboarding-forms'
  and public.has_company_role(((storage.foldername(name))[1])::uuid, array['owner','admin','hr','manager'])
);

create policy "onboarding_forms_write" on storage.objects for insert to authenticated
with check (
  bucket_id = 'onboarding-forms'
  and public.can_manage_attendance(((storage.foldername(name))[1])::uuid)
);

create policy "onboarding_forms_delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'onboarding-forms'
  and public.can_manage_attendance(((storage.foldername(name))[1])::uuid)
);