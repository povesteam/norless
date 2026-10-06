#!/bin/sh
# Runs Norless locally: the server, which restarts on changes, and the app with hot
# reload on http://127.0.0.1:5173. Ctrl+C stops both.
#
# Settings come from the environment, or from a git-ignored .env next to this file,
# e.g. DATABASE_PATH=/path/to/norless.db (default: data/norless.db). The login without
# verification is on.
set -e
cd "$(dirname "$0")"

# .env fills in what the environment doesn't set.
if [ -f .env ]; then
  while IFS='=' read -r key value; do
    case "$key" in "" | "#"*) continue ;; esac
    eval "[ -n \"\${$key+set}\" ]" || export "$key=$value"
  done <.env
fi
export DEV_LOGIN=1
export CONVERTER_URL="${CONVERTER_URL:-http://127.0.0.1:3900}"

# Node 24 from Homebrew, where it isn't the default node.
if [ -d /opt/homebrew/opt/node@24/bin ]; then
  PATH="/opt/homebrew/opt/node@24/bin:$PATH"
fi
[ -d node_modules ] || npm ci

trap 'trap - INT TERM EXIT; kill 0' INT TERM EXIT
# The converter's container reads recordings and pictures, as in production
#; without Docker, the rest runs and those wait for it.
(npm run converter || echo "The converter needs Docker: recordings and pictures wait for it.") &
npm run dev:server &
npm run dev:client
