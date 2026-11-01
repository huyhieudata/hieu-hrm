-- Module Email: mẫu email, luồng tự động (quy tắc), hàng đợi, nhật ký gửi.
-- Chỉ owner/admin/HR của công ty đọc/ghi mẫu & quy tắc; hàng đợi/nhật ký chỉ đọc. Ghi hàng đợi chỉ qua hàm nội bộ.

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  name text not null,
  event_key text,
  subject text not null default '',
  body_html text not null default '',
  active boolean not null default true,
  is_default boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code),
  check (code ~ '^[a-z0-9_]{2,40}$')
);

create table if not exists public.email_rules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  event_key text not null check (event_key in ('employee_created','invite_sent','employee_joined','birthday',
    'contract_expiring','probation_ending','request_approved','request_rejected','late_threshold','attendance_reminder')),
  conditions jsonb not null default '{}'::jsonb,   -- {departments:[], positions:[], contract_types:[], employment_types:[], request_categories:[]}
  recipients jsonb not null default '{"employee":true}'::jsonb, -- {employee, manager, hr, emails:[]}
  offset_days int not null default 0 check (offset_days between 0 and 365),
  threshold int not null default 3 check (threshold between 1 and 100),
  delay_minutes int not null default 0 check (delay_minutes between 0 and 43200),
  send_hour int not null default 8 check (send_hour between 0 and 23),
  template_id uuid references public.email_templates(id) on delete set null,
  active boolean not null default true,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists email_rules_company_event_idx on public.email_rules(company_id, event_key) where active;

create table if not exists public.email_queue (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  rule_id uuid references public.email_rules(id) on delete set null,
  template_id uuid references public.email_templates(id) on delete set null,
  event_key text not null,
  event_ref text not null,
  employee_id uuid references public.employees(id) on delete set null,
  to_email text not null,
  to_name text,
  vars jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','sending','sent','failed','skipped')),
  attempts int not null default 0,
  error text,
  sent_at timestamptz,
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);
create index if not exists email_queue_due_idx on public.email_queue(status, scheduled_at);
create index if not exists email_queue_company_idx on public.email_queue(company_id, created_at desc);

create table if not exists public.email_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  queue_id uuid references public.email_queue(id) on delete set null,
  rule_id uuid references public.email_rules(id) on delete set null,
  template_id uuid references public.email_templates(id) on delete set null,
  event_key text,
  to_email text not null,
  subject text,
  status text not null,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists email_logs_company_idx on public.email_logs(company_id, created_at desc);

-- Bí mật cho cron gọi edge function (không cấp quyền cho client).
create table if not exists public.email_dispatch_config (
  id int primary key default 1 check (id = 1),
  cron_secret text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
insert into public.email_dispatch_config (id) values (1) on conflict do nothing;

alter table public.email_templates enable row level security;
alter table public.email_rules enable row level security;
alter table public.email_queue enable row level security;
alter table public.email_logs enable row level security;
alter table public.email_dispatch_config enable row level security;
revoke all on public.email_dispatch_config from anon, authenticated;
revoke all on public.email_queue, public.email_logs from anon;
revoke insert, update, delete on public.email_queue, public.email_logs from authenticated;
grant select on public.email_queue, public.email_logs to authenticated;
grant select, insert, update, delete on public.email_templates, public.email_rules to authenticated;

do $$
declare t text;
begin
  foreach t in array array['email_templates','email_rules'] loop
    execute format('drop policy if exists %1$s_hr_all on public.%1$s', t);
    execute format('create policy %1$s_hr_all on public.%1$s for all to authenticated
      using (public.has_company_role(company_id, array[''owner'',''admin'',''hr'']))
      with check (public.has_company_role(company_id, array[''owner'',''admin'',''hr'']))', t);
  end loop;
  foreach t in array array['email_queue','email_logs'] loop
    execute format('drop policy if exists %1$s_hr_read on public.%1$s', t);
    execute format('create policy %1$s_hr_read on public.%1$s for select to authenticated
      using (public.has_company_role(company_id, array[''owner'',''admin'',''hr'']))', t);
  end loop;
end $$;

-- Làm sạch HTML phía máy chủ (lớp 2, client đã dùng DOMPurify).
create or replace function public.email_sanitize_html(p text)
returns text language sql immutable set search_path = public
as $$
  select regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(coalesce(p, ''),
    '<\s*(script|iframe|object|embed|style|form|input|textarea|select|meta|link|base)[^>]*>.*?<\s*/\s*\1\s*>', '', 'gis'),
    '<\s*/?\s*(script|iframe|object|embed|style|form|input|textarea|select|meta|link|base)[^>]*>', '', 'gi'),
    '\s+on[a-z]+\s*=\s*("[^"]*"|''[^'']*''|[^\s>]+)', '', 'gi'),
    '(href|src)\s*=\s*("|'')?\s*(javascript|vbscript|data:text)[^"''\s>]*("|'')?', '\1="#"', 'gi'),
    'expression\s*\(', '(', 'gi');
