-- Private bucket for employee HR documents (no existing buckets or storage policies in this Cloud)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hr-documents',
  'hr-documents',
  false,
  15 * 1024 * 1024,
  array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]::text[]
);

create policy "hr_documents_read"
on storage.objects for select to authenticated
using (
  bucket_id = 'hr-documents'
  and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/'
  and public.can_view_sensitive_employee(split_part(name, '/', 2)::uuid)
);

create policy "hr_documents_upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'hr-documents'
  and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/'
  and public.can_manage_employee(split_part(name, '/', 2)::uuid)
);

create policy "hr_documents_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'hr-documents'
  and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/'
  and public.can_manage_employee(split_part(name, '/', 2)::uuid)
);