-- Checklist xử lý kỷ luật becomes advisory: remove the hard validation trigger
-- (existing rows and their checklist data are untouched)
drop trigger if exists validate_discipline_checklist_trigger on public.employee_discipline_records;
drop function if exists public.validate_discipline_checklist();