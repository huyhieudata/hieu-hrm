#!/usr/bin/env bash
# Áp dụng các migration MỚI (supabase/migrations/YYYYMMDDHHMMSS_ten.sql) lên Supabase
# qua Management API. Bỏ qua file cũ dạng migration_* (không đuôi .sql, đã áp dụng).
# Mỗi file chạy trong 1 transaction và được ghi vào supabase_migrations.schema_migrations;
# file có version đã tồn tại trong bảng sẽ bị bỏ qua -> không bao giờ chạy lại.
set -euo pipefail
: "${SUPABASE_ACCESS_TOKEN:?missing}"; : "${PROJECT_REF:?missing}"
API="https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query"
q() { jq -n --arg q "$1" '{query:$q}' | curl -sS --fail-with-body -X POST "$API" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" -H "Content-Type: application/json" -d @-; }

applied=$(q "select version from supabase_migrations.schema_migrations" | jq -r '.[].version')
shopt -s nullglob
count=0
for f in $(ls supabase/migrations/*.sql 2>/dev/null | sort); do
  base=$(basename "$f" .sql)
  if [[ ! "$base" =~ ^([0-9]{14})_([a-z0-9_]+)$ ]]; then
    echo "::error::Tên migration sai quy ước (YYYYMMDDHHMMSS_ten.sql): $f"; exit 1; fi
  ver="${BASH_REMATCH[1]}"; name="${BASH_REMATCH[2]}"
  if grep -qx "$ver" <<<"$applied"; then echo "Đã áp dụng, bỏ qua: $base"; continue; fi
  echo "Áp dụng: $base"
  sql=$(cat "$f")
  esc_name=${name//\'/\'\'}
  q "begin;
$sql
;
insert into supabase_migrations.schema_migrations(version, name) values ('$ver', '$esc_name');
commit;" >/dev/null
  count=$((count+1))
done
echo "Xong, đã áp dụng $count migration mới."
