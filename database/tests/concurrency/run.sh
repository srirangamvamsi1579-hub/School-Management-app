#!/usr/bin/env bash
# Build a fresh database, load all migrations and the fixture, then run the concurrency and load tests.
# Usage: PGHOST=/tmp/pgt PGPORT=5499 ./run.sh
set -euo pipefail
DB=${PGDATABASE_TEST:-school_conc}
HERE="$(cd "$(dirname "$0")" && pwd)"; ROOT="$HERE/../.."
psql -U postgres -qc "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB" >/dev/null
for f in "$ROOT"/0*.sql; do psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null; done
psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q -f "$HERE/fixture.sql" >/dev/null
cd "$HERE" && PGDATABASE=$DB node run.mjs
