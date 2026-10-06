// A checked backup by hand, e.g. before a deploy:
// node dist/server/cli/backup.js (or npm run backup)
import { dirname, join } from "node:path";
import { runBackups } from "../ops/backups.js";
import { openDatabase } from "../db/db.js";

const path = process.env.DATABASE_PATH ?? "data/norless.db";
const db = openDatabase(path);
const ok = await runBackups(db, join(dirname(path), "backups"));
db.close();
if (!ok) {
  console.error("The backup failed its integrity check.");
  process.exit(1);
}
