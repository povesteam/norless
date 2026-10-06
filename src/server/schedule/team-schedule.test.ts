import { createECDH, randomBytes } from "node:crypto";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import webpush from "web-push";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import { deleteAccount } from "../auth/members.js";
import type { MySchedule } from "./my-schedule.js";
import type { Role } from "./team-data.js";
import type { TeamSchedule } from "./team-schedule.js";

let db: Db;
let app: ReturnType<typeof buildApp>;
const sessions: Record<string, string> = {};
// A Saturday morning in Bucharest; the service is Sunday 10:00-12:00.
const SATURDAY = new Date("2026-10-10T08:00:00Z");

beforeEach(() => {
  vi.useFakeTimers({ now: SATURDAY, toFake: ["Date", "setInterval"] });
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro","uk"]', 'Europe/Bucharest', 'x', 'x');
    INSERT INTO users (id, display_name, email, status, preferences, created_at, updated_at) VALUES
      ('ana', 'Ana', 'ana@example.com', 'active', '{}', 'x', 'x'),
      ('ion', 'Ion', 'ion@example.com', 'active', '{"musician":{"instruments":["guitar"]}}', 'x', 'x'),
      ('eva', 'Eva', 'eva@example.com', 'active', '{}', 'x', 'x'),
      ('dan', 'Dan', 'dan@example.com', 'active', '{}', 'x', 'x');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m1', 'c', 'ana', '["owner"]', 'active', 'x', 'x'),
      ('m2', 'c', 'ion', '["team"]', 'active', 'x', 'x'),
      ('m3', 'c', 'eva', '[]', 'active', 'x', 'x');
    INSERT INTO schedule_events (id, community_id, name, type, kind, weekday, start_time, end_time, created_at, updated_at) VALUES
      ('sunday', 'c', 'Serviciu', 'service', 'recurring', 7, '10:00', '12:00', 'x', 'x');
  `);
  for (const user of ["ana", "ion", "eva", "dan"])
    sessions[user] = createSession(db, user);
  app = buildApp({ db, logger: false });
});
afterEach(async () => {
  await app.close();
  vi.useRealTimers();
});

const call = (
  as: string | null,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  payload?: object,
) =>
  app.inject({
    method,
    url: `/api/communities/unu-unu${path}`,
    headers: as ? { cookie: `__Host-session=${sessions[as]}` } : {},
    ...(payload && { payload }),
  });
const schedule = async (as = "eva") =>
  (await call(as, "GET", "/team-schedule")).json<TeamSchedule>();
const mine = async (as: string) =>
  (await call(as, "GET", "/my-schedule")).json<MySchedule>();
const role = (s: TeamSchedule, name: string) =>
  s.roles.find((r) => r.name === name) as Role;
const slot = (path: string, as: string, body?: object) =>
  call(as, "POST", `/team-schedule/sunday/2026-10-11/slots/${path}`, body);

test("the starter roles, in the community's first language; owners edit them", async () => {
  const s = await schedule();
  expect(s.roles.map((r) => r.name)).toEqual([
    "Lider de laudă",
    "Voce",
    "Chitară",
    "Clape",
    "Bas",
    "Tobe",
    "Prezentator",
    "Predicator",
    "Sunet",
    "Slide-uri",
    "Învățător la copii",
  ]);
  // The worship lead leads the songs.
  expect(s.roles.filter((r) => r.leads).map((r) => r.name)).toEqual([
    "Lider de laudă",
  ]);
  // Ion plays guitar, so he's marked for it.
  expect(role(s, "Chitară").people).toEqual(["ion"]);
  const roles = [
    { id: role(s, "Voce").id, name: "Voci", instrument: "vocals" },
    { name: "Vioară", instrument: null },
  ];
  expect(
    (await call("ion", "PUT", "/service-roles", { roles })).statusCode,
  ).toBe(403);
  const saved = (await call("ana", "PUT", "/service-roles", { roles })).json<
    Role[]
  >();
  expect(saved.map((r) => r.name)).toEqual(["Voci", "Vioară"]);
  expect((await call(null, "GET", "/team-schedule")).statusCode).toBe(401);
  expect((await call("dan", "GET", "/team-schedule")).statusCode).toBe(403);
});

test("a date starts from its event's template; the team assigns, people answer", async () => {
  const s = await schedule();
  const guitar = role(s, "Chitară").id;
  const voice = role(s, "Voce").id;
  expect(
    (
      await call("eva", "PUT", "/slot-templates/sunday", {
        template: [{ roleId: guitar, count: 1 }],
      })
    ).statusCode,
  ).toBe(403);
  await call("ion", "PUT", "/slot-templates/sunday", {
    template: [
      { roleId: voice, count: 2 },
      { roleId: guitar, count: 1 },
    ],
  });
  const [sunday] = (await schedule()).dates;
  expect(sunday).toMatchObject({
    date: "2026-10-11",
    name: "Serviciu",
    builtBy: null,
  });
  expect(sunday?.slots.map((x) => [x.key, x.status])).toEqual([
    [`${voice}:0`, "open"],
    [`${voice}:1`, "open"],
    [`${guitar}:0`, "open"],
  ]);

  // Eva is away that day: the team is told, and she's asked anyway.
  await call("eva", "POST", "/away-dates", {
    first: "2026-10-11",
    last: "2026-10-12",
  });
  const assigned = await slot(`${voice}:0/assign`, "ion", { userId: "eva" });
  expect(assigned.json()).toEqual({ away: true });
  expect((await mine("eva")).slots).toMatchObject([
    { role: "Voce", status: "asked", date: "2026-10-11" },
  ]);
  expect((await mine("eva")).notifications[0]).toMatchObject({
    kind: "assigned",
  });
  // Her away days are hers to see too.
  expect((await mine("eva")).away).toMatchObject([
    { first: "2026-10-11", last: "2026-10-12" },
  ]);

  // Taken out again, and asked again.
  await slot(`${voice}:0/assign`, "ion", { userId: null });
  expect((await schedule()).dates[0]?.slots[0]).toMatchObject({
    userId: null,
    status: "open",
  });
  await slot(`${voice}:0/assign`, "ion", { userId: "eva" });

  // Eva declines with a reason: the slot opens, Ion who built the date hears why.
  expect(
    (await slot(`${voice}:0/answer`, "ana", { accept: false })).statusCode,
  ).toBe(403);
  await slot(`${voice}:0/answer`, "eva", { accept: false, reason: "plecată" });
  expect((await schedule()).dates[0]?.slots[0]).toMatchObject({
    status: "open",
    userId: null,
  });
  expect((await mine("ion")).notifications[0]).toMatchObject({
    kind: "declined",
    data: { who: "Eva", reason: "plecată" },
  });
});

test("open slots: someone marked for the role takes one; anyone else offers", async () => {
  const s = await schedule();
  const guitar = role(s, "Chitară").id;
  await call("ion", "PUT", "/slot-templates/sunday", {
    template: [{ roleId: guitar, count: 2 }],
  });
  // Ion plays guitar: his at once; the builder is told when someone else signs up.
  expect((await slot(`${guitar}:0/take`, "ion")).json()).toEqual({
    status: "accepted",
  });
  expect((await slot(`${guitar}:1/take`, "eva")).json()).toEqual({
    status: "offered",
  });
  expect((await mine("ion")).notifications[0]).toMatchObject({
    kind: "offered",
    data: { who: "Eva" },
  });
  await slot(`${guitar}:1/confirm`, "ion", { yes: true });
  expect(
    (await schedule()).dates[0]?.slots.map((x) => [x.userId, x.status]),
  ).toEqual([
    ["ion", "accepted"],
    ["eva", "accepted"],
  ]);
  expect((await mine("eva")).notifications[0]).toMatchObject({
    kind: "confirmed",
  });
  expect((await slot(`${guitar}:1/take`, "ana")).statusCode).toBe(409);
});

test("two roles the same day show as a note; a reminder comes 3 hours before", async () => {
  const s = await schedule();
  const voice = role(s, "Voce").id;
  const keys = role(s, "Clape").id;
  await call("ion", "PUT", "/slot-templates/sunday", {
    template: [
      { roleId: voice, count: 1 },
      { roleId: keys, count: 1 },
    ],
  });
  await slot(`${voice}:0/assign`, "ion", { userId: "ana" });
  await slot(`${keys}:0/assign`, "ion", { userId: "ana" });
  await slot(`${voice}:0/answer`, "ana", { accept: true });
  expect(
    (await mine("ana")).slots.map((x) => [x.role, x.status, x.also]),
  ).toEqual([
    ["Voce", "accepted", ["Clape"]],
    ["Clape", "asked", ["Voce"]],
  ]);

  // Sunday 07:30 in Bucharest, two and a half hours before: each slot, once.
  vi.setSystemTime(new Date("2026-10-11T04:30:00Z"));
  vi.advanceTimersByTime(60_000);
  vi.advanceTimersByTime(60_000);
  const reminders = (await mine("ana")).notifications.filter(
    (n) => n.kind === "reminder",
  );
  expect(reminders).toHaveLength(2);
});

test("open slots within a week reach the people marked for the role, once", async () => {
  const s = await schedule();
  const guitar = role(s, "Chitară").id;
  await call("ion", "PUT", "/slot-templates/sunday", {
    template: [{ roleId: guitar, count: 1 }],
  });
  vi.advanceTimersByTime(60_000);
  vi.advanceTimersByTime(60_000);
  expect(
    (await mine("ion")).notifications.filter((n) => n.kind === "open"),
  ).toHaveLength(1);
  expect((await mine("ion")).open).toMatchObject([
    { role: "Chitară", date: "2026-10-11" },
  ]);
  expect((await mine("eva")).notifications).toEqual([]);
});

test("a deleted account's slots open again and its away dates go", async () => {
  const s = await schedule();
  const voice = role(s, "Voce").id;
  await call("ion", "PUT", "/slot-templates/sunday", {
    template: [{ roleId: voice, count: 1 }],
  });
  await slot(`${voice}:0/assign`, "ion", { userId: "eva" });
  await call("eva", "POST", "/away-dates", {
    first: "2026-10-20",
    last: "2026-10-21",
  });
  deleteAccount(db, "eva");
  expect((await schedule("ana")).dates[0]?.slots[0]).toMatchObject({
    userId: null,
    status: "open",
  });
  expect(db.prepare("SELECT count(*) FROM away_dates").pluck().get()).toBe(0);
});

test("the team tells Sunday's people the playlist is ready; a song changed after reaches its musicians once", async () => {
  const s = await schedule();
  const voice = role(s, "Voce").id;
  const guitar = role(s, "Chitară").id;
  const sound = role(s, "Sunet").id;
  await call("ion", "PUT", "/slot-templates/sunday", {
    template: [
      { roleId: voice, count: 1 },
      { roleId: guitar, count: 1 },
      { roleId: sound, count: 1 },
    ],
  });
  await slot(`${voice}:0/assign`, "ion", { userId: "eva" });
  await slot(`${guitar}:0/assign`, "ion", { userId: "ana" });
  await slot(`${sound}:0/assign`, "ion", { userId: "ion" });
  db.exec(`
    INSERT INTO songs (id, community_id, tags, created_at, updated_at) VALUES
      ('song', 'c', '[]', 'x', '2026-10-01T00:00:00.000Z');
    INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
      ('v', 'c', 'song', 'ro', 'Har minunat', 'Har', 'x', 'x');
    INSERT INTO playlists (id, community_id, title, service_event_id, service_date, created_at, updated_at) VALUES
      ('p', 'c', NULL, 'sunday', '2026-10-11', 'x', 'x'),
      ('alone', 'c', 'Fără serviciu', NULL, NULL, 'x', 'x');
    INSERT INTO entries (id, community_id, playlist_id, position, kind, song_id, created_at, updated_at) VALUES
      ('e', 'c', 'p', 1, 'song', 'song', 'x', '2026-10-01T00:00:00.000Z');
  `);
  // Only the team; a playlist without a service has nobody to tell.
  expect((await call("eva", "POST", "/playlists/p/ready")).statusCode).toBe(
    403,
  );
  expect((await call("ion", "POST", "/playlists/alone/ready")).statusCode).toBe(
    400,
  );
  expect(
    (await call("ion", "POST", "/playlists/p/ready")).json(),
  ).toMatchObject({ told: 2 });
  const kinds = async (as: string) =>
    (await mine(as)).notifications.map((n) => [n.kind, n.data.title]);
  // Untitled: named by its date in the community's language.
  expect(await kinds("eva")).toContainEqual([
    "ready",
    expect.stringMatching(/^11 octombrie( 2026)?$/),
  ]);

  // Ion told them, so he isn't told. An hour later the song changes: who plays or sings
  // it hears, the sound man doesn't.
  expect((await kinds("ion")).map(([kind]) => kind)).not.toContain("ready");
  vi.setSystemTime(new Date("2026-10-10T09:00:00Z"));
  db.prepare("UPDATE songs SET updated_at = ? WHERE id = 'song'").run(
    new Date().toISOString(),
  );
  vi.advanceTimersByTime(60_000);
  vi.advanceTimersByTime(60_000);
  const changed = (await mine("ana")).notifications.filter(
    (n) => n.kind === "changed",
  );
  expect(changed.map((n) => n.data.song)).toEqual(["Har minunat"]);
  expect((await kinds("eva")).map(([kind]) => kind)).toContain("changed");
  expect((await kinds("ion")).map(([kind]) => kind)).not.toContain("changed");
  // Once per change.
  vi.advanceTimersByTime(60_000);
  expect(
    (await mine("ana")).notifications.filter((n) => n.kind === "changed"),
  ).toHaveLength(1);
});

test("each notification says how it went by push, for the app and for finding out why", async () => {
  const voice = role(await schedule(), "Voce").id;
  await call("ion", "PUT", "/slot-templates/sunday", {
    template: [{ roleId: voice, count: 3 }],
  });
  // Without the server's keys: only in the app.
  await slot(`${voice}:0/assign`, "ana", { userId: "eva" });
  expect((await mine("eva")).notifications[0]).toMatchObject({
    kind: "assigned",
    push: { none: "keys" },
  });

  // With keys: none of Dan's devices allowed notifications; Ion's one device can't be
  // reached.
  await app.close();
  app = buildApp({
    db,
    logger: false,
    vapid: { ...webpush.generateVAPIDKeys(), subject: "mailto:a@example.com" },
  });
  const device = createECDH("prime256v1");
  device.generateKeys();
  db.prepare(
    "INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at) VALUES ('p', 'ion', 'https://127.0.0.1:9/push', ?, ?, 'x')",
  ).run(
    device.getPublicKey().toString("base64url"),
    randomBytes(16).toString("base64url"),
  );
  db.exec(
    "INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES ('m4', 'c', 'dan', '[]', 'active', 'x', 'x')",
  );
  await slot(`${voice}:1/assign`, "ana", { userId: "dan" });
  expect((await mine("dan")).notifications[0]?.push).toEqual({
    none: "devices",
  });
  await slot(`${voice}:2/assign`, "ana", { userId: "ion" });
  let push = (await mine("ion")).notifications[0]?.push;
  for (let i = 0; push === null && i < 100; i++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    push = (await mine("ion")).notifications[0]?.push;
  }
  expect(push).toEqual({ sent: 0, failed: 1, gone: 0 });
});
