import { readFileSync, statfsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import type { FastifyInstance } from "fastify";
import type { Mailer } from "../mail.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const CHECK_MS = 10 * MINUTE;
/** While a problem lasts, it's sent again once a day. */
const REPEAT_MS = 24 * HOUR;

export type AlertKind = "backup" | "pull" | "disk" | "errors";

/** What the alerts look at. Times in milliseconds; null when it never happened. */
export type Facts = {
  now: number;
  /** When the server started: nothing is late before it ran long enough. */
  startedAt: number;
  /** The last good backup: `latest.db` is only ever replaced by a checked copy. */
  backupAt: number | null;
  /** The last pull of a backup to the Mac, from `pulled-at`. */
  pulledAt: number | null;
  /** How full the data's disk is, from 0 to 1. */
  diskUsed: number;
  /** Server errors (5xx) in the last 10 minutes. */
  errors: number;
};

/** The problems now (deployment spec): a backup or a pull overdue, a full disk, errors. */
export function alertsDue(facts: Facts): AlertKind[] {
  const since = (at: number | null) =>
    facts.now - Math.max(at ?? 0, facts.startedAt);
  const due: AlertKind[] = [];
  if (since(facts.backupAt) > 3 * HOUR) due.push("backup");
  if (since(facts.pulledAt) > 48 * HOUR) due.push("pull");
  if (facts.diskUsed > 0.8) due.push("disk");
  if (facts.errors > 20) due.push("errors");
  return due;
}

/** The backups folder's and the disk's part of the facts. */
export function readFacts(backupDir: string) {
  const time = (read: () => number) => {
    try {
      const at = read();
      return Number.isNaN(at) ? null : at;
    } catch {
      return null;
    }
  };
  // The data's folder, which holds the backups' and always exists.
  const disk = statfsSync(dirname(backupDir));
  return {
    backupAt: time(() => statSync(join(backupDir, "latest.db")).mtimeMs),
    pulledAt: time(() =>
      Date.parse(readFileSync(join(backupDir, "pulled-at"), "utf8").trim()),
    ),
    diskUsed: disk.blocks ? 1 - disk.bavail / disk.blocks : 0,
  };
}

const describe = (kind: AlertKind, facts: Facts) => {
  const when = (at: number | null) =>
    at ? new Date(at).toISOString() : "never";
  switch (kind) {
    case "backup":
      return {
        subject: "no good backup for 3 hours",
        text: `The last checked backup is from ${when(facts.backupAt)}. The server's log says why.`,
      };
    case "pull":
      return {
        subject: "no backup pulled for 48 hours",
        text: `The Mac last pulled a backup at ${when(facts.pulledAt)}. Check its cron and its SSH key.`,
      };
    case "disk":
      return {
        subject: `the disk is ${Math.round(facts.diskUsed * 100)}% full`,
        text: "Old images (docker image prune) and dated backups take room.",
      };
    case "errors":
      return {
        subject: `${facts.errors} server errors in 10 minutes`,
        text: "The server's log has them.",
      };
  }
};

/** An alert, written to the log and emailed to the app team once a mailer is set up. */
export function alertAppTeam(
  app: FastifyInstance,
  {
    appTeam,
    mailer,
    origin,
  }: { appTeam: string[]; mailer: Mailer | null; origin: string },
  subject: string,
  text: string,
) {
  app.log.warn(`Alert: ${subject}`);
  for (const to of mailer ? appTeam : [])
    void mailer?.({
      to,
      subject: `Norless alert: ${subject}`,
      text: `${origin}\n\n${text}\n`,
    });
}

/**
 * Alerts for the app team (deployment spec), checked every 10 minutes: written to the
 * log, and emailed once a mailer is set up; again each day while the problem lasts.
 */
export function attachAlerts(
  app: FastifyInstance,
  {
    backupDir,
    appTeam,
    mailer,
    origin,
  }: {
    backupDir: string;
    appTeam: string[];
    mailer: Mailer | null;
    origin: string;
  },
) {
  const startedAt = Date.now();
  let errors: number[] = [];
  app.addHook("onResponse", async (_request, reply) => {
    if (reply.statusCode >= 500) errors.push(Date.now());
  });
  const sent = new Map<AlertKind, number>();
  const check = () => {
    const now = Date.now();
    errors = errors.filter((at) => now - at <= CHECK_MS);
    let facts: Facts;
    try {
      facts = {
        now,
        startedAt,
        errors: errors.length,
        ...readFacts(backupDir),
      };
    } catch (error) {
      app.log.error(`Alerts can't read the backups: ${String(error)}`);
      return;
    }
    const due = alertsDue(facts);
    for (const kind of sent.keys()) if (!due.includes(kind)) sent.delete(kind);
    for (const kind of due) {
      if (now - (sent.get(kind) ?? -Infinity) < REPEAT_MS) continue;
      sent.set(kind, now);
      const { subject, text } = describe(kind, facts);
      alertAppTeam(app, { appTeam, mailer, origin }, subject, text);
    }
  };
  const timer = setInterval(check, CHECK_MS);
  timer.unref();
  app.addHook("onClose", async () => clearInterval(timer));
}
