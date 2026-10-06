# Norless

Song projection for communities that project several languages in sync.

Status: rewrite in progress. See [PLAN.md](PLAN.md). Specs live in [openspec/](openspec/).

## Development

Requires Node 24 LTS (see `.nvmrc`), which comes with npm 11.

```bash
./run-dev.sh             # both below, with the login without verification; Ctrl+C stops both
npm ci
npm run dev:server   # API on http://127.0.0.1:3000, restarts on changes
npm run dev:client   # app on http://127.0.0.1:5173, proxies /api to the server
```

`run-dev.sh` reads a git-ignored `.env` if there is one (see `.env.example`), e.g. `DATABASE_PATH=/path/to/norless.db`; the environment wins over it.

To see the loading and error states as on a real network: `SLOW=1` holds back every API answer and live update by 300 to 1500 ms, and `FLAKY=1` fails about 1 in 10 API calls and drops the live connection every minute or two. Both are ignored when `NODE_ENV=production`.

Checks, the same ones CI runs:

```bash
npm run lint && npm run format:check && npm run typecheck && npm run specs
npm test             # unit tests (Vitest)
npm run e2e          # browser tests (Playwright; first run: npx playwright install chromium)
docker build -t norless .
```

`.npmrc` only installs package versions published at least two days ago.

## Screenshots

```bash
npm run screenshots
```

It fills `screenshots/` (git-ignored, pictures only) with every interface step's main views on a phone, a tablet, a laptop and a projector, from demo data with public-domain hymns, for the manual. Files are named `<device>-<view>.png`, so they sort by device. The script and its seed are in `e2e/screenshots/`. About a minute.

## Database

The server keeps its SQLite database at `DATABASE_PATH`: `data/norless.db` by default, and `/data/norless.db` in the container, where `/data` is a volume. It applies new migrations on start.

## Usage events

The app counts how it's used in `usage_events`, for the Norless app team (`APP_TEAM_EMAILS`), who read it on `/app-usage`. Owners never see it, and members switch counting off on My account.

| Column | What it holds |
|---|---|
| `at` | When, in UTC (ISO 8601) |
| `community_id` | The community whose pages it happened on; NULL outside them |
| `user_id` | The member; NULL for visitors, members who switched counting off, and deleted accounts |
| `device_type` | `phone`, `tablet` or `laptop` |
| `step` | The community's interface step (1 Classic … 5 Extras) |
| `layout` | The layout of the view it came from, e.g. `classic`, `controller` |
| `feature` | A name from `src/shared/usage.ts`, e.g. `live.go`, `layout.shown`, `search.pick`, `error.shown` |
| `detail` | JSON: `via` (how, e.g. `double-click`, `clicker`), and per feature `view`, `q`, `rank`, `page` or `message` |

To analyse it with a local Claude Code, point it at a copy of the database (`data/norless.db`, or a backup pulled to `backups/latest.db`) and ask in words, or start from these:

```bash
# How songs went live, per week
sqlite3 backups/latest.db "SELECT date(at, '-6 days', 'weekday 1') AS week, json_extract(detail, '$.via') AS via, count(*) FROM usage_events WHERE feature = 'live.go' GROUP BY week, via"
# One Sunday morning in order
sqlite3 backups/latest.db "SELECT time(at), feature, json_extract(detail, '$.via'), layout, device_type FROM usage_events WHERE at BETWEEN '2026-10-11T07:00' AND '2026-10-11T10:00' ORDER BY at"
# Which search box result people pick (0 is the first)
sqlite3 backups/latest.db "SELECT json_extract(detail, '$.rank') AS rank, count(*) FROM usage_events WHERE feature = 'search.pick' GROUP BY rank"
# Layouts per device type
sqlite3 backups/latest.db "SELECT device_type, json_extract(detail, '$.view') AS view, layout, count(*) FROM usage_events WHERE feature = 'layout.shown' GROUP BY 1, 2, 3"
```

## Importing the old Norless data

```bash
./run-reimport.sh                # a fresh backup from production, into a new local database
./run-reimport.sh <backup.archive.gzip> [<oplog.archive.gzip>]   # or a backup you already have, and its oplog
```

It deletes the local database and imports from scratch, so it can run again after local changes; stop `run-dev.sh` first. It reads `DATABASE_PATH`, `PROD_SSH` and `OWNER_EMAIL` from the environment or `.env` (see `.env.example`), and the backup lands next to the database. To import into a database without deleting it:

```bash
DATABASE_PATH=<data folder>/norless.db npm run import -- <dumps folder>/<date>-norless-all.mongodump.archive.gzip
```

It reads a `mongodump --archive --gzip` backup of the old `norless` and `norless-ua` databases, and prints a report. Re-running it updates the imported rows and leaves alone anything changed in the new app since. `./run-reimport.sh --keep` does the same with a fresh backup and its oplog. Into production, `deploy/import.sh` does it (`deploy/README.md`). In the container, run `node dist/server/import/cli.js <archive>`. **Keep backups and the database outside the repo**: they contain members' emails.

## The first owner

```bash
npm run invite -- <email> owner
```

It invites a person to the community with the given roles (`owner`, `editor`, `team`), matching an imported account by email. Their first login accepts it. In the container, run `node dist/server/cli/invite.js <email> owner`.

For development, `DEV_LOGIN=1` adds a login without verification to the login page. The server refuses to start with it when `NODE_ENV=production`.

## License

[GNU AGPL v3.0 or later](LICENSE). Contributions need a DCO sign-off, see [CONTRIBUTING.md](CONTRIBUTING.md).
