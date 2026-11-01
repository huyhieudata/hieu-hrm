-- Vá lỗi module Tính lương (chỉ bổ sung cột và cập nhật biểu thức policy hiện có, không xoá dữ liệu).
alter table public.payroll_items add column if not exists attendance_days numeric(5,1) not null default 0;
alter table public.payroll_items add column if not exists leave_days numeric(5,1) not null default 0;

alter policy "payroll_periods_select" on public.payroll_periods
  using (public.has_permission(company_id, 'payroll.view'));

alter policy "payroll_items_select" on public.payroll_items
  using (
    public.has_permission(company_id, 'payroll.view')
    or exists (
      select 1 from public.employees e
      where e.id = payroll_items.employee_id
        and e.user_id = auth.uid()
    )
  );