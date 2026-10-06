import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import type { Db } from "../db/db.js";
import { localTime } from "../schedule/schedule.js";

const KEEP_DAYS = 14;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * A copy of the running database at `target`, made with SQLite's online backup API and
 * checked with `integrity_check` before it replaces the file there. False when the copy
 * fails its check; the file there stays as it was.
 */
export async function backUp(db: Db, target: string): Promise<boolean> {
  const temporary = `${target}.tmp`;
  rmSync(temporary, { force: true });
  await db.backup(temporary);
  // One file on its own, without the WAL's side files, to copy and pull anywhere.
  const copy = new Database(temporary);
  copy.pragma("journal_mode = DELETE");
  const ok = copy.pragma("integrity_check", { simple: true }) === "ok";
  copy.close();
  if (!ok) {
    rmSync(temporary, { force: true });
    return false;
  }
  renameSync(temporary, target);
  return true;
}

/**
 * The latest copy, renewed each run; the first run after 03:00 in `timeZone` also keeps
 * it by date, and dated copies older than 14 days go.
 */
export async function runBackups(
  db: Db,
  dir: string,
  { now = new Date(), timeZone = "Europe/Bucharest" } = {},
): Promise<boolean> {
  mkdirSync(dir, { recursive: true });
  const latest = join(dir, "latest.db");
  if (!(await backUp(db, latest))) return false;
  const { date, minutes } = localTime(now, timeZone);
  const dated = join(dir, `norless-${date}.db`);
  // A checked file nothing writes to, so a plain copy is safe.
  if (minutes >= 3 * 60 && !existsSync(dated)) copyFileSync(latest, dated);
  for (const file of readdirSync(dir)) {
    const day = /^norless-(\d{4}-\d{2}-\d{2})\.db$/.exec(file)?.[1];
    if (day && Date.parse(date) - Date.parse(day) > KEEP_DAYS * DAY)
      rmSync(join(dir, file));
  }
  return true;
}

/** Backs up now and every hour, while the server runs. */
export function scheduleBackups(
  db: Db,
  dir: string,
  log: { error: (message: string) => void },
) {
  const run = () =>
    runBackups(db, dir).then(
      (ok) => ok || log.error("Backup failed its integrity check"),
      (error: unknown) => log.error(`Backup failed: ${String(error)}`),
    );
  void run();
  const timer = setInterval(() => void run(), HOUR);
  timer.unref();
  return () => clearInterval(timer);
}
