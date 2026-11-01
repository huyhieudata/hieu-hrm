-- Extend discipline records: additional measures + mandatory procedure checklist
-- (dropping and re-adding the category CHECK only swaps 'warning' for 'reprimand'; no rows are deleted)
alter table public.employee_discipline_records
  add column if not exists additional_measures text,
  add column if not exists checklist jsonb;

alter table public.employee_discipline_records
  drop constraint if exists employee_discipline_records_category_check;

update public.employee_discipline_records set category = 'reprimand' where category = 'warning';

alter table public.employee_discipline_records
  add constraint employee_discipline_records_category_check
  check (category in ('reminder','reprimand','salary_delay','demotion','dismissal'));

create or replace function public.validate_discipline_checklist()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  required_keys text[] := array['violation_record','meeting_notice','meeting_minutes','decision','handover'];
  step jsonb;
  step_key text;
begin
  if new.category = 'reminder' then
    return new;
  end if;

  if new.checklist is null or jsonb_typeof(new.checklist) <> 'array' then
    raise exception 'Cần hoàn tất checklist quy trình xử lý kỷ luật và tải đủ hồ sơ đính kèm.';
  end if;

  foreach step_key in array required_keys loop
    select t.value into step
    from jsonb_array_elements(new.checklist) as t(value)
    where t.value ->> 'key' = step_key
    limit 1;

    if step is null then
      raise exception 'Thiếu bước % trong checklist xử lý kỷ luật.', step_key;
    end if;

    if coalesce(step ->> 'file_path', '') = '' then
      raise exception 'Bước % chưa có hồ sơ đính kèm.', step_key;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists validate_discipline_checklist_trigger on public.employee_discipline_records;
create trigger validate_discipline_checklist_trigger
  before insert or update on public.employee_discipline_records
  for each row execute function public.validate_discipline_checklist();