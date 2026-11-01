-- Demo data for concurrent positions (also generates an activity log entry)
update public.employees
set concurrent_positions = 'Trưởng phòng Kỹ thuật; Phụ trách an toàn thông tin'
where code = 'DEMO-002';

update public.employees
set concurrent_positions = 'Giám đốc Nhân sự; Trưởng ban Văn hoá doanh nghiệp'
where code = 'DEMO-001';