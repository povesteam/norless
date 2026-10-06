#!/bin/sh
# Imports the old app's data into the local database from scratch, as often as needed:
# from a fresh backup of production and its oplog (mongodump only reads), or from the
# backup archive given as the first argument and its oplog as the second. Stop
# run-dev.sh first. With --keep first, it imports into the database as it is instead,
# keeping what exists only in the new app (data-import spec, Re-runnable), as
# deploy/import.sh does with production's.
#
# Settings come from the environment, or from the git-ignored .env next to this file:
#   DATABASE_PATH  the local database (default: data/norless.db)
#   PROD_SSH       where the old app runs, for a fresh backup (e.g. root@old-app.example.com)
#   OWNER_EMAIL    who is invited as owner again after the import
set -e
cd "$(dirname "$0")"

# .env fills in what the environment doesn't set.
if [ -f .env ]; then
  while IFS='=' read -r key value; do
    case "$key" in "" | "#"*) continue ;; esac
    eval "[ -n \"\${$key+set}\" ]" || export "$key=$value"
  done <.env
fi
# Node 24 from Homebrew, where it isn't the default node.
if [ -d /opt/homebrew/opt/node@24/bin ]; then
  PATH="/opt/homebrew/opt/node@24/bin:$PATH"
fi
db="${DATABASE_PATH:-data/norless.db}"
if lsof -t "$db" >/dev/null 2>&1; then
  echo "Something has $db open (run-dev.sh?): stop it first." >&2
  exit 1
fi

keep=
if [ "$1" = --keep ]; then
  keep=1
  shift
fi
archive="$1"
# The old app's oplog, for history the backup doesn't keep: given, or
# taken with a fresh backup.
oplog="$2"
if [ -z "$archive" ]; then
  if [ -z "$PROD_SSH" ]; then
    echo "Set PROD_SSH in .env, or pass a backup archive." >&2
    exit 1
  fi
  mkdir -p "$(dirname "$db")"
  archive="$(dirname "$db")/$(date +%Y-%m-%d-%H%M)-norless-all.mongodump.archive.gzip"
  echo "Taking a fresh backup from ${PROD_SSH}…"
  # No --db: both databases (norless, norless-ua), as the hourly backup takes them.
  ssh "$PROD_SSH" docker exec -i norless-mongo mongodump --archive --gzip --quiet \
    >"$archive.tmp"
  mv "$archive.tmp" "$archive"
  oplog="${archive%-norless-all.mongodump.archive.gzip}-oplog.mongodump.archive.gzip"
  echo "And its oplog…"
  ssh "$PROD_SSH" docker exec -i norless-mongo mongodump --db local --collection oplog.rs \
    --archive --gzip --quiet >"$oplog.tmp"
  mv "$oplog.tmp" "$oplog"
fi

mkdir -p "$(dirname "$db")"
if [ -z "$keep" ]; then
  rm -f "$db" "$db-wal" "$db-shm"
elif [ ! -f "$db" ]; then
  echo "--keep imports into $db, which doesn't exist." >&2
  exit 1
fi
export DATABASE_PATH="$db"
if [ -n "$oplog" ]; then
  npm run --silent import -- "$archive" --oplog "$oplog"
else
  npm run --silent import -- "$archive"
fi
# A kept database keeps its members.
if [ -n "$OWNER_EMAIL" ] && [ -z "$keep" ]; then
  npm run --silent invite -- "$OWNER_EMAIL" owner
fi
echo "Imported $archive into $db."
