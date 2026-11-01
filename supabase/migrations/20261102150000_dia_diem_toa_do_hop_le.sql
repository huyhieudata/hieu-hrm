-- Địa điểm chấm công: không chấp nhận toạ độ 0,0 (thường do để trống ô).
-- NOT VALID: không chặn bản ghi cũ (nếu có) nhưng chặn mọi insert/update mới.
alter table public.attendance_locations
  drop constraint if exists attendance_locations_not_null_island;
alter table public.attendance_locations
  add constraint attendance_locations_not_null_island
  check (not (latitude = 0 and longitude = 0)) not valid;
