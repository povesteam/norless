#!/usr/bin/env bash
# Tries this checkout on real data before it's deployed to production:
# builds the app's image, runs it on a copy of a backup the Mac pulled, and checks that it
# starts (its migrations ran), answers, and leaves a sound database. Nothing leaves the
# machine, and the copy is deleted afterwards.
#   deploy/rehearse.sh <backup.db>    e.g. the newest of the hourly pulls (README.md)
set -euo pipefail
backup=${1:-}
if [ ! -f "$backup" ] || [ "$(head -c 15 "$backup")" != "SQLite format 3" ]; then
  echo "usage: deploy/rehearse.sh <backup.db>, a database pulled from the VM" >&2
  exit 2
fi
cd "$(dirname "$0")/.."
name=norless-rehearsal
port=${REHEARSE_PORT:-3999}
data=$(mktemp -d)
trap 'docker rm -f "$name" >/dev/null 2>&1 || true; rm -rf "$data"' EXIT
cp "$backup" "$data/norless.db"

echo "Building this checkout ($(git rev-parse --short HEAD))…"
docker build -q -t norless:rehearsal . >/dev/null
docker rm -f "$name" >/dev/null 2>&1 || true
docker run -d --name "$name" -e APP_ORIGIN="http://localhost:$port" \
  -v "$data:/data" -p "$port:3000" norless:rehearsal >/dev/null

fail() {
  echo "✗ $1" >&2
  docker logs --tail 40 "$name" >&2
  exit 1
}
for _ in $(seq 60); do
  curl -fs -o /dev/null "http://localhost:$port/api/health" && break
  sleep 1
done
curl -fsS -o /dev/null "http://localhost:$port/api/health" || fail "Not healthy after a minute"
echo "✓ Started on the backup: its migrations ran"
curl -fsS -o /dev/null "http://localhost:$port/" || fail "The home page doesn't load"
echo "✓ The home page loads"
# The app's own checked backup: SQLite's integrity check on the migrated database.
docker exec "$name" node dist/server/cli/backup.js >/dev/null || fail "The migrated database isn't sound"
echo "✓ The migrated database passes the integrity check"
echo "Ready to deploy."
