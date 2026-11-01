-- Chặn trùng tên phòng ban (không phân biệt hoa thường, bỏ khoảng trắng) trong cùng công ty,
-- và trùng tên vị trí trong cùng phòng ban. Dữ liệu hiện tại đã kiểm: không có bản trùng.
create unique index if not exists departments_company_lower_name_uidx
  on public.departments (company_id, lower(btrim(name)));
create unique index if not exists department_positions_dept_lower_title_uidx
  on public.department_positions (department_id, lower(btrim(title)));
