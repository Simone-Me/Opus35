#!/usr/bin/env bash
# Runs the SQL test-suite against a disposable Postgres (local or CI).
# Uses the standard libpq env vars (PGHOST, PGPORT, PGUSER, PGPASSWORD).
# The target server must NOT be the real Supabase project: databases are dropped.
set -euo pipefail

cd "$(dirname "$0")/.."

DB_NAME="${TEST_DB_NAME:-opus35_test}"
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

reset_db() {
  "${PSQL[@]}" -d postgres -c "drop database if exists ${DB_NAME}" -c "create database ${DB_NAME}"
}

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

dump_schema() {
  pg_dump --schema-only --no-owner --schema=public "${DB_NAME}" | grep -vE '^(--|\\(un)?restrict|$)'
}

run() {
  "${PSQL[@]}" -d "${DB_NAME}" -f "$1"
}

echo "== Path 1: stub + schema.sql (run twice, must be idempotent) + checks"
reset_db
run supabase/tests/supabase_stub.sql
run supabase/schema.sql
run supabase/schema.sql
dump_schema > "${TMP_DIR}/schema-fresh.sql"
run supabase/tests/rls_test.sql

echo "== Path 2: stub + schema.sql + every migration replayed (must be idempotent) + checks"
reset_db
run supabase/tests/supabase_stub.sql
run supabase/schema.sql
for migration in supabase/migrations/*.sql; do
  echo "   - ${migration}"
  run "${migration}"
done
run supabase/tests/rls_test.sql

echo "== Path 3: production upgrade (objects from the latest migration absent) + checks"
reset_db
run supabase/tests/supabase_stub.sql
run supabase/schema.sql
run supabase/tests/drop_latest_migration_objects.sql
run supabase/migrations/202610050001_hardening_rpc_views.sql
dump_schema > "${TMP_DIR}/schema-upgraded.sql"
run supabase/tests/rls_test.sql

echo "== schema.sql and the upgraded production schema must match"
diff -u "${TMP_DIR}/schema-fresh.sql" "${TMP_DIR}/schema-upgraded.sql"

"${PSQL[@]}" -d postgres -c "drop database if exists ${DB_NAME}"
echo "SQL tests passed"
