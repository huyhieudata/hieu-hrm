-- SEC-11: mật khẩu tạm hết hạn sau 24 giờ (thực thi ở server). Idempotent.
alter table public.profiles add column if not exists temp_password_expires_at timestamptz;

-- Quá hạn mà chưa đổi ⇒ thay mật khẩu bằng chuỗi ngẫu nhiên (mật khẩu tạm mất hiệu lực).
-- Người dùng cần HR bấm "Cấp lại mật khẩu" hoặc dùng "Quên mật khẩu". Không đụng tài khoản đã tự đổi mật khẩu.
create or replace function public.expire_temp_passwords()
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare n integer;
begin
  with due as (
    update public.profiles p set temp_password_expires_at = null
     where p.must_change_password = true and p.temp_password_expires_at is not null and p.temp_password_expires_at < now()
    returning p.id
  )
  update auth.users u set encrypted_password = extensions.crypt(gen_random_uuid()::text || clock_timestamp()::text, extensions.gen_salt('bf'))
    from due where u.id = due.id;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.expire_temp_passwords() from public, anon, authenticated;

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'expire-temp-passwords';
    perform cron.schedule('expire-temp-passwords', '17 * * * *', 'select public.expire_temp_passwords()');
  end if;
end $$;

-- Người dùng tự đổi mật khẩu ⇒ xoá hạn.
create or replace function public.clear_temp_password_expiry()
returns trigger language plpgsql as $$
begin
  if new.must_change_password = false then new.temp_password_expires_at := null; end if;
  return new;
end $$;
drop trigger if exists profiles_clear_temp_expiry on public.profiles;
drop trigger if exists zz_profiles_clear_temp_expiry on public.profiles;
-- tên zz_ để chạy SAU trg_profiles_guard_must_change (trigger chạy theo thứ tự tên).
create trigger zz_profiles_clear_temp_expiry before update of must_change_password on public.profiles
  for each row execute function public.clear_temp_password_expiry();
