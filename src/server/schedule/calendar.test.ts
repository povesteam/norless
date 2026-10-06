import { beforeEach, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import { upcoming } from "./calendar.js";

const ics = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Test//EN",
  // Youth night every Friday at 19:00 UTC, ten times; the second one moved to 20:00,
  // the third cancelled, the fourth left out.
  "BEGIN:VEVENT",
  "UID:youth@test",
  "DTSTART:20261009T190000Z",
  "DTEND:20261009T210000Z",
  "RRULE:FREQ=WEEKLY;COUNT=10",
  "EXDATE:20261030T190000Z",
  "SUMMARY:Seară de tineret",
  "LOCATION:Sala mică",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:youth@test",
  "RECURRENCE-ID:20261016T190000Z",
  "DTSTART:20261016T200000Z",
  "DTEND:20261016T220000Z",
  "SUMMARY:Seară de tineret (mutată)",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:youth@test",
  "RECURRENCE-ID:20261023T190000Z",
  "DTSTART:20261023T190000Z",
  "DTEND:20261023T210000Z",
  "STATUS:CANCELLED",
  "SUMMARY:Seară de tineret",
  "END:VEVENT",
  // A conference over a whole day, and one long past.
  "BEGIN:VEVENT",
  "UID:conf@test",
  "DTSTART;VALUE=DATE:20261012",
  "DTEND;VALUE=DATE:20261013",
  "SUMMARY:Conferință",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:old@test",
  "DTSTART:20200101T100000Z",
  "DTEND:20200101T110000Z",
  "SUMMARY:Demult",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

test("a calendar's coming events: repeats expanded, moved and cancelled dates kept", () => {
  const events = upcoming(ics, new Date("2026-10-05T00:00:00Z"), 28);
  expect(events.map((e) => [e.title, e.start.slice(0, 16), e.allDay])).toEqual([
    ["Seară de tineret", "2026-10-09T19:00", false],
    ["Conferință", "2026-10-12", true],
    ["Seară de tineret (mutată)", "2026-10-16T20:00", false],
    // 23 cancelled, 30 left out.
  ]);
  expect(events[0]?.location).toBe("Sala mică");
  // At most so many.
  expect(upcoming(ics, new Date("2026-10-05T00:00:00Z"), 365, 2)).toHaveLength(
    2,
  );
});

let db: Db;
let sessions: Record<string, string>;
beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', 'x', 'x');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('ana', 'Ana', 'ana@example.com', 'active', 'x', 'x'),
      ('ion', 'Ion', 'ion@example.com', 'active', 'x', 'x'),
      ('out', 'Out', 'out@example.com', 'active', 'x', 'x');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m-ana', 'c', 'ana', '["owner"]', 'active', 'x', 'x'),
      ('m-ion', 'c', 'ion', '[]', 'active', 'x', 'x');
  `);
  sessions = Object.fromEntries(
    ["ana", "ion", "out"].map((id) => [id, createSession(db, id)]),
  );
});
const call = (as: string | null, method: "GET" | "PUT", payload?: object) =>
  buildApp({ db, logger: false }).inject({
    method,
    url: "/api/communities/unu-unu/calendar",
    headers: as ? { cookie: `__Host-session=${sessions[as]}` } : {},
    payload,
  });

test("owners set the calendar's address, which only they see; members read its events", async () => {
  expect(
    (await call("ion", "PUT", { url: "https://x.test/a.ics" })).statusCode,
  ).toBe(403);
  expect(
    (await call("ana", "PUT", { url: "ftp://x.test/a.ics" })).statusCode,
  ).toBe(400);
  // webcal:// is read over https; an address that doesn't answer is told, not an error.
  const saved = await call("ana", "PUT", { url: "webcal://127.0.0.1/a.ics" });
  expect(saved.json()).toMatchObject({
    url: "https://127.0.0.1/a.ics",
    events: [],
    failed: true,
  });
  const member = (await call("ion", "GET")).json<object>();
  expect(member).toMatchObject({ events: [], failed: true });
  expect(member).not.toHaveProperty("url");
  expect((await call("out", "GET")).statusCode).toBe(403);
  expect((await call(null, "GET")).statusCode).toBe(401);
  expect((await call("ana", "PUT", { url: null })).json()).toMatchObject({
    url: null,
    failed: false,
  });
});
