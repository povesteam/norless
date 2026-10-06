import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { alertsDue, type Facts, readFacts } from "./alerts.js";

const HOUR = 3_600_000;
const now = Date.parse("2026-10-11T12:00:00Z");
const fine: Facts = {
  now,
  startedAt: now - 100 * HOUR,
  backupAt: now - HOUR,
  pulledAt: now - 2 * HOUR,
  diskUsed: 0.4,
  errors: 0,
};

test("all is well: no alert", () => {
  expect(alertsDue(fine)).toEqual([]);
});

test("no good backup for 3 hours", () => {
  expect(alertsDue({ ...fine, backupAt: now - 2.9 * HOUR })).toEqual([]);
  expect(alertsDue({ ...fine, backupAt: now - 3.1 * HOUR })).toEqual([
    "backup",
  ]);
  // None yet: counted from the server's start.
  expect(alertsDue({ ...fine, backupAt: null, startedAt: now - HOUR })).toEqual(
    [],
  );
  expect(alertsDue({ ...fine, backupAt: null })).toEqual(["backup"]);
});

test("no pull for 48 hours", () => {
  expect(alertsDue({ ...fine, pulledAt: now - 47 * HOUR })).toEqual([]);
  expect(alertsDue({ ...fine, pulledAt: now - 49 * HOUR })).toEqual(["pull"]);
  expect(alertsDue({ ...fine, pulledAt: null })).toEqual(["pull"]);
});

test("the disk over 80%, and more than 20 errors in 10 minutes", () => {
  expect(alertsDue({ ...fine, diskUsed: 0.8 })).toEqual([]);
  expect(alertsDue({ ...fine, diskUsed: 0.81 })).toEqual(["disk"]);
  expect(alertsDue({ ...fine, errors: 20 })).toEqual([]);
  expect(alertsDue({ ...fine, errors: 21 })).toEqual(["errors"]);
});

test("the backup's time and the Mac's pull come from the backups folder", () => {
  const dir = join(mkdtempSync(join(tmpdir(), "norless-alerts-")), "backups");
  mkdirSync(dir);
  expect(readFacts(dir)).toMatchObject({ backupAt: null, pulledAt: null });

  const backup = join(dir, "latest.db");
  writeFileSync(backup, "");
  utimesSync(backup, new Date(now - HOUR), new Date(now - HOUR));
  // What the Mac's key writes on each pull (pull-backup.sh).
  writeFileSync(join(dir, "pulled-at"), "2026-10-09T08:00:00Z\n");
  const facts = readFacts(dir);
  expect(facts.backupAt).toBe(now - HOUR);
  expect(facts.pulledAt).toBe(Date.parse("2026-10-09T08:00:00Z"));
  expect(facts.diskUsed).toBeGreaterThan(0);
  expect(facts.diskUsed).toBeLessThan(1);
  // This computer's disk is whatever it is.
  expect(alertsDue({ ...fine, ...facts, diskUsed: 0.4 })).toEqual(["pull"]);

  writeFileSync(join(dir, "pulled-at"), "not a time");
  expect(readFacts(dir).pulledAt).toBeNull();
});
