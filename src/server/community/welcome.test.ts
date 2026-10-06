import { beforeEach, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";

let db: Db;
let owner: string;
let team: string;

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('ana', 'Ana', 'ana@example.com', 'active', 'x', 'x'),
      ('ioana', 'Ioana', 'ioana@example.com', 'active', 'x', 'x');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m1', 'c', 'ana', '["owner"]', 'active', 'x', 'x'),
      ('m2', 'c', 'ioana', '["team"]', 'active', 'x', 'x');
  `);
  owner = createSession(db, "ana");
  team = createSession(db, "ioana");
});

const call = (
  session: string | null,
  method: "GET" | "PUT" | "POST",
  path: string,
  payload?: object,
) =>
  buildApp({ db, logger: false }).inject({
    method,
    url: `/api/communities/unu-unu${path}`,
    headers: session ? { cookie: `__Host-session=${session}` } : {},
    payload,
  });

test("owners write the announcements; projectors read them with the name, without a login", async () => {
  expect(
    (await call(team, "PUT", "/welcome", { announcements: ["x"] })).statusCode,
  ).toBe(403);
  const saved = await call(owner, "PUT", "/welcome", {
    announcements: ["**Bine ați venit!**", "  ", "Joi, repetiție"],
  });
  expect(saved.json()).toEqual({
    announcements: ["**Bine ați venit!**", "Joi, repetiție"],
  });
  expect((await call(null, "GET", "/welcome")).json()).toEqual({
    name: "Unu-Unu",
    logo: null,
    announcements: ["**Bine ați venit!**", "Joi, repetiție"],
  });
});

test("the welcome page goes up with the next service's start, for its countdown", async () => {
  const inAnHour = new Date(Date.now() + 3_600_000);
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(inAnHour);
  const part = (type: string) => local.find((p) => p.type === type)?.value;
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  const time = `${part("hour")}:${part("minute")}`;
  db.prepare(
    `INSERT INTO schedule_events (id, community_id, name, type, kind, date, start_time, end_time, created_at, updated_at)
     VALUES ('e', 'c', 'Serviciu de seară', 'service', 'one_off', ?, ?, '23:59', 'x', 'x')`,
  ).run(date, time);
  const view = await call(team, "POST", "/live", {
    type: "page",
    pageId: "welcome",
  });
  expect(view.json()).toMatchObject({
    page: {
      id: "welcome",
      welcome: { event: "Serviciu de seară", startsAt: expect.any(String) },
    },
  });
  const startsAt = Date.parse(view.json().page.welcome.startsAt);
  expect(Math.abs(startsAt - inAnHour.getTime())).toBeLessThan(61_000);
});
