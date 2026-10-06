import { beforeEach, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import type { Mail } from "../mail.js";

let db: Db;
let mails: Mail[];
let app: ReturnType<typeof buildApp>;

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', 'x', 'x');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('ana', 'Ana', 'ana@example.com', 'active', 'x', 'x'),
      ('old', 'Old', 'old@example.com', 'imported', 'x', 'x');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m-ana', 'c', 'ana', '["team"]', 'active', 'x', 'x'),
      ('m-old', 'c', 'old', '[]', 'imported', 'x', 'x');
  `);
  mails = [];
  app = buildApp({
    db,
    logger: false,
    origin: "https://norless.com",
    mailer: async (mail) => {
      mails.push(mail);
      return true;
    },
  });
});

const ask = (email: string, extra: object = {}) =>
  app.inject({
    method: "POST",
    url: "/api/auth/email-link",
    payload: { email, ...extra },
  });
const tokenOf = (mail: Mail | undefined) =>
  /\/login\/link\/([\w-]+)/.exec(mail?.text ?? "")?.[1] ?? "";
const use = (token: string) =>
  app.inject({
    method: "POST",
    url: "/api/auth/email-link/use",
    payload: { token },
  });

test("a link logs in once, to where the person was going", async () => {
  expect(
    (
      await ask("Ana@Example.com", {
        next: "/unu-unu/playlists",
        language: "ro",
      })
    ).statusCode,
  ).toBe(204);
  const [mail] = mails;
  expect(mail).toMatchObject({
    to: "ana@example.com",
    subject: "Linkul tău de autentificare în Norless",
  });
  expect(mail?.text).toContain("https://norless.com/login/link/");

  const first = await use(tokenOf(mail));
  expect(first.statusCode).toBe(200);
  expect(first.json()).toEqual({ next: "/unu-unu/playlists" });
  expect(first.headers["set-cookie"]).toMatch(/__Host-session=/);
  expect((await use(tokenOf(mail))).statusCode).toBe(410);
});

test("unknown and uninvited addresses get the same answer; a link elsewhere goes home", async () => {
  expect(
    (await ask("nobody@example.com", { next: "//evil.example" })).statusCode,
  ).toBe(204);
  expect((await ask("old@example.com")).statusCode).toBe(204);
  expect(mails.map((m) => m.to)).toEqual([
    "nobody@example.com",
    "old@example.com",
  ]);
  expect((await use(tokenOf(mails[0]))).json()).toEqual({ next: "/" });
  // Imported but not invited yet: no session.
  expect((await use(tokenOf(mails[1]))).statusCode).toBe(403);
});

test("links expire after 15 minutes, and an address can ask three times in that while", async () => {
  await ask("ana@example.com");
  db.exec("UPDATE login_links SET expires_at = '2000-01-01T00:00:00.000Z'");
  expect((await use(tokenOf(mails[0]))).statusCode).toBe(410);
  await ask("ana@example.com");
  await ask("ana@example.com");
  expect((await ask("ana@example.com")).statusCode).toBe(429);
  expect((await use("made-up-token")).statusCode).toBe(410);
  // Only hashes are kept.
  const stored = db
    .prepare("SELECT token_hash FROM login_links")
    .pluck()
    .all() as string[];
  expect(stored).not.toContain(tokenOf(mails[0]));
});

test("without a way to send email, there's no login by email", async () => {
  const plain = buildApp({ db, logger: false });
  expect((await plain.inject({ url: "/api/auth/methods" })).json()).toEqual({
    dev: false,
    email: false,
    google: false,
    fakeGoogle: false,
    devMail: false,
  });
  expect(
    (
      await plain.inject({
        method: "POST",
        url: "/api/auth/email-link",
        payload: { email: "ana@example.com" },
      })
    ).statusCode,
  ).toBe(404);
});

test("any address with one @ and no spaces may ask, an s in it too", async () => {
  expect((await ask("pavel.s@example.com")).statusCode).toBe(204);
  expect((await ask("pavel s@example.com")).statusCode).toBe(400);
  expect((await ask("pavel@@example.com")).statusCode).toBe(400);
});
