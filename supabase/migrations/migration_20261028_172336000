-- Assign demo department managers so onboarding auto-fill can be seen
update public.departments d
set manager_employee_id = e.id, manager_name = e.full_name
from public.employees e
where e.code = case d.name
    when 'Nhân sự' then 'DEMO-001'
    when 'Kỹ thuật' then 'DEMO-002'
    when 'Marketing' then 'DEMO-003'
    when 'Kinh doanh' then 'DEMO-001'
    when 'Vận hành' then 'DEMO-002'
    when 'Tài chính' then 'DEMO-005'
    else 'ZZZ'
  end;