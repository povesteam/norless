import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

export type Db = Database.Database;

// Resolves to <repo>/migrations both from src/server/db (dev) and dist/server/db (built).
const migrationsDir = fileURLToPath(
  new URL("../../../migrations", import.meta.url),
);

export function openDatabase(
  path = process.env.DATABASE_PATH ?? "data/norless.db",
): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  return db;
}

/**
 * Applies each `NNN-name.sql` in `dir` once, in order, each in its own transaction.
 * Foreign keys are off while one runs, so it can rebuild any table (create the new one,
 * copy, drop the old, rename), and checked before it commits.
 */
export function migrate(db: Db, dir = migrationsDir): string[] {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL) STRICT",
  );
  const applied = new Set(
    db.prepare("SELECT name FROM schema_migrations").pluck().all() as string[],
  );
  const pending = readdirSync(dir)
    .filter((file) => /^\d{3}-.+\.sql$/.test(file) && !applied.has(file))
    .sort();
  const enforced = db.pragma("foreign_keys", { simple: true }) === 1;
  // SQLite ignores this inside a transaction, so it goes around each one.
  db.pragma("foreign_keys = OFF");
  try {
    for (const file of pending) {
      db.transaction(() => {
        db.exec(readFileSync(join(dir, file), "utf8"));
        const broken = db.pragma("foreign_key_check") as unknown[];
        if (broken.length)
          throw new Error(
            `${file} leaves ${broken.length} broken references: ${JSON.stringify(broken.slice(0, 3))}`,
          );
        db.prepare(
          "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)",
        ).run(file, new Date().toISOString());
      })();
    }
  } finally {
    if (enforced) db.pragma("foreign_keys = ON");
  }
  return pending;
}
