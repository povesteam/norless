import { beforeEach, expect, test } from "vitest";
import type { LiveState } from "../../shared/live.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import { playlistProblems } from "./problems.js";
import type { ScheduleEvent } from "../schedule/schedule.js";

const tz = "Europe/Bucharest";
const community = { id: "c", languages: ["ro", "uk"] };
let db: Db;

const state = (mode: "service" | "rehearsal"): LiveState => ({
  playlistId: null,
  entryId: null,
  slide: 0,
  blank: false,
  mode,
  changedBy: null,
  changedAt: null,
  since: null,
});
const sunday: ScheduleEvent = {
  id: "s",
  type: "service",
  kind: "recurring",
  weekday: 7,
  start_time: "10:00",
  end_time: "12:00",
  first_date: null,
  last_date: null,
  date: null,
  cancels_event_id: null,
};
// Sunday 4 October 2026, 10:30 in Bucharest: the last services were 13, 20 and 27
// September and this morning's isn't over.
const now = new Date("2026-10-04T07:30:00Z");

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  const long = Array.from({ length: 11 }, () => "x".repeat(30)).join("\n");
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro","uk"]', 'Europe/Bucharest', 'x', 'x');
    INSERT INTO rooms (id, community_id, name, created_at, updated_at) VALUES ('r', 'c', 'Sala', 'x', 'x');
    INSERT INTO screens (id, community_id, room_id, name, type, languages, secret, position, created_at, updated_at) VALUES
      ('ro', 'c', 'r', 'Proiector RO', 'projector', '["ro"]', 's1', 1, 'x', 'x'),
      ('uk', 'c', 'r', 'Proiector UK', 'projector', '["uk"]', 's2', 2, 'x', 'x'),
      ('band', 'c', 'r', 'Muzicieni', 'musicians', '["ro"]', 's3', 3, 'x', 'x');
    INSERT INTO songs (id, community_id, key_signature, tags, created_at, updated_at) VALUES
      ('no-uk', 'c', '', '[]', 'x', 'x'), ('long', 'c', 'D', '[]', 'x', 'x');
    INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
      ('v1', 'c', 'no-uk', 'ro', 'Doar română', 'Scurt', 'x', 'x'),
      ('v2', 'c', 'long', 'ro', 'Lungă', '1:\nScurt\n\n2:\n${long}', 'x', 'x'),
      ('v3', 'c', 'long', 'uk', 'Довга', 'Коротко', 'x', 'x');
    INSERT INTO playlists (id, community_id, title, created_at, updated_at) VALUES ('p', 'c', 'P', '2026-10-04T08:00:00.000Z', '2026-10-04T08:00:00.000Z');
    INSERT INTO entries (id, community_id, playlist_id, position, kind, song_id, created_at, updated_at) VALUES
      ('e1', 'c', 'p', 1, 'song', 'no-uk', 'x', 'x'),
      ('e2', 'c', 'p', 2, 'song', 'long', 'x', 'x');
  `);
});

const problems = (mode: "service" | "rehearsal", connected: string[] = []) =>
  playlistProblems(db, community, "p", {
    state: state(mode),
    connected: new Set(connected),
    events: [sunday],
    timeZone: tz,
    now,
  });

test("songs without a translation, text too small to read, and no key for the band", () => {
  expect(problems("rehearsal")).toEqual([
    { kind: "translation", entryId: "e1", language: "uk" },
    { kind: "key", entryId: "e1" },
    { kind: "small", entryId: "e2", language: "ro", slides: [1] },
  ]);
});

test("an English-only song shows alike on every screen: no missing translation", () => {
  db.exec(`
    INSERT INTO songs (id, community_id, key_signature, tags, created_at, updated_at) VALUES ('en', 'c', 'G', '[]', 'x', 'x');
    INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
      ('v4', 'c', 'en', 'en', 'Mighty to save', 'Savior', 'x', 'x');
    INSERT INTO entries (id, community_id, playlist_id, position, kind, song_id, created_at, updated_at) VALUES
      ('e3', 'c', 'p', 3, 'song', 'en', 'x', 'x');
  `);
  expect(
    (problems("rehearsal") ?? []).filter(
      (p) => "entryId" in p && p.entryId === "e3",
    ),
  ).toEqual([]);
});

test("a language only the stage shows: no missing translation", () => {
  // The UK projector goes; a stage monitor shows Ukrainian instead.
  db.exec(`
    UPDATE screens SET type = 'stage' WHERE id = 'uk';
    INSERT INTO screens (id, community_id, room_id, name, type, languages, secret, position, created_at, updated_at) VALUES
      ('voices', 'c', 'r', 'Voci', 'vocalists', '["uk"]', 's4', 4, 'x', 'x');
  `);
  expect(problems("rehearsal")).not.toContainEqual({
    kind: "translation",
    entryId: "e1",
    language: "uk",
  });
});

test("in a service, a screen there in 3 of the last 4 services is missed", () => {
  // The UK projector was on during three of the last four Sunday services.
  for (const day of ["2026-09-13", "2026-09-20", "2026-09-27"])
    db.prepare(
      "INSERT INTO screen_connections (id, community_id, screen_id, connected_at, disconnected_at) VALUES (?, 'c', 'uk', ?, ?)",
    ).run(day, `${day}T06:50:00Z`, `${day}T09:10:00Z`);
  const missing = { kind: "screen", screenId: "uk", name: "Proiector UK" };
  expect(problems("service")).toContainEqual(missing);
  expect(problems("service", ["uk"])).not.toContainEqual(missing);
  expect(problems("rehearsal")).not.toContainEqual(missing);
});

test("a song the owners excluded after it was added, with their reason", () => {
  db.exec(
    "UPDATE songs SET excluded_reason = 'Against our doctrine', excluded_at = 'x' WHERE id = 'long'",
  );
  expect(problems("rehearsal")).toContainEqual({
    kind: "excluded",
    entryId: "e2",
    reason: "Against our doctrine",
  });
});
