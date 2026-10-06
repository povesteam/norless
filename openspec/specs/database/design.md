# Database design

Why the database works as the spec says: SQLite on one server, a plain schema, the rules in code, and backups that can't replace a good copy with a bad one.

## Decisions

- **SQLite through `better-sqlite3`**: there is one server and one Node process, each write takes milliseconds, and WAL allows many readers beside the one writer, so there is no contention at this scale. `foreign_keys` is on and `busy_timeout` is 5 seconds. Tables are `STRICT`, so a value of the wrong type is refused.
- **Plain SQL migrations, a hand-written runner**: `NNN-name.sql` files are applied in order, each once in its own transaction, and recorded in a table. The runner is a few lines on `better-sqlite3`, so there is nothing to keep up with.
- **Rules live in code**: SQLite can't change a CHECK in place, so each new allowed value (a screen type, an entry kind) meant rebuilding a table, and every rule was also written in TypeScript in the routes' schemas and `src/shared`. The schema keeps types, NOT NULL, primary keys, UNIQUE and foreign keys, and the server's code keeps the rest.
  - Every CHECK goes, not only the lists of allowed values: ranges, patterns, JSON checks and rules across columns change with features too.
  - A unit test fails when a migration adds one, so the rule doesn't depend on anyone's memory.
  - No triggers either. The search index is kept up to date by the code that writes song texts (`song-search` design), so plain sqlite3 can edit a song: the triggers called a SQL function only the server registers. The change log's triggers are temporary, created by the server on its own connection, so they aren't in the schema.
- **Migrations can rebuild any table**: SQLite's way to change a table is to create the new one, copy, drop the old and rename, which foreign keys in force would block. The runner turns them off around each migration (SQLite ignores the pragma inside a transaction), runs `foreign_key_check` before committing, undoes a migration that leaves a broken reference, naming it, and turns them back on even when one fails.
- **Moments in UTC**: stored and sent as ISO strings ending in `Z` (`toISOString()`), and formatted for the local zone only to be shown. A schedule's time of day and calendar dates are local on purpose: "10:00 every Sunday" stored as UTC would move an hour at each change of the clocks, and the Sunday a slot is for is a date, not a moment. Texts people read, such as push messages, say the time in the community's zone.
- **Short ids**: a record's id is 12 letters and digits from `newId()` (about 71 bits), so URLs stay short. Bytes of 248 and above are skipped so every character is equally likely. Imported records get stable ids by hashing their old ones.
- **Tenant and sync columns**: every community-owned table has `community_id`, and global tables such as `users` don't. Synced tables have `updated_at` and `deleted_at` (soft delete), so a client can ask what changed since it last looked. Records keep `created_by` and `updated_by`.
- **Search with FTS5**: one index over titles and lyrics, accent- and case-insensitive (`unicode61 remove_diacritics 2`), replacing a JavaScript search library. A SQL function the connection registers extracts the lyrics only, so chords, section names and notes aren't searchable.
- **Backups with SQLite's online backup API**: `db.backup()` makes a consistent copy while the app runs. A timer in the server process (not host cron, since the process holds the database) writes one every hour to a temporary file, turns it into one file without WAL side files, checks it with `PRAGMA integrity_check`, and only then renames it over the last good copy. The first run after 03:00 in the community's zone also keeps a dated copy for 14 days. Off-site copies are pulled by a maintainer's computer (see `operations`).
- **What can corrupt a SQLite file** is a network filesystem, copying it while in use, or turning off fsync. So the database sits on a local-disk volume, in WAL mode, with default syncing, and is only ever copied through the backup API. To restore, stop the app, put the copy in place and remove the old `-wal` and `-shm` files.
- **Plain SQL ports**: queries stay ordinary SQL, so a move to PostgreSQL stays possible if many communities or heavy writes outgrow one file.

## Rejected

- MongoDB: its oplog is a rolling replication window, not a history, so it wouldn't have given the change log; it needs a heavier server, and moving meant rewriting every query.
- PocketBase: pre-1.0, against the rule of stable dependencies only.
- An ORM or query builder (Drizzle, Kysely): both were pre-1.0 when chosen, and plain SQL is enough.
- CHECK constraints and triggers that enforce rules: a table rebuild for every new allowed value, and the same rule written twice.
- Triggers that keep the search index: a write nobody sees in the code, and a schema that plain sqlite3 can't write to without the server's SQL function.
- Replication (Litestream, LiteFS): both pre-1.0, and one server needs none. Offline sync happens in the app.
- A copy of the live file with `cp`: it can catch the file mid-write.
- Cron on the host for backups: the backup API runs inside the process that holds the database.
