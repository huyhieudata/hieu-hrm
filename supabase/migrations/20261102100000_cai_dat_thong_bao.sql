-- Cài đặt thông báo theo người dùng; áp dụng vào hàng đợi email tự động.
create table if not exists public.user_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_requests boolean not null default true,      -- đơn từ được duyệt/từ chối
  email_attendance boolean not null default true,    -- nhắc chấm công, đi muộn
  email_hr_reminders boolean not null default true,  -- sinh nhật, hết hạn HĐ, hết thử việc (người nhận HR/quản lý)
  updated_at timestamptz not null default now()
);
alter table public.user_notification_preferences enable row level security;
drop policy if exists unp_own on public.user_notification_preferences;
create policy unp_own on public.user_notification_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update on public.user_notification_preferences to authenticated;

-- Email tài khoản/mời (employee_created, invite_sent, employee_joined) luôn gửi, không tắt được.
create or replace function public.email_queue_apply_preferences()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pref public.user_notification_preferences;
begin
  select p.* into v_pref from public.user_notification_preferences p
    join auth.users u on u.id = p.user_id
   where lower(u.email) = lower(new.to_email) limit 1;
  if found and (
       (new.event_key in ('request_approved','request_rejected') and not v_pref.email_requests)
    or (new.event_key in ('attendance_reminder','late_threshold') and not v_pref.email_attendance)
    or (new.event_key in ('birthday','contract_expiring','probation_ending') and not v_pref.email_hr_reminders)
  ) then
    new.status := 'skipped';
    new.error := 'Người nhận đã tắt loại thông báo này trong Cá nhân > Cài đặt thông báo';
  end if;
  return new;
end $$;
revoke all on function public.email_queue_apply_preferences() from public, anon, authenticated;
drop trigger if exists email_queue_apply_preferences on public.email_queue;
create trigger email_queue_apply_preferences before insert on public.email_queue
  for each row execute function public.email_queue_apply_preferences();
