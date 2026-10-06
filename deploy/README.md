# Running Norless on a server

One VM (Hetzner CX23, x86, or CAX11, Arm: 2 vCPU, 4 GB, 40 GB, in Germany or Finland,
whichever is in stock; Debian, which idles at about 220 MB) runs production (`norless.com`), its converter, and Caddy, which
gets the HTTPS certificates; a 2 GB swap file takes the spikes. Hetzner's own backups are
off: the app's hourly backups and the copy pulled to a maintainer's Mac cover the data.
Staging isn't on the VM: a new version is tried on real data on the Mac first
(`rehearse.sh`, below).

## Deploying

First, on the Mac, on the commit to deploy, try it on the newest backup pulled from the
VM:

```
deploy/rehearse.sh <backup.db>
```

It builds the app's image, runs it on a copy of that backup, and checks that it starts
(its migrations ran on real data), that its home page loads and that the migrated
database passes SQLite's integrity check; the copy is deleted afterwards.

Then a maintainer deploys by hand: Actions → Deploy → Run workflow, choosing the branch
or tag (`.github/workflows/deploy.yml`). The workflow runs CI, builds the images for the
VM's architecture (the repository variable `IMAGE_RUNNER` is `ubuntu-24.04-arm` for an
Arm VM) and pushes them to ghcr.io, then over SSH, with a key that can only run
`deploy.sh`:

1. backs up the database, updates the converter (a converter that isn't
   healthy within a minute goes back to its old version, and the deploy fails), and
   starts the new version beside the running one, which keeps
   serving; a new version that isn't healthy within a minute is stopped, and the deploy
   fails;
2. waits for a maintainer to confirm (Review deployments, on the run's page);
3. confirmed, restarts the service on the new version while the new one answers in its
   place, so nobody sees it restart. Not confirmed, the new version is stopped.

While both run, the old version works on the database the new one may have migrated:
migrations only add (tables, columns), and a later release drops what's no longer used.

## Set up the VM

`deploy/setup.sh`, run on the Mac, walks through all of this and the GitHub, DNS, backup
and monitoring steps below, in order: each step is checked, can be
skipped, and is remembered once done (`deploy/setup.sh status`, `redo <step>`). Secrets
are typed into it hidden and go straight to the VM or GitHub. What it does, by hand:

1. Debian's current release (Ubuntu LTS works too) with Docker (the official `docker-ce`
   packages and the Compose plugin), a 2 GB swap file (`/swapfile`), and a firewall that lets in only SSH, HTTP
   and HTTPS: `ufw allow 22,80,443/tcp && ufw allow 443/udp && ufw enable`.
2. DNS: `norless.com` and `www.norless.com` point to the VM. At cutover,
   `app.norless.com` and `app-ua.norless.com` too.
3. A `deploy` user in the `docker` group, with `/opt/norless` holding `compose.yaml`,
   `Caddyfile` and `deploy.sh` from this folder, and a `.env` that only it can read:

   ```
   IMAGE=ghcr.io/<owner>/norless
   PRODUCTION_TAG=v1.0.0
   CONVERTER_PRODUCTION_TAG=v1.0.0
   MAILGUN_API_KEY=<a sending key for mg.norless.com, from Mailgun's EU region>
   MAIL_REPLY_TO=<where answers to login emails go>
   OPERATOR=<who runs this server, for the privacy notice: name, email>
   APP_TEAM_EMAILS=<the Norless app team, who get the ideas and the alerts: emails, comma-separated>
   GOOGLE_CLIENT_ID=<a Google OAuth web client, for login with Google>
   GOOGLE_CLIENT_SECRET=<its secret>
   YOUTUBE_API_KEY=<a YouTube Data API key, for the chapters' offset from the community's live stream>
   VAPID_PUBLIC_KEY=<from `npx web-push generate-vapid-keys`, for push to phones (team schedule)>
   VAPID_PRIVATE_KEY=<its private key; without both, the team schedule tells people in the app only>
   VAPID_SUBJECT=mailto:<an address push services can reach>
   ```

   Login links and invitations go out from `login@norless.com` through Mailgun's EU
   region (`mg.norless.com`). The Google client's authorized redirect URI is
   `https://norless.com/api/auth/google/callback`, and its authorized JavaScript origin
   `https://norless.com`, for Sign in with Google on the login page.