$$;

create or replace function public.email_templates_before_write()
returns trigger language plpgsql set search_path = public
as $$
begin
  new.body_html := public.email_sanitize_html(new.body_html);
  new.subject := left(regexp_replace(coalesce(new.subject, ''), '[\r\n]+', ' ', 'g'), 300);
  new.code := lower(btrim(new.code));
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_email_templates_before_write on public.email_templates;
create trigger trg_email_templates_before_write before insert or update on public.email_templates
  for each row execute function public.email_templates_before_write();

create or replace function public.email_rules_before_write()
returns trigger language plpgsql set search_path = public
as $$
begin
  if new.template_id is not null and not exists (
    select 1 from public.email_templates t where t.id = new.template_id and t.company_id = new.company_id) then
    raise exception 'TEMPLATE_NOT_IN_COMPANY';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists trg_email_rules_before_write on public.email_rules;
create trigger trg_email_rules_before_write before insert or update on public.email_rules
  for each row execute function public.email_rules_before_write();

-- Mẫu mặc định
create or replace function public.email_seed_templates(p_company uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  btn text := 'display:inline-block;background:#fc600b;color:#ffffff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold';
begin
  insert into public.email_templates (company_id, code, name, event_key, subject, body_html, is_default, created_by) values
  (p_company, 'loi_moi', 'Lời mời tham gia', 'invite_sent', 'Lời mời tham gia {{ten_cong_ty}} trên ONHRM',
   '<h2>Lời mời tham gia {{ten_cong_ty}}</h2><p>Xin chào {{ten_nhan_vien}},</p><p>Bạn được mời tham gia <strong>{{ten_cong_ty}}</strong> trên ONHRM với vai trò <strong>{{vai_tro}}</strong> ({{chuc_danh}} · {{phong_ban}}).</p><p>Đăng ký/đăng nhập bằng email <strong>{{email_nhan_vien}}</strong> rồi bấm nút dưới đây:</p><p><a href="{{link_loi_moi}}" style="' || btn || '">Tham gia ngay</a></p><p>Liên kết hết hạn ngày {{han_loi_moi}}.</p>', true, null),
  (p_company, 'chao_mung', 'Chào mừng nhân viên mới', 'employee_joined', 'Chào mừng {{ten_nhan_vien}} đến với {{ten_cong_ty}}',
   '<h2>Chào mừng bạn!</h2><p>Chào {{ten_nhan_vien}},</p><p>{{ten_cong_ty}} rất vui chào đón bạn ở vị trí <strong>{{chuc_danh}}</strong>, phòng <strong>{{phong_ban}}</strong>.</p><p>Quản lý trực tiếp của bạn: {{ten_quan_ly}}.</p><p><a href="{{link_app}}" style="' || btn || '">Mở ONHRM</a></p>', true, null),
  (p_company, 'sinh_nhat', 'Chúc mừng sinh nhật', 'birthday', 'Chúc mừng sinh nhật {{ten_nhan_vien}} 🎂',
   '<h2 style="text-align:center">Chúc mừng sinh nhật!</h2><p style="text-align:center">Thân gửi {{ten_nhan_vien}}, toàn thể {{ten_cong_ty}} chúc bạn một tuổi mới thật nhiều sức khoẻ, niềm vui và thành công.</p>', true, null),
  (p_company, 'hop_dong_sap_het_han', 'Hợp đồng sắp hết hạn', 'contract_expiring', 'Hợp đồng {{so_hop_dong}} của {{ten_nhan_vien}} sắp hết hạn',
   '<p>Hợp đồng <strong>{{so_hop_dong}}</strong> ({{loai_hop_dong}}) của <strong>{{ten_nhan_vien}}</strong> – {{phong_ban}} sẽ hết hạn ngày <strong>{{ngay_het_han}}</strong> (còn {{so_ngay_con_lai}} ngày).</p><p>Vui lòng xem xét gia hạn hoặc thanh lý.</p>', true, null),
  (p_company, 'het_thu_viec', 'Sắp hết thử việc', 'probation_ending', '{{ten_nhan_vien}} sắp hết thời gian thử việc',
   '<p><strong>{{ten_nhan_vien}}</strong> ({{chuc_danh}} – {{phong_ban}}) sẽ hết thử việc ngày <strong>{{ngay_het_thu_viec}}</strong>. Vui lòng đánh giá kết quả thử việc.</p>', true, null),
  (p_company, 'nhac_cham_cong', 'Nhắc chấm công', 'attendance_reminder', 'Nhắc chấm công ngày {{ngay}}',
   '<p>Chào {{ten_nhan_vien}},</p><p>Hệ thống chưa ghi nhận bạn chấm công vào hôm nay ({{ngay}}). Vui lòng mở ứng dụng để chấm công.</p><p><a href="{{link_app}}" style="' || btn || '">Chấm công ngay</a></p>', true, null),
  (p_company, 'don_duoc_duyet', 'Đơn từ được duyệt', 'request_approved', 'Đơn {{loai_don}} của bạn đã được duyệt',
   '<p>Chào {{ten_nhan_vien}},</p><p>Đơn <strong>{{loai_don}}</strong> từ {{tu_ngay}} đến {{den_ngay}} đã được <strong style="color:#16a34a">duyệt</strong>.</p><p>Ghi chú: {{ghi_chu_duyet}}</p>', true, null),
  (p_company, 'don_bi_tu_choi', 'Đơn từ bị từ chối', 'request_rejected', 'Đơn {{loai_don}} của bạn bị từ chối',
   '<p>Chào {{ten_nhan_vien}},</p><p>Đơn <strong>{{loai_don}}</strong> từ {{tu_ngay}} đến {{den_ngay}} đã bị <strong style="color:#dc2626">từ chối</strong>.</p><p>Lý do: {{ghi_chu_duyet}}</p>', true, null),
  (p_company, 'di_muon', 'Cảnh báo đi muộn', 'late_threshold', '{{ten_nhan_vien}} đã đi muộn {{so_lan_di_muon}} lần trong tháng {{thang}}',
   '<p>Nhân viên <strong>{{ten_nhan_vien}}</strong> ({{phong_ban}}) đã đi muộn <strong>{{so_lan_di_muon}}</strong> lần trong tháng {{thang}}.</p>', true, null),
  (p_company, 'ho_so_moi', 'Thông báo hồ sơ mới', 'employee_created', 'Hồ sơ nhân viên mới: {{ten_nhan_vien}}',
   '<p>Hồ sơ <strong>{{ten_nhan_vien}}</strong> ({{ma_nhan_vien}}) – {{chuc_danh}}, {{phong_ban}} vừa được tạo, ngày vào làm {{ngay_vao_lam}}.</p>', true, null)
  on conflict (company_id, code) do nothing;
end;
$$;
revoke execute on function public.email_seed_templates(uuid) from public, anon, authenticated;

create or replace function public.email_seed_on_company()
returns trigger language plpgsql security definer set search_path = public
as $$ begin perform public.email_seed_templates(new.id); return new; end; $$;
revoke execute on function public.email_seed_on_company() from public, anon, authenticated;
drop trigger if exists trg_email_seed_on_company on public.companies;
create trigger trg_email_seed_on_company after insert on public.companies
  for each row execute function public.email_seed_on_company();

do $$ declare c uuid; begin for c in select id from public.companies loop perform public.email_seed_templates(c); end loop; end $$;

-- Biến chung theo nhân viên
create or replace function public.email_employee_vars(p_employee uuid)
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'ten_nhan_vien', e.full_name, 'ma_nhan_vien', coalesce(e.code, ''),
    'email_nhan_vien', coalesce(e.work_email, e.personal_email, ''),
    'phong_ban', coalesce(e.department, ''), 'chuc_danh', coalesce(e.position, ''),
    'ten_cong_ty', c.name, 'ten_quan_ly', coalesce(m.full_name, ''),
    'ngay_vao_lam', coalesce(to_char(e.hire_date, 'DD/MM/YYYY'), ''),
    'ngay', to_char((now() at time zone 'Asia/Ho_Chi_Minh')::date, 'DD/MM/YYYY'),
    'link_app', 'https://hieu-hrm.vercel.app')
  from public.employees e join public.companies c on c.id = e.company_id
  left join public.employees m on m.id = e.manager_id
  where e.id = p_employee;
