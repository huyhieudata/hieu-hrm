-- Báo cáo nhân sự: thêm danh sách hồ sơ đang làm thiếu ngày vào làm/giới tính/ngày sinh (chỉ id, tên, mã).
create or replace function public.workforce_report(p_company uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_all boolean := public.has_company_role(p_company, array['owner','admin','hr']);
  v_mgr boolean := public.has_company_role(p_company, array['manager']);
  v_res jsonb;
begin
  if auth.uid() is null or not (v_all or v_mgr) then
    raise exception 'Không có quyền xem báo cáo nhân sự' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 3660 then
    raise exception 'Khoảng thời gian không hợp lệ' using errcode = '22023';
  end if;

  with e as (
    select id, full_name, code, coalesce(nullif(department,''),'(Chưa có phòng ban)') dept, gender, employment_type,
           status, hire_date, resignation_date, resignation_reason, date_of_birth
    from employees
    where company_id = p_company and (v_all or public.is_manager_of_employee(id))
  ),
  act as ( -- đang làm tại p_to
    select * from e where status <> 'pending' and (hire_date is null or hire_date <= p_to)
      and (resignation_date is null or resignation_date > p_to)
      and not (status = 'resigned' and resignation_date is null)
  ),
  hc_start as (
    select count(*) n from e where (hire_date is null or hire_date < p_from)
      and status <> 'pending' and (resignation_date is null or resignation_date >= p_from)
  ),
  hires as (select * from e where hire_date between p_from and p_to),
  leavers as (select * from e where status = 'resigned' and resignation_date between p_from and p_to),
  months as (
    select generate_series(date_trunc('month', p_from)::date, date_trunc('month', p_to)::date, interval '1 month')::date m
  )
  select jsonb_build_object(
    'scope', case when v_all then 'company' else 'team' end,
    'headcount_start', (select n from hc_start),
    'headcount_end', (select count(*) from act),
    'hires', (select count(*) from hires),
    'leavers', (select count(*) from leavers),
    'turnover_pct', round(100.0 * (select count(*) from leavers)
        / nullif(((select n from hc_start) + (select count(*) from act)) / 2.0, 0), 1),
    'monthly', coalesce((select jsonb_agg(jsonb_build_object(
        'month', to_char(m,'YYYY-MM'),
        'hires', (select count(*) from hires h where date_trunc('month',h.hire_date) = m),
        'leavers', (select count(*) from leavers l where date_trunc('month',l.resignation_date) = m)) order by m)
      from months), '[]'),
    'by_department', coalesce((select jsonb_agg(jsonb_build_object('label', dept, 'count', n,
        'leavers', (select count(*) from leavers l where l.dept = x.dept)) order by n desc)
      from (select dept, count(*) n from act group by dept) x), '[]'),
    'by_gender', coalesce((select jsonb_agg(jsonb_build_object('label', g, 'count', n) order by n desc)
      from (select case gender when 'male' then 'Nam' when 'female' then 'Nữ' when 'other' then 'Khác' else 'Chưa rõ' end g,
                   count(*) n from act group by 1) x), '[]'),
    'by_type', coalesce((select jsonb_agg(jsonb_build_object('label', t, 'count', n) order by n desc)
      from (select coalesce(employment_type,'unknown') t, count(*) n from act group by 1) x), '[]'),
    'by_tenure', coalesce((select jsonb_agg(jsonb_build_object('label', b, 'count', n) order by o)
      from (select case when hire_date is null then 'Chưa rõ'
                        when age(p_to, hire_date) < interval '1 year' then '< 1 năm'
                        when age(p_to, hire_date) < interval '3 years' then '1–3 năm'
                        when age(p_to, hire_date) < interval '5 years' then '3–5 năm' else '≥ 5 năm' end b,
                   min(case when hire_date is null then 9 else extract(year from age(p_to, hire_date)) end) o,
                   count(*) n from act group by 1) x), '[]'),
    'by_age', coalesce((select jsonb_agg(jsonb_build_object('label', b, 'count', n) order by b)
      from (select case when date_of_birth is null then 'Chưa rõ'
                        when extract(year from age(p_to, date_of_birth)) < 25 then '< 25'
                        when extract(year from age(p_to, date_of_birth)) < 35 then '25–34'
                        when extract(year from age(p_to, date_of_birth)) < 45 then '35–44' else '≥ 45' end b,
                   count(*) n from act group by 1) x), '[]'),
    'missing_total', (select count(*) from act where hire_date is null or gender is null or gender = '' or date_of_birth is null),
    'missing_profiles', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'full_name', full_name, 'code', code,
        'missing', array_remove(array[case when hire_date is null then 'hire_date' end,
                                      case when gender is null or gender = '' then 'gender' end,
                                      case when date_of_birth is null then 'date_of_birth' end], null)) order by full_name)
      from (select * from act where hire_date is null or gender is null or gender = '' or date_of_birth is null
            order by full_name limit 200) x), '[]'),
    'leave_reasons', coalesce((select jsonb_agg(jsonb_build_object('label', r, 'count', n) order by n desc)
      from (select coalesce(nullif(resignation_reason,''),'Không ghi') r, count(*) n from leavers group by 1) x), '[]')
  ) into v_res;
  return v_res;
end $$;

revoke all on function public.workforce_report(uuid, date, date) from public, anon;
grant execute on function public.workforce_report(uuid, date, date) to authenticated;
