import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";

let db: Db;
let app: ReturnType<typeof buildApp>;
let sessions: Record<string, string>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-04T08:00:00Z"));
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', 'x', 'x');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('pavel', 'Pavel', 'r@example.com', 'active', 'x', 'x'),
      ('ioana', 'Ioana', 'i@example.com', 'active', 'x', 'x'),
      ('ana', 'Ana', 'a@example.com', 'active', 'x', 'x');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m1', 'c', 'pavel', '["team"]', 'active', 'x', 'x'),
      ('m2', 'c', 'ioana', '["team"]', 'active', 'x', 'x'),
      ('m3', 'c', 'ana', '["owner"]', 'active', 'x', 'x');
    INSERT INTO songs (id, community_id, tags, created_at, updated_at) VALUES ('s', 'c', '[]', 'x', 'x');
    INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
      ('v', 'c', 's', 'ro', 'Har', '1:\nA\n\n2:\nB', 'x', 'x');
    INSERT INTO playlists (id, community_id, title, created_at, updated_at) VALUES ('p', 'c', 'Duminică', '2026-10-04T08:00:00.000Z', '2026-10-04T08:00:00.000Z');
    INSERT INTO entries (id, community_id, playlist_id, position, kind, song_id, created_at, updated_at) VALUES
      ('e', 'c', 'p', 1, 'song', 's', 'x', 'x');
  `);
  sessions = {
    pavel: createSession(db, "pavel"),
    ioana: createSession(db, "ioana"),
    ana: createSession(db, "ana"),
  };
  app = buildApp({ db, logger: false });
});
afterEach(() => vi.useRealTimers());

const call = (
  as: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  payload?: object,
) =>
  app.inject({
    method,
    url: `/api/communities/unu-unu${path}`,
    headers: {
      cookie: `__Host-session=${sessions[as]}`,
      "user-agent": "Mozilla/5.0 (iPhone)",
    },
    payload,
  });

test("a practice room has its own live state; the main room doesn't move", async () => {
  const room = (
    await call("pavel", "POST", "/rooms", { playlistId: "p" })
  ).json<{
    id: string;
    name: string;
    mode: string;
  }>();
  expect(room).toMatchObject({ name: "Pavel", mode: "rehearsal" });
  expect((await call("ioana", "GET", "/rooms")).json()).toHaveLength(1);

  await call("ioana", "POST", "/live", {
    type: "go",
    entryId: "e",
    room: room.id,
  });
  await call("ioana", "POST", "/live", { type: "next", room: room.id });
  expect(
    (await call("ioana", "GET", `/live?room=${room.id}`)).json(),
  ).toMatchObject({ entryId: "e", slide: 1, mode: "rehearsal" });
  expect((await call("ioana", "GET", "/live")).json()).toMatchObject({
    entryId: null,
  });

  // Played long enough: a rehearsal play in the practice room; no chapters for the service.
  vi.setSystemTime(new Date("2026-10-04T08:05:00Z"));
  await call("ioana", "POST", "/live", {
    type: "blank",
    blank: true,
    room: room.id,
  });
  await call("ioana", "POST", "/live", {
    type: "go",
    entryId: "e",
    slide: 0,
    room: room.id,
  });
  expect(db.prepare("SELECT count(*) FROM live_log").pluck().get()).toBe(0);
  expect(
    db.prepare("SELECT room_id, mode FROM slide_log ORDER BY at LIMIT 1").get(),
  ).toEqual({ room_id: room.id, mode: "rehearsal" });
});

test("a room without a playlist starts too", async () => {
  const response = await call("pavel", "POST", "/rooms", { playlistId: null });
  expect(response.statusCode).toBe(201);
  expect(response.json()).toMatchObject({ playlistId: null });
});

test("its starter or an owner switches it to service or ends it; others can't", async () => {
  const { id } = (await call("pavel", "POST", "/rooms", {})).json<{
    id: string;
  }>();
  expect(
    (await call("ioana", "PATCH", `/rooms/${id}`, { mode: "service" }))
      .statusCode,
  ).toBe(403);
  expect(
    (await call("pavel", "PATCH", `/rooms/${id}`, { mode: "service" })).json(),
  ).toMatchObject({ mode: "service" });
  expect((await call("ioana", "DELETE", `/rooms/${id}`)).statusCode).toBe(403);
  expect((await call("ana", "DELETE", `/rooms/${id}`)).statusCode).toBe(204);
  expect((await call("pavel", "GET", "/rooms")).json()).toEqual([]);
  expect(
    (await call("ioana", "POST", "/live", { type: "next", room: id }))
      .statusCode,
  ).toBe(404);
});

test("a room left 4 hours without a live change ends by itself", async () => {
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(new Date("2026-10-04T08:00:00Z"));
  app = buildApp({ db, logger: false });
  const { id } = (await call("pavel", "POST", "/rooms", {})).json<{
    id: string;
  }>();
  await call("pavel", "POST", "/live", { type: "go", entryId: "e", room: id });
  const open = () =>
    db
      .prepare(
        "SELECT count(*) FROM rooms WHERE temporary = 1 AND deleted_at IS NULL",
      )
      .pluck()
      .get();
  vi.advanceTimersByTime(3 * 60 * 60_000);
  expect(open()).toBe(1);
  vi.advanceTimersByTime(90 * 60_000);
  expect(open()).toBe(0);
});
