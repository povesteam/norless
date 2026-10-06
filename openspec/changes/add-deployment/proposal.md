# Proposal

## Why

v1 is built, and the old app still runs on a 2016 Meteor bundle on a server not rebooted since 2022. Cutover needs the new app running somewhere safe: a server of its own, deploys that can't break a Sunday service, and backups that are checked and leave the server every day. PLAN.md (CI/CD, Hosting, SQLite safety) already decided most of it; this change turns it into specs and tasks.

Milestone: **v1** (build order step 9).

## What Changes

- Backups made by the app itself with SQLite's online backup API, checked with `PRAGMA integrity_check`: a latest copy every hour and a dated copy every night, kept 14 days.
- Backups pulled over SSH by a maintainer's Mac, with a key that can only fetch them, recording when they were last pulled.
- A deploy setup in `deploy/`: Docker Compose with production and Caddy (HTTPS for `norless.com` and the old app's hosts), a deploy script that backs up, switches the image, checks health and rolls back, and a restricted SSH key that can only run it.
- A GitHub Actions workflow that a maintainer runs by hand to deploy production, after trying the version on a pulled backup on the Mac (`deploy/rehearse.sh`).
- Alerts by email when a backup fails or isn't pulled for 3 days, the disk is over 80% full, or a deploy rolls back (once the email provider is set up).

## Capabilities

### New Capabilities

- `operations`: backups, deploys, health and alerts.

### Modified Capabilities

None.

## Impact

- The server gets a backup timer, a stricter `/api/health` (it checks the database too), and alerts for the app team; the Mac pulls backups over SSH.
- New files: `deploy/` and `.github/workflows/deploy.yml`.
- Needs from the maintainer: the VM, DNS for `norless.com`, the GitHub remote and its secrets, the email provider (alerts), and the uptime check.

## Non-goals

- Replication or a second server (PLAN: none needed with one server).
- Self-hosted CI runners (PLAN: a fork PR could run code on the server).
