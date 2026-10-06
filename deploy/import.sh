#!/usr/bin/env bash
# Imports the old app's data into production in place: the Saturday night before the
# shadow Sunday, and the night before cutover. Run on the Mac, on the commit production
# runs:
#   deploy/import.sh [<archive> <oplog>]
# Production stops and its database comes to the Mac as a checked copy. A fresh backup of
# the old app and its oplog (or the archive and oplog given) is imported into that copy by
# run-reimport.sh --keep, which keeps what exists only in the new app; the result is tried
# with rehearse.sh, and only then replaces production's database, and production starts
# again. A step that fails before that starts production again on its own database,
# untouched. The copies stay in a folder of their own: before.db, from before the import,
# is the one to restore by hand (README.md, Backups).
#
# Settings come from the environment (and PROD_SSH, for the old app, from .env too):
#   NORLESS_VM        the VM, as root (default root@norless.com)
#   NORLESS_ROOT_KEY  its key (default ~/.ssh/norless-root, which deploy/setup.sh made)
#   IMPORT_DIR        where the copies go (default ~/norless-import)
set -euo pipefail
cd "$(dirname "$0")/.."
vm=${NORLESS_VM:-root@norless.com}
key=${NORLESS_ROOT_KEY:-$HOME/.ssh/norless-root}
work=${IMPORT_DIR:-$HOME/norless-import}/$(date +%Y-%m-%d-%H%M%S)
on_vm() { ssh -i "$key" -o BatchMode=yes "$vm" "cd /opt/norless && $1"; }
# A one-off container of the service on its volume, while the service is stopped.
one_off="docker compose run --rm --no-deps -T norless"
is_db() { [ "$(head -c 15 "$1")" = "SQLite format 3" ]; }

# Production's version, so the import writes what that version reads.
tag=$(on_vm "sed -n 's/^PRODUCTION_TAG=//p' .env")
version=$tag
[[ "$tag" =~ ^sha-([0-9a-f]{7,40})$ ]] && version=${BASH_REMATCH[1]}
if [ -z "$tag" ] ||
  [ "$(git rev-parse --verify --quiet "$version^{commit}" || true)" != "$(git rev-parse HEAD)" ]; then
  echo "Production runs ${tag:-an unknown version}: check out that commit first." >&2
  exit 1
fi
if ! git diff --quiet HEAD -- src migrations package.json package-lock.json Dockerfile; then
  echo "The import's code has changes that aren't committed: commit or stash them first." >&2
  exit 1
fi
# A candidate answers for the service while it's stopped (Caddyfile), on the same database.
if [ -n "$(on_vm "docker ps -q -f name=norless-candidate")" ]; then
  echo "A deploy waits for its switch: confirm or drop it first." >&2
  exit 1
fi

mkdir -p "$work"
pushed=
again() {
  if [ -z "$pushed" ] && on_vm "docker compose start norless" >/dev/null; then
    echo "Production runs again on its own database, untouched." >&2
  fi
}
trap again EXIT

echo "Stopping production…"
on_vm "docker compose stop norless"
echo "Copying its database to ${work}…"
on_vm "$one_off sh -c 'node dist/server/cli/backup.js >&2 && cat /data/backups/latest.db'" \
  >"$work/before.db"
if ! is_db "$work/before.db"; then
  echo "The copy of production's database isn't a database." >&2
  exit 1
fi
cp "$work/before.db" "$work/imported.db"

DATABASE_PATH="$work/imported.db" ./run-reimport.sh --keep "$@"
deploy/rehearse.sh "$work/imported.db"

# Written beside it, then moved over it: a broken upload leaves the database as it was.
replace() {
  on_vm "$one_off sh -c 'cat > /data/import.db && mv /data/import.db /data/norless.db && rm -f /data/norless.db-wal /data/norless.db-shm'" <"$1"
}
echo "Replacing production's database…"
replace "$work/imported.db"
pushed=1
on_vm "docker compose start norless" >/dev/null
# Docker's own health check (Dockerfile), every 30 seconds: up to 2 minutes.
for _ in $(seq 40); do
  health=$(on_vm "docker inspect --format '{{.State.Health.Status}}' \$(docker compose ps -q norless)")
  if [ "$health" = healthy ]; then
    echo "Production runs on the imported data. Before the import: $work/before.db"
    exit 0
  fi
  sleep 3
done
echo "Production isn't healthy on the imported data: it goes back to before.db." >&2
on_vm "docker compose stop norless"
replace "$work/before.db"
on_vm "docker compose start norless" >/dev/null
exit 1
