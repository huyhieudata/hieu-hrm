insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do nothing;

create policy "avatars_read" on storage.objects for select to public
using (bucket_id = 'avatars');

create policy "avatars_insert" on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and public.can_manage_employee(((storage.foldername(name))[2])::uuid)
);

create policy "avatars_update" on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and public.can_manage_employee(((storage.foldername(name))[2])::uuid)
)
with check (
  bucket_id = 'avatars'
  and public.can_manage_employee(((storage.foldername(name))[2])::uuid)
);

create policy "avatars_delete" on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and public.can_manage_employee(((storage.foldername(name))[2])::uuid)
);