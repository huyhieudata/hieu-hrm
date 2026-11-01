-- Phiếu lương nhân viên: chỉ thấy phiếu của mình ở kỳ đã chốt/đã chi trả (không thấy bản nháp).
drop policy if exists payroll_items_select on public.payroll_items;
create policy payroll_items_select on public.payroll_items for select using (
  public.has_permission(company_id, 'payroll.view')
  or exists (
    select 1 from public.employees e join public.payroll_periods p on p.id = payroll_items.period_id
    where e.id = payroll_items.employee_id and e.user_id = (select auth.uid()) and p.status in ('locked', 'paid')
  )
);

create or replace function public.my_payslips(p_company_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(i) || jsonb_build_object('period_month', p.month, 'period_year', p.year,
           'period_status', p.status, 'standard_work_days', p.standard_work_days)
         order by p.year desc, p.month desc), '[]'::jsonb)
  from public.payroll_items i
  join public.payroll_periods p on p.id = i.period_id
  join public.employees e on e.id = i.employee_id
  where i.company_id = p_company_id and e.user_id = auth.uid() and p.status in ('locked', 'paid');
$$;
revoke all on function public.my_payslips(uuid) from public, anon;
grant execute on function public.my_payslips(uuid) to authenticated;
