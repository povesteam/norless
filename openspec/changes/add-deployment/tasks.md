# Tasks

## 1. Backups

- [x] 1.1 Add checked backups in the server: hourly latest copy through a checked temporary file, nightly dated copies kept 14 days, and `npm run backup`; verify with unit tests
- [x] 1.2 Backups over SSH: the Mac's forced-command key (`pull-backup.sh`: writes `pulled-at`, streams `latest.db`, copies recordings and slides), in `deploy/README.md` and its setup. Verify with a unit test that `pulled-at` feeds the 48-hour alert, and the key's command on a local Compose (on the VM with 2.3)
- [x] 1.3 Make `/api/health` check the database; verify with an API test

## 2. Deploy

- [x] 2.1 Add `deploy/`: Compose with production, its converter and Caddy, the Caddyfile, `deploy.sh`, a 2 GB swap file, and the VM setup notes; verify with `docker compose config` and a test of `deploy.sh`'s argument checks
- [x] 2.2 Add the deploy workflow, started by hand: CI, build on the VM's architecture (`IMAGE_RUNNER`) and push to ghcr.io, deploy production
- [x] 2.4 The old version keeps serving: `deploy.sh` starts the new image beside the old one, checks it, asks to confirm, then switches and stops the old one; a failing new one is stopped. Verify with a test of `deploy.sh` and on a local Compose (a broken image never takes traffic: 400 of 400 requests answered during a broken deploy, 300 of 300 during a switch)
- [x] 2.5 `deploy/rehearse.sh`: a version tried on a pulled backup on the Mac (starts, migrates, loads, passes the integrity check); verified on a real-data import
- [x] 2.6 The setup script (`deploy/setup.sh`): a resumable wizard for every step only a maintainer can do, each checked and skippable, secrets typed by them only; verify with `deploy/setup.test.ts` (the steps and resuming) and its `.env` and `authorized_keys` writers over SSH on a container (values kept literally, replaced once, readable by `deploy` only); the rest on the real VM in 2.3
- [ ] 2.3 Set up the VM, DNS and secrets (a maintainer, with `deploy/setup.sh`), deploy production, and rehearse a service on it

## 3. Alerts and cutover

- [x] 3.1 Add the alerts to `APP_TEAM_EMAILS` (no good backup for 3 hours, no pull for 48 hours, disk over 80%, more than 20 errors in 10 minutes), logged until email works, and the external uptime check (2 minutes down, as in `deploy/README.md`); verify with unit tests of each check
- [ ] 3.4 Saturday-night update of production before the shadow Sunday: a fresh prod dump and oplog imported in place through the re-runnable import, keeping what exists only in the new app (members, logins, the paired TV, screens, instruments, preferences); rehearse it once before the shadow Sunday, with the stage monitor and pairing switched on for the stage TV
- [ ] 3.2 Shadow Sunday: the new app on production runs the service on the projector, the old app in another tab as the fallback (the switch rehearsed); note every difference as a task
- [ ] 3.3 Cutover: re-import from a fresh dump the night before, switch DNS; the old app stays writable as the fallback until two good Sundays, then read-only for 3 months, then redirect app.norless.com and stop the old server, keeping its last dump

## 4. The team

- [ ] 4.1 (Scripts done; filming postponed.) Training videos: Playwright scripts on a real-data import, English captions and click highlights, for the operator laptop, building a playlist, a phone as controller, and the projectors; the videos written outside the repo
- [ ] 4.2 The weekly release order in PLAN.md: one or two features a week after cutover, what the team asked for first
