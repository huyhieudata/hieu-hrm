-- Đề nghị cập nhật hồ sơ (/toi/ho-so): kiểm tra định dạng SĐT (VN), email, CCCD, MST ngay trong RPC
-- (client cũng kiểm tra; đây là lớp chặn cuối nếu gọi thẳng API).
CREATE OR REPLACE FUNCTION public.submit_employee_change_request(p_company uuid, p_changes jsonb, p_note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_emp uuid; v_key text; v_val text; v_clean jsonb := '{}'; v_id uuid;
begin
  select id into v_emp from public.employees where company_id = p_company and user_id = auth.uid();
  if v_emp is null then raise exception 'Tài khoản chưa gắn hồ sơ nhân sự.'; end if;
  if jsonb_typeof(p_changes) <> 'object' then raise exception 'Dữ liệu không hợp lệ.'; end if;
  for v_key in select jsonb_object_keys(p_changes) loop
    if not v_key = any (public.employee_self_editable_fields()) then
      raise exception 'Trường % không được tự cập nhật.', v_key;
    end if;
    v_val := nullif(btrim(p_changes ->> v_key), '');
    if v_val is not null then
      if v_key in ('phone', 'emergency_contact_phone')
         and regexp_replace(v_val, '[\s.-]', '', 'g') !~ '^(0\d{9}|\+84\d{9})$' then
        raise exception 'Số điện thoại không hợp lệ (10 số bắt đầu bằng 0, hoặc +84…).';
      elsif v_key in ('personal_email', 'work_email') and v_val !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
        raise exception 'Email không hợp lệ.';
      elsif v_key = 'national_id' and v_val !~ '^\d{12}$' then
        raise exception 'Số CCCD phải gồm đúng 12 chữ số.';
      elsif v_key = 'tax_code' and regexp_replace(v_val, '[\s-]', '', 'g') !~ '^(\d{10}|\d{13})$' then
        raise exception 'Mã số thuế phải gồm 10 hoặc 13 chữ số.';
      end if;
    end if;
    v_clean := v_clean || jsonb_build_object(v_key, v_val);
  end loop;
  if v_clean = '{}'::jsonb then raise exception 'Chưa có thay đổi nào.'; end if;
  if exists (select 1 from public.employee_change_requests where employee_id = v_emp and status = 'pending') then
    raise exception 'Bạn đã có một đề nghị đang chờ HR duyệt.';
  end if;
  insert into public.employee_change_requests (company_id, employee_id, changes, note)
  values (p_company, v_emp, v_clean, nullif(btrim(p_note), '')) returning id into v_id;
  return v_id;
end $function$;
