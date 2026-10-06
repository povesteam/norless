#!/usr/bin/env bash
# Sets Norless up on its VM: every step only a maintainer can do,
# in order, each checked, skippable, and remembered once done, so running it
# again goes on where it stopped. Run it on the Mac, from anywhere in the repo:
#   deploy/setup.sh               the steps not done yet
#   deploy/setup.sh status        which are done
#   deploy/setup.sh redo <step>   forgets that a step is done, so the next run does it again
#                                 (e.g. redo vm_files after compose.yaml changed)
# Secrets are typed here, hidden, and go straight to the VM's .env or GitHub; nothing
# is written into the repo. The state (steps done, the IP, non-secret answers) is in
# ~/.norless-setup. Works with macOS's bash 3.2.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
STATE=${NORLESS_SETUP_STATE:-$HOME/.norless-setup}
ROOT_KEY=$HOME/.ssh/norless-root
[ -d /opt/homebrew/opt/node@24/bin ] && PATH=/opt/homebrew/opt/node@24/bin:$PATH
touch "$STATE" && chmod 600 "$STATE"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
note() { printf '  %s\n' "$@"; }
get() { sed -n "s/^$1=//p" "$STATE" | tail -1; }
put() {
  { grep -v "^$1=" "$STATE" || true; printf '%s=%s\n' "$1" "$2"; } >"$STATE.new"
  mv "$STATE.new" "$STATE"
}
# A value kept in the state file, asked for once.
ask() {
  local value
  value=$(get "$1")
  if [ -z "$value" ]; then
    read -rp "  $2${3:+ [$3]}: " value </dev/tty
    value=${value:-${3:-}}
    put "$1" "$value"
  fi
  printf '%s' "$value"
}
secret() {
  local value
  read -rsp "  $1 (hidden): " value </dev/tty
  echo >&2
  printf '%s' "$value"
}
yes_no() {
  local answer
  read -rp "  $1 [y/N] " answer </dev/tty
  [ "$answer" = y ] || [ "$answer" = Y ]
}
wait_enter() { read -rp "  $1 Then press Enter. " _ </dev/tty; }

