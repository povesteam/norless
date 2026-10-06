#!/usr/bin/env bash
# The Mac's backup key may only run this (see README.md).
# - Without a command, it sends the latest checked database backup to standard output,
#   then notes the time of the pull, which the 48-hour alert reads.
#   On the Mac: ssh -T -o IdentitiesOnly=yes -i ~/.ssh/norless-backup deploy@norless.com > norless.db
# - Asked for "recordings" or "slides" (slides from files), it reads the
#   files of that folder the Mac already has (one path per line) and sends a tar of the
#   others.
#   On the Mac: (cd recordings && find . -type f) | ssh -T -o IdentitiesOnly=yes -i ~/.ssh/norless-backup deploy@norless.com recordings | tar -x -C recordings
set -euo pipefail
cd "$(dirname "$0")"
folder="${SSH_ORIGINAL_COMMAND:-}"
if [ "$folder" = "recordings" ] || [ "$folder" = "slides" ]; then
  docker compose exec -T -e FOLDER="$folder" norless sh -c '
    mkdir -p "/data/$FOLDER" && cd "/data/$FOLDER"
    have=$(mktemp)
    sort > "$have"
    # Finished files only: an upload in progress is cut later.
    new=$(find . -type f ! -name "upload.*" | sort | comm -23 - "$have")
    rm -f "$have"
    # Nothing new sends nothing, where tar would say "empty archive" in the log each hour.
    [ -z "$new" ] || printf "%s\n" "$new" | tar -c -T - -f -'
  exit 0
fi
docker compose exec -T norless sh -c \
  'cat /data/backups/latest.db && date -u +%Y-%m-%dT%H:%M:%SZ > /data/backups/pulled-at'
