-- Tốc độ: (1) bọc auth.uid()/auth.jwt()/current_setting() trong RLS bằng (select ...) để Postgres
-- tính 1 lần/truy vấn thay vì mỗi dòng (advisor auth_rls_initplan);
-- (2) thêm index cho khoá ngoại 1 cột chưa có index (advisor unindexed_foreign_keys). Không đổi logic quyền.
do $$
declare
  r record;
  v_qual text;
  v_check text;
  v_sql text;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~ '(auth\.(uid|jwt|role)\(\)|current_setting\()'
        or coalesce(with_check, '') ~ '(auth\.(uid|jwt|role)\(\)|current_setting\()')
  loop
    v_qual := r.qual;
    v_check := r.with_check;
    -- Bỏ dạng đã bọc sẵn về dạng thường rồi bọc lại đồng nhất (tránh bọc 2 lần).
    v_qual := regexp_replace(v_qual, '\(\s*SELECT auth\.(uid|jwt|role)\(\) AS \w+\)', 'auth.\1()', 'g');
    v_check := regexp_replace(v_check, '\(\s*SELECT auth\.(uid|jwt|role)\(\) AS \w+\)', 'auth.\1()', 'g');
    v_qual := regexp_replace(v_qual, 'auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'g');
    v_check := regexp_replace(v_check, 'auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'g');
    if v_qual is not distinct from r.qual and v_check is not distinct from r.with_check then
      continue;
    end if;
    v_sql := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if v_qual is not null then v_sql := v_sql || ' using (' || v_qual || ')'; end if;
    if v_check is not null then v_sql := v_sql || ' with check (' || v_check || ')'; end if;
    execute v_sql;
  end loop;
end $$;

do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tbl, a.attname as col, cl.relname as tname
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace and n.nspname = 'public'
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and array_length(c.conkey, 1) = 1
      and not exists (
        select 1 from pg_index i
        where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]
      )
  loop
    execute format('create index if not exists %I on %s (%I)',
      left('idx_' || r.tname || '_' || r.col, 63), r.tbl, r.col);
  end loop;
end $$;
