#!/usr/bin/env bash
#
# Migrate a Neon database (schema + data) from one branch to another — used to
# move from the old us-east-1 project to the new ap-southeast-1 (Singapore) one.
#
# Usage:
#   scripts/migrate-neon-region.sh <label> <SRC_URL> <DST_URL>
#
# SRC_URL / DST_URL may be pooled (-pooler) connection strings — the script
# forces the DIRECT endpoint, because pg_dump / pg_restore do NOT work through
# Neon's transaction pooler.
#
# The restore uses --clean --if-exists, so the target's existing objects are
# dropped and replaced. Run against an empty or disposable target.

set -euo pipefail

PG_BIN="/opt/homebrew/opt/libpq/bin"
PGDUMP="$PG_BIN/pg_dump"
PGRESTORE="$PG_BIN/pg_restore"
PSQL="$PG_BIN/psql"

if [[ $# -ne 3 ]]; then
  echo "usage: $0 <label> <SRC_URL> <DST_URL>" >&2
  exit 1
fi

label="$1"
SRC="$2"
DST="$3"

# pooled → direct: strip the "-pooler" from the host
direct() { printf '%s' "$1" | sed -E 's/-pooler\./\./'; }
SRC_DIRECT="$(direct "$SRC")"
DST_DIRECT="$(direct "$DST")"

stamp="$(date +%Y%m%d-%H%M%S)"
dump="/tmp/neon-${label}-${stamp}.dump"

echo "▶ [$label] dumping source → $dump"
"$PGDUMP" -Fc --no-owner --no-privileges -f "$dump" "$SRC_DIRECT"
echo "  dump size: $(du -h "$dump" | cut -f1)"

echo "▶ [$label] restoring into target (drops + replaces existing objects)…"
# Neon→Neon restores emit a few benign role/extension notices; --no-owner
# --no-privileges avoids the real ones. We don't pass --exit-on-error so a
# harmless notice can't abort a good restore — the row-count check below is the
# real success gate.
"$PGRESTORE" --clean --if-exists --no-owner --no-privileges \
  -d "$DST_DIRECT" "$dump" || true

echo "▶ [$label] verifying row counts (source vs target)…"
count_sql="SELECT 'Product' t, count(*) n FROM \"Product\"
  UNION ALL SELECT 'ProductVariant', count(*) FROM \"ProductVariant\"
  UNION ALL SELECT 'Order', count(*) FROM \"Order\"
  UNION ALL SELECT 'OrderItem', count(*) FROM \"OrderItem\"
  UNION ALL SELECT 'User', count(*) FROM \"User\"
  UNION ALL SELECT 'SiteSetting', count(*) FROM \"SiteSetting\"
  ORDER BY t;"

echo "  --- source ---"
"$PSQL" "$SRC_DIRECT" -At -F$'\t' -c "$count_sql"
echo "  --- target ---"
"$PSQL" "$DST_DIRECT" -At -F$'\t' -c "$count_sql"

echo "✓ [$label] done. Compare the two tables above — they should match."
