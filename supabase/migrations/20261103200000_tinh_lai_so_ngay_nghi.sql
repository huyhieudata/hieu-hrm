-- Server tự tính leave_days (cùng công thức src/lib/requests.ts leaveDays): số ngày lịch từ start..end (tối đa 62),
-- nửa buổi (session khác full_day) x0.5; loại đơn không phải nghỉ -> 0. Không tin giá trị client gửi lên.
create or replace function public.compute_request_leave_days()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cat text; v_days int;
begin
  select category into v_cat from public.request_types where id = new.request_type_id;
  if v_cat is distinct from 'leave' or new.start_date is null or new.end_date is null then
    new.leave_days := 0;
    return new;
  end if;
  v_days := greatest(0, least(62, (new.end_date - new.start_date) + 1));
  new.leave_days := round(v_days * case when new.session is null or new.session = 'full_day' then 1 else 0.5 end, 1);
  return new;
end $$;
revoke all on function public.compute_request_leave_days() from public, anon, authenticated;
-- Tên bắt đầu bằng "a_" để chạy TRƯỚC guard_leave_balance (trigger BEFORE chạy theo thứ tự tên).
drop trigger if exists a_requests_compute_leave_days on public.requests;
create trigger a_requests_compute_leave_days before insert or update of start_date, end_date, session, request_type_id, leave_days
  on public.requests for each row execute function public.compute_request_leave_days();
