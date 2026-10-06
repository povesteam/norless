#!/bin/sh
# Runs Norless locally as run-dev.sh does, and opens it to this Mac's tailnet over
# HTTPS (the session cookie is Secure), to try a change on a phone in seconds:
#   ./run-phone.sh [backup.db]
# With a backup (e.g. the newest one pulled from norless.com), it runs on a copy of it,
# data/phone.db; without, on the usual database. The login without verification is on,
# so it's served only to the tailnet, never on the internet (tailscale serve, not
# funnel). Ctrl+C stops it and the serving.
set -e
cd "$(dirname "$0")"

if [ -n "$1" ]; then
  mkdir -p data
  cp "$1" data/phone.db
  rm -f data/phone.db-wal data/phone.db-shm
  export DATABASE_PATH=data/phone.db
fi
host=$(tailscale status --json | jq -r '.Self.DNSName | rtrimstr(".")')
# Vite answers on [::1] only; the bare port would proxy to 127.0.0.1.
tailscale serve --bg http://localhost:5173 >/dev/null
trap 'tailscale serve reset' EXIT
echo "On the phone: https://$host"
__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS=$host ./run-dev.sh
