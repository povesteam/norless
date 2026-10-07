#!/usr/bin/env bash
# Deploys the commit checked out here straight from the Mac, without GitHub's pipeline,
# to try a change on norless.com within minutes: npm run check (not the e2e tests), both
# images built here for the VM's architecture and pushed to ghcr.io (only the layers that
# changed), then deploy.sh on the VM, which starts the new version beside the running one
# and, healthy, switches to it. Push the commit soon after, so the source of what runs
# is public.
#   deploy/quick.sh
# Once: gh auth refresh -s write:packages, so ghcr.io takes the GitHub CLI's token.
#
# Settings come from the environment:
#   NORLESS_VM        the VM, as root (default root@norless.com)
#   NORLESS_ROOT_KEY  its key (default ~/.ssh/norless-root, which deploy/setup.sh made)
set -euo pipefail
cd "$(dirname "$0")/.."
vm=${NORLESS_VM:-root@norless.com}
key=${NORLESS_ROOT_KEY:-$HOME/.ssh/norless-root}
on_vm() { ssh -i "$key" -o BatchMode=yes "$vm" "cd /opt/norless && $1"; }
# Node 24 from Homebrew, where the default node is another.
node -v 2>/dev/null | grep -q '^v24\.' || PATH=/opt/homebrew/opt/node@24/bin:$PATH

# What runs must be a commit, so its tag names it.
if [ -n "$(git status --porcelain -- src migrations package.json package-lock.json Dockerfile)" ]; then
  echo "The app's code has changes that aren't committed: commit or stash them first." >&2
  exit 1
fi
npm run check

tag=$(git rev-parse --short=7 HEAD)
image=$(on_vm "sed -n 's/^IMAGE=//p' .env")
case "$(on_vm "uname -m")" in
  aarch64) platform=linux/arm64 ;;
  *) platform=linux/amd64 ;;
esac
gh auth token | docker login ghcr.io -u "$(gh api user -q .login)" --password-stdin
docker build --platform "$platform" \
  --build-arg SOURCE_URL="https://github.com/${image#ghcr.io/}" \
  --build-arg GIT_COMMIT="$(git rev-parse HEAD)" \
  -t "$image:$tag" .
docker build --platform "$platform" -t "$image-converter:$tag" src/converter
docker push "$image:$tag"
docker push "$image-converter:$tag"

# As the deploy user, who owns the VM's .env.
deploy() { on_vm "runuser -u deploy -- ./deploy.sh production $tag $1"; }
deploy start
deploy switch
echo "norless.com runs $tag."
