import { beforeEach, expect, test } from "vitest";
import { type Db, migrate, openDatabase } from "../db/db.js";
import { makeNextPlaylists } from "./next-playlist.js";
import { createPlaylist, nextServicePlaylist } from "./playlists.js";

let db: Db;

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro","uk"]', 'Europe/Bucharest', 'x', 'x');
    INSERT INTO users (id, display_name, status, created_at, updated_at) VALUES
      ('ioana', 'Ioana', 'active', 'x', 'x');
    -- Sundays 10:00 to 12:00, and a rehearsal on Thursdays.
    INSERT INTO schedule_events (id, community_id, name, type, kind, weekday, start_time, end_time, created_at, updated_at) VALUES
      ('sunday', 'c', 'Serviciu', 'service', 'recurring', 7, '10:00', '12:00', 'x', 'x'),
      ('thursday', 'c', 'Repetiție', 'rehearsal', 'recurring', 4, '19:00', '21:00', 'x', 'x');
  `);
});

/** A local time in Bucharest (UTC+3 in October). */
const at = (local: string) => new Date(`${local}+03:00`);
const titles = () =>
  db
    .prepare(
      "SELECT title, service_date, created_by FROM playlists ORDER BY created_at",
    )
    .all();

test("30 minutes after Sunday's service, next Sunday gets an empty playlist, once", () => {
  // This Sunday's, made during the week.
  createPlaylist(db, "4 octombrie", {
    communityId: "c",
    userId: "ioana",
    now: at("2026-10-01T20:00:00"),
  });
  // Sunday 4 October, 12:20: the service may still run late.
  expect(makeNextPlaylists(db, at("2026-10-04T12:20:00"))).toEqual([]);
  const made = makeNextPlaylists(db, at("2026-10-04T12:31:00"));
  expect(made).toMatchObject([{ slug: "unu-unu" }]);
  // Untitled: its date names it.
  expect(titles()).toEqual([
    { title: "4 octombrie", service_date: "2026-10-04", created_by: "ioana" },
    { title: null, service_date: "2026-10-11", created_by: null },
  ]);
  expect(db.prepare("SELECT count(*) FROM entries").pluck().get()).toBe(0);
  // Checked again, nothing more.
  expect(makeNextPlaylists(db, at("2026-10-04T12:36:00"))).toEqual([]);
  expect(makeNextPlaylists(db, at("2026-10-08T22:00:00"))).toEqual([]);
  expect(titles()).toHaveLength(2);
});

test("none when someone made a playlist since the service ended", () => {
  createPlaylist(db, "Duminica viitoare", {
    communityId: "c",
    userId: "ioana",
    now: at("2026-10-04T12:10:00"),
  });
  expect(makeNextPlaylists(db, at("2026-10-04T12:31:00"))).toEqual([]);
  expect(titles()).toEqual([
    {
      title: "Duminica viitoare",
      service_date: "2026-10-11",
      created_by: "ioana",
    },
  ]);
});

test("rehearsals get none", () => {
  db.prepare("DELETE FROM schedule_events WHERE id = 'sunday'").run();
  expect(makeNextPlaylists(db, at("2026-10-01T22:00:00"))).toEqual([]);
  expect(makeNextPlaylists(db, at("2026-10-09T22:00:00"))).toEqual([]);
  expect(titles()).toEqual([]);
});

test("a server that was down catches up, for the service after the last one", () => {
  // Down from Sunday morning until Tuesday.
  makeNextPlaylists(db, at("2026-10-06T09:00:00"));
  // Down for two more weeks: the last service was 18 October.
  makeNextPlaylists(db, at("2026-10-20T09:00:00"));
  expect(titles()).toEqual([
    { title: null, service_date: "2026-10-11", created_by: null },
    { title: null, service_date: "2026-10-25", created_by: null },
  ]);
});

test("the next service's playlist: the service under way or next, not a newer playlist", () => {
  const made = (local: string) =>
    createPlaylist(db, null, {
      communityId: "c",
      userId: "ioana",
      now: at(local),
    }).id;
  // Sunday's, made on Tuesday; then one made on Wednesday, which plans the Sunday after.
  const sunday = made("2026-10-06T13:00:00");
  const later = made("2026-10-07T13:00:00");
  const next = (local: string) => nextServicePlaylist(db, "c", at(local));

  expect(next("2026-10-07T15:00:00")).toBe(sunday);
  expect(next("2026-10-11T11:00:00")).toBe(sunday);
  // Once Sunday's service has ended, the Sunday after's.
  expect(next("2026-10-11T12:01:00")).toBe(later);
  // A service without a playlist yet: none, and the home opens the newest.
  expect(next("2026-10-18T12:01:00")).toBeNull();
});
