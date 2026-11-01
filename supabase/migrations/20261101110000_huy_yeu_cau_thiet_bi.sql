-- Nhân viên tự huỷ yêu cầu đăng ký thiết bị đang chờ duyệt của chính mình.
create or replace function public.cancel_my_attendance_device(p_device uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_dev public.employee_devices;
begin
  if auth.uid() is null then raise exception 'Chưa đăng nhập.'; end if;
  select d.* into v_dev
  from public.employee_devices d
  join public.employees e on e.id = d.employee_id
  where d.id = p_device and e.user_id = auth.uid();
  if v_dev.id is null then raise exception 'Không tìm thấy yêu cầu thiết bị của bạn.'; end if;
  if v_dev.status <> 'pending' then raise exception 'Chỉ huỷ được yêu cầu đang chờ duyệt.'; end if;
  delete from public.employee_devices where id = v_dev.id and status = 'pending';
end;
$$;

revoke all on function public.cancel_my_attendance_device(uuid) from public, anon;
grant execute on function public.cancel_my_attendance_device(uuid) to authenticated;
