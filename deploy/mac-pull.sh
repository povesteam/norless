#!/bin/bash
# The Mac's pull from norless.com (README.md, Backups), run by cron every hour:
#   0 * * * * ~/bin/norless-pull.sh <folder> >> ~/bin/norless-pull.log 2>&1
# The database once a day, at the first try of the day, then the recordings and slides
# the Mac doesn't have yet. setup.sh installs it as ~/bin/norless-pull.sh.
set -uo pipefail
date
base=$1
# Only this key: ssh would offer the agent's keys first, and the deploy user would
# run deploy.sh for one it knows.
pull() { ssh -T -o IdentitiesOnly=yes -i ~/.ssh/norless-backup deploy@norless.com "$@"; }

db=$base/norless-backup/$(date +%F)-norless.db
if [ ! -s "$db" ]; then
  mkdir -p "$base/norless-backup"
  pull > "$db.tmp" && mv "$db.tmp" "$db" && echo "pulled $db"
fi

for folder in recordings slides; do
  mkdir -p "$base/norless-$folder"
  (cd "$base/norless-$folder" && find . -type f | pull "$folder" | tar -xv)
done
