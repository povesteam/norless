import { beforeEach, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import { modeAt } from "./schedule-routes.js";

let db: Db;
let sessions: Record<string, string>;

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('owner', 'Ow', 'ow@example.com', 'active', '2026-01-01', '2026-01-01'),
      ('team', 'Te', 'te@example.com', 'active', '2026-01-01', '2026-01-01');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m1', 'c', 'owner', '["owner"]', 'active', '2026-01-01', '2026-01-01'),
      ('m2', 'c', 'team', '["team"]', 'active', '2026-01-01', '2026-01-01');
    INSERT INTO songs (id, community_id, tags, created_at, updated_at) VALUES
      ('song', 'c', '[]', '2026-01-01', '2026-01-01');
  `);
  sessions = {
    owner: createSession(db, "owner"),
    team: createSession(db, "team"),
  };
});

const call = (
  as: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path = "",
  payload?: object,
) =>
  buildApp({ db, logger: false }).inject({
    method,
    url: `/api/communities/unu-unu/schedule${path}`,
    headers: { cookie: `__Host-session=${sessions[as]}` },
    payload,
  });
const add = async (event: object) => {
  const response = await call("owner", "POST", "", event);
  expect(response.statusCode).toBe(201);
  return response.json<{ id: string }>().id;
};
const sunday = {
  kind: "recurring",
  name: "Serviciu duminică",
  type: "service",
  weekday: 7,
  startTime: "10:00",
  endTime: "12:30",
};

test("owners keep recurring events, one-off events and cancelled days", async () => {
  const id = await add({ ...sunday, firstDate: "2020-01-01" });
  await add({
    kind: "one_off",
    name: "Seară de Crăciun",
    type: "service",
    date: "2026-12-24",
    startTime: "18:00",
    endTime: "20:00",
  });
  await add({ kind: "cancellation", cancelsEventId: id, date: "2026-10-04" });

  const { events } = (await call("owner", "GET")).json<{
    events: Record<string, unknown>[];
  }>();
  expect(events).toMatchObject([
    {
      kind: "recurring",
      name: "Serviciu duminică",
      weekday: 7,
      startTime: "10:00",
      endTime: "12:30",
      firstDate: "2020-01-01",
      lastDate: null,
    },
    { kind: "one_off", name: "Seară de Crăciun", date: "2026-12-24" },
    // A cancelled day carries its event's name and type.
    { kind: "cancellation", name: "Serviciu duminică", cancelsEventId: id },
  ]);

  expect(
    (await call("owner", "PUT", `/${id}`, { ...sunday, endTime: "13:00" }))
      .statusCode,
  ).toBe(204);
  expect((await call("owner", "DELETE", `/${id}`)).statusCode).toBe(204);
  expect(
    (await call("owner", "GET")).json<{ events: { id: string }[] }>().events,
  ).not.toContainEqual(expect.objectContaining({ id }));
});

test("events that can't happen are refused", async () => {
  const id = await add(sunday);
  const refused = async (event: object) =>
    expect((await call("owner", "POST", "", event)).statusCode).toBe(400);
  await refused({ ...sunday, endTime: "09:00" });
  await refused({ ...sunday, startTime: "25:00" });
  await refused({ ...sunday, name: " " });
  await refused({ ...sunday, firstDate: "2026-02-30" });
  await refused({ ...sunday, firstDate: "2026-02-01", lastDate: "2026-01-01" });
  await refused({ ...sunday, weekday: 8 });
  // 2026-10-05 is a Monday.
  await refused({
    kind: "cancellation",
    cancelsEventId: id,
    date: "2026-10-05",
  });
  await refused({
    kind: "cancellation",
    cancelsEventId: "x",
    date: "2026-10-04",
  });
  expect(
    (
      await call("owner", "PUT", `/${id}`, {
        kind: "one_off",
        name: "x",
        type: "service",
        date: "2026-10-04",
        startTime: "10:00",
        endTime: "11:00",
      })
    ).statusCode,
  ).toBe(400);
});

test("only owners see and change the schedule", async () => {
  expect((await call("team", "GET")).statusCode).toBe(403);
  expect((await call("team", "POST", "", sunday)).statusCode).toBe(403);
  expect((await call("team", "POST", "/classify")).statusCode).toBe(403);
});

test("classifying gives imported plays the type of their event, again after a fix", async () => {
  const play = (id: string, at: string, imported = 1, mode = "unclassified") =>
    db
      .prepare(
        "INSERT INTO plays (id, community_id, song_id, mode, played_at, imported, created_at, updated_at) VALUES (?, 'c', 'song', ?, ?, ?, '2026-01-01', '2026-01-01')",
      )
      .run(id, mode, at, imported);
  // Bucharest is UTC+3 in summer: 9:15 and 10:15 local time on Sundays.
  play("early", "2016-06-05T06:15:00Z");
  play("during", "2016-06-05T07:15:00Z");
  play("thursday", "2016-06-09T16:00:00Z");
  play("recorded", "2016-06-05T07:15:00Z", 0, "rehearsal");
  const modes = () =>
    Object.fromEntries(
      db
        .prepare("SELECT id, mode FROM plays")
        .all()
        .map((p) => {
          const { id, mode } = p as { id: string; mode: string };
          return [id, mode];
        }),
    );

  const id = await add({ ...sunday, startTime: "10:00", endTime: "12:00" });
  const first = await call("owner", "POST", "/classify");
  expect(first.json()).toEqual({ service: 1, rehearsal: 2 });
  expect(modes()).toEqual({
    early: "rehearsal",
    during: "service",
    thursday: "rehearsal",
    recorded: "rehearsal", // recorded by Norless: kept
  });

  // In 2016 the service started at 9:00.
  await call("owner", "PUT", `/${id}`, { ...sunday, startTime: "09:00" });
  await call("owner", "POST", "/classify");
  expect(modes()).toMatchObject({ early: "service", during: "service" });
});

test("the mode now comes from the event in progress", async () => {
  await add(sunday);
  // Sunday 4 October 2026, Bucharest time (UTC+3).
  expect(modeAt(db, "c", new Date("2026-10-04T06:40:00Z"))).toBe("rehearsal");
  expect(modeAt(db, "c", new Date("2026-10-04T07:30:00Z"))).toBe("service");
  expect(modeAt(db, "c", new Date("2026-10-04T09:50:00Z"))).toBe("service");
  expect(modeAt(db, "c", new Date("2026-10-07T17:00:00Z"))).toBe("rehearsal");
});
