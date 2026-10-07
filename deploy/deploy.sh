#!/usr/bin/env bash
# Deploys an image tag to production while the running version keeps serving (see
# README.md), its converter first. The deploy key may only run this:
#   ssh deploy@vm "production 1a2b3c4"         a checked backup, then the new image as
#                                                 a candidate beside the running one;
#                                                 stopped if it isn't healthy within a minute
#   ssh deploy@vm "production 1a2b3c4 switch"  once a maintainer confirms: the candidate
#                                                 stands in while the service restarts on it
#   ssh deploy@vm "production 1a2b3c4 stop"    drops the candidate
set -euo pipefail

usage() {
  echo "usage: production <tag> [switch|stop]" >&2
  exit 2
}
# Through the forced command, what the client asked for is in SSH_ORIGINAL_COMMAND.
read -r target tag step extra <<<"${SSH_ORIGINAL_COMMAND:-$*}" || true
service=norless variable=PRODUCTION_TAG
# Its converter, whose jobs keep their paths, so it runs a version
# ahead of the service until the switch.
converter=converter converter_variable=CONVERTER_PRODUCTION_TAG
step=${step:-start}
if [[ "${target:-}" != production || -n "${extra:-}" ||
  ! "${tag:-}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ||
  ! "$step" =~ ^(start|switch|stop)$ ]]; then
  usage
fi

cd "$(dirname "$0")"
# Caddy sends requests to it only while the service itself doesn't answer (Caddyfile).
candidate="$service-candidate"
set_var() {
  grep -q "^$1=" .env || echo "$1=" >>.env
  sed -i.bak "s/^$1=.*/$1=$2/" .env && rm -f .env.bak
}
set_tag() { set_var "$variable" "$1"; }
healthy() {
  docker exec "$1" node -e \
    "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))" \
    2>/dev/null
}
# Up to a minute.
becomes_healthy() {
  for _ in $(seq 30); do
    if healthy "$1"; then return 0; fi
    sleep 2
  done
  return 1
}
drop_candidate() { docker rm -f "$candidate" >/dev/null 2>&1 || true; }
converter_healthy() {
  for _ in $(seq 30); do
    if docker compose exec -T "$converter" node -e \
      "fetch('http://127.0.0.1:3900/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))" \
      2>/dev/null; then return 0; fi
    sleep 2
  done
  return 1
}
running() { docker compose ps -q "$service"; }

case "$step" in
  start)
    if docker compose ps --status running --services | grep -qx "$service"; then
      docker compose exec -T "$service" node dist/server/cli/backup.js
    fi
    drop_candidate
    # The converter first: jobs that come while it restarts are tried again.
    previous_converter=$(grep "^$converter_variable=" .env | cut -d= -f2- || true)
    set_var "$converter_variable" "$tag"
    docker compose pull "$converter"
    docker compose up -d "$converter"
    if ! converter_healthy; then
      set_var "$converter_variable" "$previous_converter"
      [[ -n "$previous_converter" ]] && docker compose up -d "$converter"
      echo "$tag's converter isn't healthy after a minute: the old one is back; $target goes on as it was" >&2
      exit 1
    fi
    # The service as it's set up, with the new tag, under the candidate's name.
    env "$variable=$tag" docker compose pull "$service"
    env "$variable=$tag" docker compose run -d --no-deps --name "$candidate" "$service"
    if becomes_healthy "$candidate"; then
      echo "$tag runs beside $target's version, which keeps serving; confirm to switch"
      exit 0
    fi
    drop_candidate
    echo "$tag isn't healthy after a minute: stopped; $target goes on as it was" >&2
    exit 1
    ;;
  switch)
    image=$(docker inspect --format '{{.Config.Image}}' "$candidate" 2>/dev/null || true)
    if [[ "$image" != *":$tag" ]] || ! healthy "$candidate"; then
      echo "No healthy candidate of $tag to switch to" >&2
      exit 1
    fi
    previous=$(grep "^$variable=" .env | cut -d= -f2-)
    set_tag "$tag"
    docker compose up -d "$service"
    if becomes_healthy "$(running)"; then
      drop_candidate
      echo "$target now runs $tag"
      exit 0
    fi
    echo "$target isn't healthy on $tag: it goes back to $previous" >&2
    set_tag "$previous"
    docker compose up -d "$service"
    becomes_healthy "$(running)" || true
    drop_candidate
    exit 1
    ;;
  stop)
    drop_candidate
    echo "$target's candidate is gone; $target runs as it was"
    ;;
esac