4. The deploy key and the Mac's backup key in `~deploy/.ssh/authorized_keys`, each
   limited to its script (`pull-backup.sh` is in this folder too):

   ```
   command="/opt/norless/deploy.sh",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty ssh-ed25519 AAAA… github-actions
   command="/opt/norless/pull-backup.sh",no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-pty ssh-ed25519 AAAA… mac-backup
   ```

5. `cd /opt/norless && docker compose up -d`.

## The converter

Recordings, pictures (avatars, link previews) and, with slides from files, PDFs are read
by the converter (`src/converter`, image
`<IMAGE>-converter`), not by the app: each job's file goes to it over an internal
network and the results come back; it keeps nothing, can't reach the database, the
stored files or the internet, and stays within a CPU and 1.5 GB (`compose.yaml`). Its
health isn't part of the app's: while it's away, recordings wait to be cut and new
pictures are skipped, and the app team gets an alert after 5 minutes, and another
when it's back.

## GitHub

- Repository secrets `DEPLOY_HOST` (the VM), `DEPLOY_KEY` (the private deploy key) and
  `DEPLOY_KNOWN_HOSTS` (`ssh-keyscan <host>`).
- Environments `production`, and `production-switch` with the maintainers as required
  reviewers: they confirm each switch.
- For an Arm VM, the repository variable `IMAGE_RUNNER=ubuntu-24.04-arm`.
- The images on ghcr.io (the app's and the converter's) are public, so the VM pulls them
  without logging in.

## Backups

The app backs up its database every hour into the volume (`/data/backups/latest.db`),
and keeps one copy a day for 14 days. A maintainer's Mac pulls the latest one every hour over
SSH, with a key that can only run `pull-backup.sh`; each pull is noted in
`/data/backups/pulled-at`. In the Mac's crontab, with `$HOME` standing for the folder
`setup.sh` asks for (a synced one, such as Dropbox or iCloud Drive, keeps the copies
off-site too):

```
0 * * * * mkdir -p "$HOME/norless-backup" && ssh -i ~/.ssh/norless-backup deploy@norless.com > /tmp/norless.db && mv /tmp/norless.db "$HOME/norless-backup/$(date +\%F)-norless.db"
```

The same key copies the recordings the Mac doesn't have yet (`/data/recordings`, a
file per song once a recording is finished, about 25 MB an hour), beside the backups:

```
30 * * * * mkdir -p "$HOME/norless-recordings" && cd "$HOME/norless-recordings" && find . -type f | ssh -i ~/.ssh/norless-backup deploy@norless.com recordings | tar -x
```

Slides from files (`/data/slides`: each uploaded file and its pages) the same way:

```
40 * * * * mkdir -p "$HOME/norless-slides" && cd "$HOME/norless-slides" && find . -type f | ssh -i ~/.ssh/norless-backup deploy@norless.com slides | tar -x
```

To restore, stop the app, put the copy in the volume as `/data/norless.db` (removing
`norless.db-wal` and `norless.db-shm`), and start it again.

## Alerts

With `APP_TEAM_EMAILS` set, the app checks every 10 minutes and emails the app team
(and writes to its log, also before email works): no good backup for 3 hours, no pull
for 48 hours, the disk over 80% full, more than 20 server errors in 10 minutes. Each is
sent again once a day while it lasts.

Whether the server answers at all is checked from outside: an uptime monitor (e.g.
UptimeRobot's or Better Stack's free plans) on `https://norless.com/api/health`, which
fails when the database doesn't answer, alerting the app team after 2 minutes down.
