import { dirname, join } from "node:path";
import { buildApp } from "./app.js";
import { scheduleBackups } from "./ops/backups.js";
import { youtubeApi } from "./songs/chapters.js";
import { devLoginEnabled } from "./auth/auth.js";
import { devMailer, mailgun } from "./mail.js";
import { migrate, openDatabase } from "./db/db.js";
import { simulationFromEnv } from "./live/simulate.js";

const path = process.env.DATABASE_PATH ?? "data/norless.db";
const db = openDatabase(path);
migrate(db);
const backupDir = join(dirname(path), "backups");
const recordingsDir = join(dirname(path), "recordings");
const slidesDir = join(dirname(path), "slides");
// Mailgun when it's configured; in development, emails are kept for the dev login page.
const dev = devLoginEnabled();
const devMail = dev ? devMailer() : null;
const app = buildApp({
  db,
  devLogin: dev,
  mailer: mailgun() ?? devMail?.send ?? null,
  devMail: devMail?.last,
  // In development, login links point to this server.
  origin:
    process.env.APP_ORIGIN ??
    (dev ? `http://127.0.0.1:${process.env.PORT ?? 3000}` : undefined),
  backupDir,
  recordingsDir,
  slidesDir,
  converterWatch: true,
  // For the privacy notice, e.g. "Pavel Popa, pavel@example.com" and
  // "Hetzner Online GmbH, Germany (servers); Mailgun, EU (email)".
  operator: process.env.OPERATOR ?? null,
  google:
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        }
      : undefined,
  simulation: simulationFromEnv(),
  // Finds a service's live stream for its YouTube chapters.
  youtube: process.env.YOUTUBE_API_KEY
    ? youtubeApi(process.env.YOUTUBE_API_KEY)
    : undefined,
  // Behind Caddy: visitors' addresses come from X-Forwarded-For.
  trustProxy: process.env.TRUST_PROXY === "1",
  // Push for the team schedule: `npx web-push generate-vapid-keys`.
  vapid:
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
      ? {
          publicKey: process.env.VAPID_PUBLIC_KEY,
          privateKey: process.env.VAPID_PRIVATE_KEY,
          subject: process.env.VAPID_SUBJECT ?? "mailto:hello@norless.com",
        }
      : undefined,
  // The Norless app team, e.g. "pavel@example.com,nicolae@example.com".
  appTeam: (process.env.APP_TEAM_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  services: (process.env.PRIVACY_SERVICES ?? "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean),
  // The repository, at the commit this image was built from when it's known.
  source: process.env.SOURCE_URL
    ? process.env.GIT_COMMIT
      ? `${process.env.SOURCE_URL}/tree/${process.env.GIT_COMMIT}`
      : process.env.SOURCE_URL
    : null,
});

const stopBackups = scheduleBackups(db, backupDir, app.log);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopBackups();
    void app.close().then(() => db.close());
  });
}

await app.listen({
  port: Number(process.env.PORT ?? 3000),
  host: process.env.HOST ?? "127.0.0.1",
});