$$;
revoke execute on function public.email_employee_vars(uuid) from public, anon, authenticated;

-- Ghi hàng đợi cho mọi quy tắc đang bật của sự kiện. Chống trùng: dedupe_key = rule:ref:email.
create or replace function public.email_enqueue_event(
  p_company uuid, p_event text, p_employee uuid, p_ref text, p_extra jsonb default '{}'::jsonb, p_rule uuid default null
) returns int language plpgsql security definer set search_path = public
as $$
declare
  r public.email_rules; e public.employees; v_vars jsonb; v_n int := 0; v_cnt int;
  v_to record; c jsonb;
begin
  if p_employee is not null then
    select * into e from public.employees where id = p_employee;
    if not found then return 0; end if;
  end if;
  for r in select * from public.email_rules
           where company_id = p_company and event_key = p_event and active and template_id is not null
             and (p_rule is null or id = p_rule) loop
    c := r.conditions;
    if p_employee is not null then
      if jsonb_array_length(coalesce(c->'departments','[]')) > 0 and not (c->'departments') ? coalesce(e.department,'') then continue; end if;
      if jsonb_array_length(coalesce(c->'positions','[]')) > 0 and not (c->'positions') ? coalesce(e.position,'') then continue; end if;
      if jsonb_array_length(coalesce(c->'employment_types','[]')) > 0 and not (c->'employment_types') ? coalesce(e.employment_type,'') then continue; end if;
    end if;
    if jsonb_array_length(coalesce(c->'contract_types','[]')) > 0 and not (c->'contract_types') ? coalesce(p_extra->>'loai_hop_dong','') then continue; end if;
    if jsonb_array_length(coalesce(c->'request_categories','[]')) > 0 and not (c->'request_categories') ? coalesce(p_extra->>'nhom_don','') then continue; end if;

    v_vars := coalesce(public.email_employee_vars(p_employee),
                jsonb_build_object('ten_cong_ty', (select name from public.companies where id = p_company),
                  'ngay', to_char((now() at time zone 'Asia/Ho_Chi_Minh')::date, 'DD/MM/YYYY'),
                  'link_app', 'https://hieu-hrm.vercel.app')) || coalesce(p_extra, '{}'::jsonb);

    for v_to in
      select distinct on (lower(x.email)) lower(btrim(x.email)) as email, x.name from (
        select coalesce(e.work_email, e.personal_email) as email, e.full_name as name
          where p_employee is not null and coalesce((r.recipients->>'employee')::boolean, false)
            and p_event <> 'invite_sent'
        union all
        select coalesce(m.work_email, m.personal_email), m.full_name from public.employees m
          where p_employee is not null and m.id = e.manager_id and coalesce((r.recipients->>'manager')::boolean, false)
        union all
        select u.email::text, coalesce(u.raw_user_meta_data->>'full_name', u.email::text)
          from public.company_members cm join auth.users u on u.id = cm.user_id
          where cm.company_id = p_company and cm.status = 'active' and cm.role = 'hr'
            and coalesce((r.recipients->>'hr')::boolean, false)
        union all
        select jsonb_array_elements_text(coalesce(r.recipients->'emails', '[]')), null
      ) x where x.email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'
    loop
      insert into public.email_queue (company_id, rule_id, template_id, event_key, event_ref, employee_id,
        to_email, to_name, vars, scheduled_at, dedupe_key)
      values (p_company, r.id, r.template_id, p_event, p_ref, p_employee, v_to.email, v_to.name,
        v_vars || jsonb_build_object('ten_nguoi_nhan', coalesce(v_to.name, v_to.email)),
        now() + make_interval(mins => r.delay_minutes), r.id || ':' || p_ref || ':' || v_to.email)
      on conflict (dedupe_key) do nothing;
      get diagnostics v_cnt = row_count;
      v_n := v_n + v_cnt;
    end loop;
  end loop;
  return v_n;
