import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { expect, test } from "vitest";
import { buildApp } from "../app.js";
import { runBackups } from "./backups.js";
import { migrate, openDatabase } from "../db/db.js";

const setup = () => {
  const dir = mkdtempSync(join(tmpdir(), "norless-backups-"));
  const db = openDatabase(join(dir, "norless.db"));
  migrate(db);
  db.prepare(
    "INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES ('c', 'unu-unu', 'Unu-Unu', '[\"ro\"]', 'Europe/Bucharest', 'x', 'x')",
  ).run();
  return { db, backups: join(dir, "backups") };
};

test("a checked latest copy each run, a dated one after 03:00, and 14 days of them", async () => {
  const { db, backups } = setup();
  // 02:00 in Bucharest: the latest copy only.
  expect(
    await runBackups(db, backups, { now: new Date("2026-10-02T23:00:00Z") }),
  ).toBe(true);
  const copy = new Database(join(backups, "latest.db"), { readonly: true });
  expect(copy.prepare("SELECT slug FROM communities").pluck().get()).toBe(
    "unu-unu",
  );
  copy.close();
  expect(existsSync(join(backups, "norless-2026-10-03.db"))).toBe(false);

  writeFileSync(join(backups, "norless-2026-09-18.db"), "old");
  writeFileSync(join(backups, "norless-2026-09-20.db"), "recent");
  // 04:00: the day's copy, and the one older than 14 days goes.
  await runBackups(db, backups, { now: new Date("2026-10-03T01:00:00Z") });
  expect(existsSync(join(backups, "norless-2026-10-03.db"))).toBe(true);
  expect(existsSync(join(backups, "norless-2026-09-18.db"))).toBe(false);
  expect(existsSync(join(backups, "norless-2026-09-20.db"))).toBe(true);
});

test("two backups at once, as the app's hourly one and one by hand, both succeed", async () => {
  const { db, backups } = setup();
  const now = new Date("2026-10-02T23:00:00Z");
  expect(
    await Promise.all([
      runBackups(db, backups, { now }),
      runBackups(db, backups, { now }),
    ]),
  ).toEqual([true, true]);
  const copy = new Database(join(backups, "latest.db"), { readonly: true });
  expect(copy.pragma("integrity_check", { simple: true })).toBe("ok");
  copy.close();
  expect(readdirSync(backups)).toEqual(["latest.db"]);
});

test("the health check fails when the database doesn't answer", async () => {
  const { db } = setup();
  const app = buildApp({ db, logger: false });
  expect((await app.inject({ url: "/api/health" })).statusCode).toBe(200);
  db.close();
  expect((await app.inject({ url: "/api/health" })).statusCode).toBe(503);
});