vm() { ssh -i "$ROOT_KEY" -o StrictHostKeyChecking=accept-new "root@$(get ip)" "$@"; }
# A line of the VM's .env, its value sent on standard input, never in a command line.
set_env() {
  printf '%s' "$2" | vm "cd /opt/norless && touch .env && value=\$(cat) &&
    { grep -v '^$1=' .env || true; printf '%s=%s\n' '$1' \"\$value\"; } > .env.new &&
    chown deploy:deploy .env.new && chmod 600 .env.new && mv .env.new .env"
}
has_env() { vm "grep -q '^$1=.' /opt/norless/.env 2>/dev/null"; }
# A key in the deploy user's authorized_keys, replacing the one with the same comment.
add_key() {
  printf '%s\n' "$2" | vm "f=/home/deploy/.ssh/authorized_keys &&
    { grep -v ' $1\$' \$f || true; cat; } > \$f.new &&
    install -o deploy -g deploy -m 600 \$f.new \$f && rm \$f.new"
}
forced() {
  printf 'command="%s",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty %s' "$1" "$(cat "$2")"
}
# Whether anyone can pull an image from ghcr.io without logging in.
public_image() {
  local token
  token=$(curl -fsS "https://ghcr.io/token?scope=repository:$1:pull" | jq -r .token) &&
    curl -fsS -o /dev/null -H "Authorization: Bearer $token" "https://ghcr.io/v2/$1/tags/list"
}
image_path() { get repo | tr '[:upper:]' '[:lower:]'; }
latest_run() { gh run list -R "$(get repo)" -w deploy.yml -L 1 --json "$1" -q ".[0].$1 // empty"; }

step_tools() {
  command -v gh >/dev/null || { yes_no "Install gh, the GitHub CLI, with Homebrew?" && brew install gh; }
  gh auth status >/dev/null 2>&1 || gh auth login --web --git-protocol https --scopes workflow
  gh auth setup-git
  gh auth status >/dev/null 2>&1
}

step_repo() {
  local owner name repo
  owner=$(gh api user -q .login) || return 1
  name=$(ask repo_name "The repository's name" norless)
  repo="$owner/$name"
  put repo "$repo"
  if ! gh repo view "$repo" >/dev/null 2>&1; then
    note "Creates github.com/$repo, public (AGPL), for this checkout."
    yes_no "Create it?" || return 1
    gh repo create "$repo" --public --description "Songs, playlists and live projection for churches" || return 1
  fi
  git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$repo.git"
  if [ "$(git ls-remote origin refs/heads/main | cut -f1)" != "$(git rev-parse main)" ]; then
    yes_no "Push main to github.com/$repo?" && git push -u origin main
  fi
  [ -n "$(git ls-remote origin refs/heads/main)" ]
}

step_server() {
  [ -f "$ROOT_KEY" ] || ssh-keygen -q -t ed25519 -N "" -C norless-root -f "$ROOT_KEY"
  if [ -z "$(get ip)" ]; then
    pbcopy <"$ROOT_KEY.pub"
    note "In Hetzner's console (opening it), Add Server:" \
      "  type CX23 (x86) or CAX11 (Arm), whichever is in stock, in Nuremberg, Falkenstein or Helsinki;" \
      "  image Debian (the newest), public IPv4, no backups;" \
      "  SSH key: paste this one (it's in the clipboard), name it norless-root:" \
      "  $(cat "$ROOT_KEY.pub")" \
      "  name: norless. Create it and copy its IPv4 address."
    open "https://console.hetzner.cloud/"
    ask ip "The server's IPv4 address" >/dev/null
  fi
  if ! vm true; then
    note "Can't log in as root on $(get ip) with $ROOT_KEY."
    put ip ""
    return 1
  fi
}

step_dns() {
  local ip host ok=0
  ip=$(get ip)
  note "At Name.com (opening norless.com's DNS records), A records pointing to $ip:" \
    "  norless.com (host empty) and www; remove a URL forward on norless.com if there is one." \
    "Keep the MX and TXT records (mail forwarding, Mailgun), and leave app and app-ua on the old server until cutover."
  open "https://www.name.com/account/domain/details/norless.com#dns"
  wait_enter "Save them."
  for host in norless.com www.norless.com; do
    if [ "$(dig +short A "$host" @1.1.1.1 | tail -1)" = "$ip" ]; then
      note "✓ $host"
    else
      note "· $host doesn't point to $ip yet (it can take a few minutes)"
      ok=1
    fi
  done
  return $ok
}

step_vm_base() {
  vm 'bash -s' <<'REMOTE'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
# Docker's own packages for this system (debian or ubuntu), and ufw, which Debian lacks.
if ! command -v docker >/dev/null || ! command -v ufw >/dev/null; then
  . /etc/os-release
  apt-get update -q
  apt-get install -yq ca-certificates curl ufw
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/$ID $VERSION_CODENAME stable" >/etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
# Swap, for spikes: a deploy runs two versions of the app for a while.
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi
# Keys only: bots try passwords on port 22 all day. A low number, as sshd takes the first value.
echo 'PasswordAuthentication no' >/etc/ssh/sshd_config.d/10-keys-only.conf
sshd -t && systemctl reload ssh
sshd -T | grep -x 'passwordauthentication no' >/dev/null
ufw allow 22,80,443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null
id deploy >/dev/null 2>&1 || useradd -m -s /bin/bash -G docker deploy
install -d -o deploy -g deploy -m 755 /opt/norless
install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
touch /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
docker compose version
REMOTE
}

step_vm_files() {
  scp -i "$ROOT_KEY" deploy/compose.yaml deploy/Caddyfile deploy/deploy.sh deploy/pull-backup.sh \
    "root@$(get ip):/opt/norless/" &&
    vm 'cd /opt/norless && chmod 755 deploy.sh pull-backup.sh &&
      chown deploy:deploy compose.yaml Caddyfile deploy.sh pull-backup.sh'
}

step_env_base() {
  local tag
  [ -n "$(get repo)" ] || { note "The repository step comes first."; return 1; }
  set_env IMAGE "ghcr.io/$(image_path)"
  # Until the first deploy sets them.
  for tag in PRODUCTION_TAG CONVERTER_PRODUCTION_TAG; do
    has_env "$tag" || set_env "$tag" main
  done
  has_env IMAGE
}

step_env_people() {
  local email
  email=$(git config user.email)
  set_env MAIL_REPLY_TO "$(ask reply_to "Where answers to login emails go" "$email")"
  set_env OPERATOR "$(ask operator "Who runs this server, for the privacy notice (name, email)" "$(git config user.name), $email")"
  set_env APP_TEAM_EMAILS "$(ask app_team "The app team's emails, for ideas and alerts (comma-separated)" "$email")"
  has_env APP_TEAM_EMAILS
}

step_env_mailgun() {
  local key to
  note "Mailgun, EU region (opening it): Sending → Domain settings → mg.norless.com →" \
    "  Sending API keys → Add sending key, named norless-vm; copy it."
  open "https://app.eu.mailgun.com/"
  key=$(secret "The sending key")
  [ -n "$key" ] || return 1
  set_env MAILGUN_API_KEY "$key"
  to=$(get reply_to)
  if [ -n "$to" ] && yes_no "Send a test email to $to?"; then
    printf 'user = "api:%s"\n' "$key" | curl -fsS -K - -o /dev/null \
      https://api.eu.mailgun.net/v3/mg.norless.com/messages \
      -F from="Norless <login@norless.com>" -F to="$to" \
      -F subject="Norless: the server's mail works" -F text="Sent by deploy/setup.sh." ||
      { note "Mailgun refused the key."; return 1; }
    note "Sent; check your inbox."
  fi
  has_env MAILGUN_API_KEY
}

step_env_google() {
  local secret_value
  note "Google Cloud console (opening Credentials), a project named norless:" \
    "  if asked, the OAuth consent screen first: External, app name Norless, your email, then Publish app;" \
    "  Create credentials → OAuth client ID → Web application, named Norless," \
    "  Authorized JavaScript origins: https://norless.com," \
    "  Authorized redirect URI: https://norless.com/api/auth/google/callback."
  open "https://console.cloud.google.com/apis/credentials"
  set_env GOOGLE_CLIENT_ID "$(ask google_client_id "The client ID")"
  secret_value=$(secret "The client secret")
  [ -n "$secret_value" ] || return 1
  set_env GOOGLE_CLIENT_SECRET "$secret_value"
  has_env GOOGLE_CLIENT_SECRET
}

step_env_vapid() {
  local keys
  if ! has_env VAPID_PRIVATE_KEY; then
    keys=$(node_modules/.bin/web-push generate-vapid-keys --json) || return 1
    set_env VAPID_PUBLIC_KEY "$(printf '%s' "$keys" | jq -r .publicKey)"
    set_env VAPID_PRIVATE_KEY "$(printf '%s' "$keys" | jq -r .privateKey)"
  fi
  set_env VAPID_SUBJECT "mailto:$(ask reply_to "An address push services can reach" "$(git config user.email)")"
  has_env VAPID_PRIVATE_KEY
}

step_env_youtube() {
  local key
  note "Google Cloud console, the same project (opening the API's page): Enable the YouTube Data API v3;" \
    "  then Credentials → Create credentials → API key, restricted to the YouTube Data API v3."
  open "https://console.cloud.google.com/apis/library/youtube.googleapis.com"
  key=$(secret "The API key")
  [ -n "$key" ] || return 1
  set_env YOUTUBE_API_KEY "$key"
  has_env YOUTUBE_API_KEY
}

step_deploy_key() {
  local repo dir ok=0
  repo=$(get repo)
  dir=$(mktemp -d)
  ssh-keygen -q -t ed25519 -N "" -C github-actions -f "$dir/key"
  add_key github-actions "$(forced /opt/norless/deploy.sh "$dir/key.pub")" &&
    gh secret set DEPLOY_KEY -R "$repo" <"$dir/key" &&
    gh secret set DEPLOY_HOST -R "$repo" -b "$(get ip)" &&
    ssh-keyscan -t ed25519 "$(get ip)" 2>/dev/null | gh secret set DEPLOY_KNOWN_HOSTS -R "$repo" || ok=1
  # It may only run deploy.sh: asked for nothing, deploy.sh answers with its usage.
  # It exits 2 then, which pipefail would pass on as the pipeline's failure.
  if [ $ok = 0 ] && ! { ssh -n -i "$dir/key" -o StrictHostKeyChecking=accept-new "deploy@$(get ip)" "" 2>&1 || true; } |
    grep -q "usage: production"; then
    note "The deploy key doesn't run deploy.sh."
    ok=1
  fi
  rm -rf "$dir"
  return $ok
}

step_environments() {
  local repo id env
  repo=$(get repo)
  id=$(gh api user -q .id) || return 1
  gh api -X PUT "repos/$repo/environments/production" >/dev/null || return 1
  # Each switch waits for the maintainer's confirmation.
  printf '{"reviewers":[{"type":"User","id":%s}]}' "$id" |
    gh api -X PUT "repos/$repo/environments/production-switch" --input - >/dev/null || return 1
  [ "$(gh api "repos/$repo/environments" -q '[.environments[].name] | sort | join(",")')" = \
    "production,production-switch" ]
}

step_caddy() {
  vm 'cd /opt/norless && docker compose up -d caddy &&
    docker compose ps --status running --services | grep -qx caddy'
}

step_images() {
  local owner name path
  path=$(image_path)
  owner=${path%%/*}
  name=${path#*/}
  # Built for the VM's architecture (deploy.yml's IMAGE_RUNNER), before the first run.
  if [ "$(vm uname -m)" = aarch64 ]; then
    gh variable set IMAGE_RUNNER -R "$(get repo)" -b ubuntu-24.04-arm || return 1
  else
    gh variable delete IMAGE_RUNNER -R "$(get repo)" >/dev/null 2>&1 || true
  fi
  if [ -z "$(latest_run url 2>/dev/null)" ]; then
    note "Runs Deploy: CI, the app's and the converter's images on ghcr.io, then production." \
      "Production stays empty until the import before the shadow Sunday; it runs now for the" \
      "backups and the uptime check."
    yes_no "Start it?" || return 1
    gh workflow run deploy.yml -R "$(get repo)" --ref main || return 1
    sleep 5
  fi
  open "$(latest_run url)"
  wait_enter "Wait until its image job is green (about 10 minutes)."
  if ! public_image "$path" || ! public_image "$path-converter"; then
    note "New images on ghcr.io are private; the VM pulls them without logging in." \
      "In each package's settings (opening both): Danger Zone → Change visibility → Public."
    open "https://github.com/users/$owner/packages/container/package/$name/settings"
    open "https://github.com/users/$owner/packages/container/package/$name-converter/settings"
    wait_enter "Make both public."
  fi
  public_image "$path" && public_image "$path-converter"
}

step_production() {
  if [ "$(latest_run conclusion)" = failure ] && yes_no "The last Deploy run failed (likely pulling private images). Run its failed jobs again?"; then
    gh run rerun "$(latest_run databaseId)" -R "$(get repo)" --failed
  fi
  open "$(latest_run url)"
  note "When the run waits: Review deployments → production-switch → Approve and deploy."
  wait_enter "When the run is green,"
  curl -fsS https://norless.com/api/health >/dev/null
}

step_backups() {
  local copy base
  [ -f "$HOME/.ssh/norless-backup" ] || ssh-keygen -q -t ed25519 -N "" -C mac-backup -f "$HOME/.ssh/norless-backup"
  add_key mac-backup "$(forced /opt/norless/pull-backup.sh "$HOME/.ssh/norless-backup.pub")" || return 1
  vm 'cd /opt/norless && docker compose exec -T norless node dist/server/cli/backup.js' >/dev/null || return 1
  copy=$(mktemp)
  ssh -T -o IdentitiesOnly=yes -i "$HOME/.ssh/norless-backup" -o StrictHostKeyChecking=accept-new deploy@norless.com >"$copy" || return 1
  if [ "$(head -c 15 "$copy")" != "SQLite format 3" ]; then
    note "The pull didn't bring a database."
    rm -f "$copy"
    return 1
  fi
  rm -f "$copy"
  note "✓ A backup pulled over SSH."
  if ! crontab -l 2>/dev/null | grep -q 'deploy@norless.com'; then
    note "Adds deploy/README.md's three lines to your crontab: the database tried every hour and pulled once a day, then recordings and slides."
    base=$(ask backup_base "The Mac's folder for the copies (a synced one keeps them off-site)" "$HOME")
    if yes_no "Add them, into $base?"; then
      {
        crontab -l 2>/dev/null || true
        sed "s|BASE|$base|g" <<'CRON'
0 * * * * (date "+\%F \%T database"; f="BASE/norless-backup/$(date +\%F)-norless.db"; [ -s "$f" ] || { mkdir -p "BASE/norless-backup" && ssh -T -o IdentitiesOnly=yes -i ~/.ssh/norless-backup deploy@norless.com > /tmp/norless.db && mv /tmp/norless.db "$f" && echo "pulled $f"; }) >> "BASE/norless-backup.log" 2>&1
30 * * * * (date "+\%F \%T recordings"; mkdir -p "BASE/norless-recordings" && cd "BASE/norless-recordings" && find . -type f | ssh -T -o IdentitiesOnly=yes -i ~/.ssh/norless-backup deploy@norless.com recordings | tar -xv) >> "BASE/norless-backup.log" 2>&1
40 * * * * (date "+\%F \%T slides"; mkdir -p "BASE/norless-slides" && cd "BASE/norless-slides" && find . -type f | ssh -T -o IdentitiesOnly=yes -i ~/.ssh/norless-backup deploy@norless.com slides | tar -xv) >> "BASE/norless-backup.log" 2>&1
CRON
      } | crontab -
    fi
  fi
  crontab -l 2>/dev/null | grep -q 'deploy@norless.com'
}

step_uptime() {
  note "UptimeRobot, free (opening it): Add New Monitor → HTTP(s), URL https://norless.com/api/health," \
    "  the shortest interval the plan has, alerts to the app team's email."
  open "https://dashboard.uptimerobot.com/"
  yes_no "Is the monitor set up and green?"
}

step_pages() {
  local repo
  repo=$(get repo)
  gh api -X POST "repos/$repo/pages" -f build_type=workflow >/dev/null 2>&1 ||
    gh api -X PUT "repos/$repo/pages" -f build_type=workflow >/dev/null 2>&1 || true
  [ "$(gh api "repos/$repo/pages" -q .build_type 2>/dev/null)" = workflow ]
}

step_spf() {
  if dig +short TXT norless.com @1.1.1.1 | grep -q '_spf.google.com'; then
    note "norless.com's SPF record still includes Google (Workspace was dropped):" \
      "  remove include:_spf.google.com from it at Name.com (opening the DNS records)."
    open "https://www.name.com/account/domain/details/norless.com#dns"
    wait_enter "Remove it."
    return 1
  fi
}

# The steps, in order: name, then what it sets up.
STEPS='tools|gh, the GitHub CLI, logged in
repo|The public repository on GitHub, with main pushed
server|The VM in Hetzner (CX23 or CAX11), reachable as root
dns|norless.com and www pointing to the VM
vm_base|Docker, swap, the firewall and the deploy user on the VM
vm_files|compose.yaml, the Caddyfile and the scripts on the VM
env_base|The images and their tags in the VM'"'"'s .env
env_people|Reply-To, the operator and the app team
env_mailgun|The Mailgun sending key
env_google|The Google login client
env_vapid|Push keys (VAPID), generated
env_youtube|The YouTube Data API key
deploy_key|The deploy key: on the VM, in GitHub, checked
environments|The environments, the switch waiting for a maintainer
caddy|Caddy, with HTTPS
images|The first images, public on ghcr.io
production|norless.com runs
backups|The Mac pulls a backup a day
uptime|An uptime monitor on /api/health
pages|The manual on GitHub Pages
spf|norless.com'"'"'s SPF without Google'

SKIPPED=""
run() {
  local name=$1 title=$2 answer
  declare -F "step_$name" >/dev/null || { echo "No step_$name" >&2; exit 1; }
  if [ -n "$(get "done.$name")" ]; then
    printf '  ✓ %-13s %s\n' "$name" "$title"
    return 0
  fi
  if [ "${MODE:-}" = status ]; then
    printf '  · %-13s %s\n' "$name" "$title"
    return 0
  fi
  say "$title"
  while ! "step_$name"; do
    read -rp "  Not done yet. [r]etry, [s]kip for now, [q]uit: " answer </dev/tty
    case $answer in
      s | S)
        SKIPPED="$SKIPPED  · $title\n"
        return 0
        ;;
      q | Q) exit 0 ;;
    esac
  done
  put "done.$name" "$(date +%F)"
  note "✓ Done."
}

# Sourced (a test), only the functions.
[ "${BASH_SOURCE[0]}" = "$0" ] || return 0

case "${1:-}" in
  status) MODE=status ;;
  redo)
    printf '%s\n' "$STEPS" | grep -q "^${2:-}|" || { echo "No step ${2:-}" >&2; exit 2; }
    put "done.$2" ""
    echo "deploy/setup.sh does $2 again."
    exit 0
    ;;
  "") ;;
  *)
    echo "usage: deploy/setup.sh [status | redo <step>]" >&2
    exit 2
    ;;
esac
# A loop over a list, not over standard input, which ssh would read.
set -f
IFS=$'\n'
lines=($STEPS)
IFS=$' \t\n'
set +f
for line in "${lines[@]}"; do
  run "${line%%|*}" "${line#*|}"
done
if [ "${MODE:-}" != status ]; then
  if [ -n "$SKIPPED" ]; then
    say "Skipped, asked again next time:"
    printf '%b' "$SKIPPED"
  else
    say "All set up."
  fi
fi