end;
$$;
revoke execute on function public.email_enqueue_event(uuid, text, uuid, text, jsonb, uuid) from public, anon, authenticated;

-- Sự kiện tức thời (trigger). Lỗi email không được làm hỏng nghiệp vụ chính.
create or replace function public.email_on_employee_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  begin
    if tg_op = 'INSERT' then
      perform public.email_enqueue_event(new.company_id, 'employee_created', new.id, 'emp:' || new.id);
    elsif new.user_id is not null and old.user_id is null then
      perform public.email_enqueue_event(new.company_id, 'employee_joined', new.id, 'join:' || new.id);
    end if;
  exception when others then raise warning 'email_on_employee_change: %', sqlerrm;
  end;
  return new;
end;
$$;
revoke execute on function public.email_on_employee_change() from public, anon, authenticated;
drop trigger if exists trg_email_on_employee_change on public.employees;
create trigger trg_email_on_employee_change after insert or update of user_id on public.employees
  for each row execute function public.email_on_employee_change();

create or replace function public.email_on_invite()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  begin
    perform public.email_enqueue_event(new.company_id, 'invite_sent', new.employee_id, 'inv:' || new.id,
      jsonb_build_object('link_loi_moi', 'https://hieu-hrm.vercel.app/tham-gia/' || new.token,
        'han_loi_moi', to_char(new.expires_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY'),
        'vai_tro', new.role, 'email_nhan_vien', coalesce(new.email, '')));
  exception when others then raise warning 'email_on_invite: %', sqlerrm;
  end;
  return new;
end;
$$;
revoke execute on function public.email_on_invite() from public, anon, authenticated;
drop trigger if exists trg_email_on_invite on public.company_invites;
create trigger trg_email_on_invite after insert on public.company_invites
  for each row execute function public.email_on_invite();

create or replace function public.email_on_request_decision()
returns trigger language plpgsql security definer set search_path = public
as $$
declare t public.request_types;
begin
  if new.status in ('approved','rejected') and new.status is distinct from old.status then
    begin
      select * into t from public.request_types where id = new.request_type_id;
      perform public.email_enqueue_event(new.company_id,
        case new.status when 'approved' then 'request_approved' else 'request_rejected' end,
        new.employee_id, 'req:' || new.id || ':' || new.status,
        jsonb_build_object('loai_don', coalesce(t.name, ''), 'nhom_don', coalesce(t.category, ''),
          'tu_ngay', to_char(new.start_date, 'DD/MM/YYYY'), 'den_ngay', to_char(new.end_date, 'DD/MM/YYYY'),
          'ly_do', coalesce(new.reason, ''), 'ghi_chu_duyet', coalesce(new.decision_note, '')));
    exception when others then raise warning 'email_on_request_decision: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;
revoke execute on function public.email_on_request_decision() from public, anon, authenticated;
drop trigger if exists trg_email_on_request_decision on public.requests;
create trigger trg_email_on_request_decision after update of status on public.requests
  for each row execute function public.email_on_request_decision();

create or replace function public.email_on_late()
returns trigger language plpgsql security definer set search_path = public
as $$
declare r public.email_rules; v_cnt int; v_month text := to_char(new.work_date, 'MM/YYYY');
begin
  if new.status = 'late' and (tg_op = 'INSERT' or old.status is distinct from 'late') then
    begin
      select count(*) into v_cnt from public.attendance_records a
      where a.employee_id = new.employee_id and a.status = 'late'
        and date_trunc('month', a.work_date) = date_trunc('month', new.work_date);
      for r in select * from public.email_rules where company_id = new.company_id and event_key = 'late_threshold'
               and active and threshold <= v_cnt loop
        perform public.email_enqueue_event(new.company_id, 'late_threshold', new.employee_id,
          'late:' || new.employee_id || ':' || v_month,
          jsonb_build_object('so_lan_di_muon', v_cnt, 'thang', v_month), r.id);
      end loop;
    exception when others then raise warning 'email_on_late: %', sqlerrm;
    end;
  end if;
  return new;
end;
$$;
revoke execute on function public.email_on_late() from public, anon, authenticated;
drop trigger if exists trg_email_on_late on public.attendance_records;
create trigger trg_email_on_late after insert or update of status on public.attendance_records
  for each row execute function public.email_on_late();

-- Sự kiện theo ngày: chạy mỗi lần cron; chỉ ghi khi đã tới giờ gửi (giờ VN) của quy tắc; dedupe theo ngày/năm.
create or replace function public.email_enqueue_daily(p_force boolean default false)
returns int language plpgsql security definer set search_path = public
as $$
declare
  r public.email_rules; x record; v_n int := 0;
  v_now timestamp := now() at time zone 'Asia/Ho_Chi_Minh';
  v_today date := v_now::date; v_target date;
begin
  for r in select * from public.email_rules where active and template_id is not null
           and event_key in ('birthday','contract_expiring','probation_ending','attendance_reminder') loop
    if not p_force and extract(hour from v_now) < r.send_hour then continue; end if;
    v_target := v_today + r.offset_days;
    if r.event_key = 'birthday' then
      for x in select id from public.employees where company_id = r.company_id and status in ('probation','active','leave')
               and date_of_birth is not null and to_char(date_of_birth, 'MM-DD') = to_char(v_target, 'MM-DD') loop
        v_n := v_n + public.email_enqueue_event(r.company_id, 'birthday', x.id, 'bd:' || x.id || ':' || v_target,
          jsonb_build_object('ngay_sinh', to_char(v_target, 'DD/MM'),
            'tuoi', extract(year from v_target)::int - (select extract(year from date_of_birth)::int from public.employees where id = x.id)), r.id);
      end loop;
    elsif r.event_key = 'contract_expiring' then
      for x in select c.* from public.employee_contracts c where c.company_id = r.company_id and c.status = 'active'
               and c.end_date = v_target loop
        v_n := v_n + public.email_enqueue_event(r.company_id, 'contract_expiring', x.employee_id, 'ct:' || x.id || ':' || x.end_date,
          jsonb_build_object('so_hop_dong', coalesce(x.contract_no, ''), 'loai_hop_dong', coalesce(x.contract_type, ''),
            'ngay_het_han', to_char(x.end_date, 'DD/MM/YYYY'), 'so_ngay_con_lai', x.end_date - v_today), r.id);
      end loop;
    elsif r.event_key = 'probation_ending' then
      for x in select id, probation_end_date from public.employees where company_id = r.company_id
               and status in ('probation','active') and probation_end_date = v_target loop
        v_n := v_n + public.email_enqueue_event(r.company_id, 'probation_ending', x.id, 'pb:' || x.id || ':' || x.probation_end_date,
          jsonb_build_object('ngay_het_thu_viec', to_char(x.probation_end_date, 'DD/MM/YYYY')), r.id);
      end loop;
    elsif r.event_key = 'attendance_reminder' and extract(isodow from v_today) < 7 then
      for x in select e.id from public.employees e where e.company_id = r.company_id and e.status in ('probation','active')
               and e.user_id is not null and not exists (select 1 from public.attendance_records a
                 where a.employee_id = e.id and a.work_date = v_today and a.check_in is not null) loop
        v_n := v_n + public.email_enqueue_event(r.company_id, 'attendance_reminder', x.id, 'ar:' || x.id || ':' || v_today, '{}'::jsonb, r.id);
      end loop;
    end if;
  end loop;
  return v_n;
end;
$$;
revoke execute on function public.email_enqueue_daily(boolean) from public, anon, authenticated;

-- Edge function lấy lô thư đến hạn (khoá dòng, tránh 2 lần chạy gửi trùng).
create or replace function public.email_claim_batch(p_limit int default 50, p_company uuid default null)
returns setof public.email_queue language sql security definer set search_path = public
as $$
  update public.email_queue q set status = 'sending', attempts = attempts + 1
  where q.id in (select id from public.email_queue
                 where (status = 'pending' or (status = 'sending' and scheduled_at < now() - interval '15 minutes' and attempts < 3))
                   and scheduled_at <= now() and (p_company is null or company_id = p_company)
                 order by scheduled_at limit p_limit for update skip locked)
  returning q.*;
$$;
revoke execute on function public.email_claim_batch(int, uuid) from public, anon, authenticated;

-- Admin/HR: thử chạy sự kiện theo ngày ngay, gửi lại thư lỗi.
create or replace function public.email_run_daily_now(p_company uuid)
returns int language plpgsql security definer set search_path = public
as $$
declare v int;
begin
  if not public.has_company_role(p_company, array['owner','admin','hr']) then raise exception 'FORBIDDEN'; end if;
  select public.email_enqueue_daily(true) into v;
  return v;
end;
$$;
revoke execute on function public.email_run_daily_now(uuid) from public, anon;
grant execute on function public.email_run_daily_now(uuid) to authenticated;

create or replace function public.email_retry(p_queue uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_company uuid;
begin
  select company_id into v_company from public.email_queue where id = p_queue and status in ('failed','skipped');
  if v_company is null then raise exception 'NOT_FOUND'; end if;
  if not public.has_company_role(v_company, array['owner','admin','hr']) then raise exception 'FORBIDDEN'; end if;
  update public.email_queue set status = 'pending', attempts = 0, error = null, scheduled_at = now() where id = p_queue;
end;
$$;
revoke execute on function public.email_retry(uuid) from public, anon;
grant execute on function public.email_retry(uuid) to authenticated;

-- Cron: mỗi 10 phút ghi sự kiện theo ngày rồi gọi edge function gửi hàng đợi.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create or replace function public.email_cron_tick()
returns void language plpgsql security definer set search_path = public
as $$
declare v_secret text;
begin
  perform public.email_enqueue_daily(false);
  if exists (select 1 from public.email_queue where status = 'pending' and scheduled_at <= now()) then
    select cron_secret into v_secret from public.email_dispatch_config where id = 1;
    perform net.http_post(
      url := 'https://yrdcsbjlvgycipzpogbv.supabase.co/functions/v1/send-queued-emails',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
      body := jsonb_build_object('mode', 'process'));
  end if;
end;
$$;
revoke execute on function public.email_cron_tick() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'email-tick';
  perform cron.schedule('email-tick', '*/10 * * * *', 'select public.email_cron_tick()');
end $$;
