-- Cleanup temp guard-test candidate and seed a couple of history entries
begin;
  update public.candidates
  set note = 'Ứng viên tiềm năng, cần liên hệ lại sau đợt tuyển Q4.'
  where id = 'd3000000-0000-4000-8000-000000000002';

  delete from public.activity_logs where entity_id = 'd3000000-0000-4000-8000-0000000000fe';
  delete from public.candidates where id = 'd3000000-0000-4000-8000-0000000000fe';
commit;