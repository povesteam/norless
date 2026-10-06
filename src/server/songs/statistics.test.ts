import { beforeEach, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import { lastServiceDays, songResults } from "./search.js";
import {
  mostSung,
  notSungLately,
  songPlays,
  servicesGrid,
  sungLately,
  yearRecap,
} from "./statistics.js";

let db: Db;
const now = new Date("2026-10-03T12:00:00Z");
let played = 0;

/** Plays of a song on these days, at 10:00 in Bucharest. */
function plays(
  song: string,
  days: string[],
  mode: "service" | "rehearsal" | "unclassified" = "service",
) {
  for (const day of days)
    db.prepare(
      "INSERT INTO plays (id, community_id, song_id, mode, played_at, created_at, updated_at) VALUES (?, 'c', ?, ?, ?, 'x', 'x')",
    ).run(`p${played++}`, song, mode, `${day}T07:00:00.000Z`);
}

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', 'x', 'x');
    INSERT INTO songs (id, community_id, key_signature, tags, created_at, updated_at) VALUES
      ('noel', 'c', 'G', '[]', 'x', 'x'), ('har', 'c', 'D', '[]', 'x', 'x'),
      ('old', 'c', 'A', '[]', 'x', 'x'), ('gone', 'c', 'C', '[]', 'x', 'x');
    INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
      ('v1', 'c', 'noel', 'ro', 'O, ce veste minunată', 'x', 'x', 'x'),
      ('v2', 'c', 'har', 'ro', 'Har minunat', 'x', 'x', 'x'),
      ('v3', 'c', 'old', 'ro', 'Cântec vechi', 'x', 'x', 'x'),
      ('v4', 'c', 'gone', 'ro', 'Șters', 'x', 'x', 'x');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('ana', 'Ana', 'ana@example.com', 'active', 'x', 'x'),
      ('st', 'St', 'st@example.com', 'active', 'x', 'x');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m', 'c', 'ana', '[]', 'active', 'x', 'x');
  `);
  played = 0;
  plays("noel", ["2025-12-21", "2025-12-25", "2025-01-05", "2025-07-06"]);
  plays("har", ["2025-12-21", "2026-03-01", "2026-09-27"]);
  plays("har", ["2026-09-24", "2026-09-25", "2026-09-26"], "rehearsal");
  plays("har", ["2015-01-01"], "unclassified");
  plays("old", ["2023-02-05", "2023-06-11", "2024-01-14", "2024-11-03"]);
  plays("gone", ["2026-09-20", "2026-09-13"]);
  db.exec("UPDATE songs SET deleted_at = 'x' WHERE id = 'gone'");
});

const ids = (songs: { id: string; services: number }[]) =>
  songs.map((s) => [s.id, s.services]);

test("most sung in the last 12 months, all time, a year, or a season of it; services only", () => {
  expect(ids(mostSung(db, "c", "last12", null, now))).toEqual([
    ["har", 3],
    ["noel", 2],
  ]);
  expect(ids(mostSung(db, "c", "all", null, now))).toEqual([
    ["noel", 4],
    ["old", 4],
    ["har", 3],
  ]);
  // Winter is January, February and December of the year.
  expect(ids(mostSung(db, "c", "2025", "winter", now))).toEqual([
    ["noel", 3],
    ["har", 1],
  ]);
  expect(ids(mostSung(db, "c", "2025", "summer", now))).toEqual([["noel", 1]]);
});

test("not sung lately: 3 services or more, none in 6 months, not excluded", () => {
  // Christmas, last sung 9 months ago, comes before a song last sung 2 years ago.
  expect(ids(notSungLately(db, "c", now))).toEqual([
    ["noel", 4],
    ["old", 4],
  ]);
  db.exec(
    "UPDATE songs SET excluded_at = 'x', excluded_reason = 'x' WHERE id = 'old'",
  );
  expect(ids(notSungLately(db, "c", now))).toEqual([["noel", 4]]);
});

test("a song's services: count, first, last and per year", () => {
  expect(songPlays(db, "c", "har")).toEqual({
    services: 3,
    first: "2025-12-21T07:00:00.000Z",
    last: "2026-09-27T07:00:00.000Z",
    years: [
      { year: 2026, services: 2 },
      { year: 2025, services: 1 },
    ],
  });
  expect(songPlays(db, "c", "nothing")).toEqual({
    services: 0,
    first: null,
    last: null,
    years: [],
  });
});

test("members only, with the years that have plays", async () => {
  const app = buildApp({ db, logger: false });
  const get = (url: string, as?: string) =>
    app.inject({
      url: `/api/communities/unu-unu${url}`,
      headers: as ? { cookie: `__Host-session=${createSession(db, as)}` } : {},
    });
  expect((await get("/statistics")).statusCode).toBe(401);
  expect((await get("/statistics", "st")).statusCode).toBe(403);
  expect((await get("/songs/har/plays", "st")).statusCode).toBe(403);
  const response = await get("/statistics?period=2025&season=winter", "ana");
  expect(response.statusCode).toBe(200);
  expect(response.json()).toMatchObject({
    years: [2026, 2025, 2024, 2023],
    mostSung: [
      { id: "noel", services: 3, titles: { ro: "O, ce veste minunată" } },
      { id: "har" },
    ],
  });
  expect((await get("/statistics?period=last", "ana")).statusCode).toBe(400);
});

test("played in 2 of the last 4 services or more: a hint in search, and a list", () => {
  // Six Sundays; the last four count. "isus" in all, "har" in three of the last four,
  // "noel" in one.
  const sundays = [
    "2026-08-23",
    "2026-08-30",
    "2026-09-06",
    "2026-09-13",
    "2026-09-20",
    "2026-09-27",
  ];
  db.exec(`
    INSERT INTO songs (id, community_id, key_signature, tags, created_at, updated_at) VALUES ('isus', 'c', 'E', '[]', 'x', 'x');
    INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
      ('v5', 'c', 'isus', 'ro', 'Isus', 'x', 'x', 'x');
  `);
  plays("isus", sundays);
  plays("har", sundays.slice(1, 4));
  plays("noel", sundays.slice(5));
  expect(lastServiceDays(db, "c")).toEqual(sundays.slice(2).reverse());
  expect(sungLately(db, "c").map((s) => [s.id, s.recent])).toEqual([
    ["isus", { services: 4, of: 4 }],
    // With 2026-09-27's play from beforeEach, "har" has 3 of the 4.
    ["har", { services: 3, of: 4 }],
  ]);
  const [noel] = songResults(db, ["noel"], new Set(), lastServiceDays(db, "c"));
  expect(noel).not.toHaveProperty("recent");
});

test("the year in songs: services, songs, and the songs first sung that year", () => {
  // From beforeEach: 2025 has noel (Jan 5, Jul 6, Dec 21, Dec 25) and har (Dec 21).
  const recap = yearRecap(db, "c", "2025");
  expect(recap).toMatchObject({ services: 4, songs: 2, newCount: 2 });
  expect(recap.newSongs.map((s) => [s.id, s.first.slice(0, 10)])).toEqual([
    ["noel", "2025-01-05"],
    ["har", "2025-12-21"],
  ]);
  // "gone", deleted, was first sung in 2026: counted, not listed.
  expect(yearRecap(db, "c", "2026")).toMatchObject({
    newCount: 1,
    newSongs: [],
  });
});

test("the last 12 services as a grid: each song's days among them, most sung first", () => {
  // From beforeEach: exactly 12 service days, the deleted song's two among them.
  const grid = servicesGrid(db, "c");
  expect(grid.days).toHaveLength(12);
  expect(grid.days[0]).toBe("2023-02-05");
  expect(grid.days.at(-1)).toBe("2026-09-27");
  // Tied at 4, the one sung more lately comes first.
  expect(grid.songs.map((s) => [s.id, s.sung.length, s.sung.at(-1)])).toEqual([
    ["noel", 4, "2025-12-25"],
    ["old", 4, "2024-11-03"],
    ["har", 3, "2026-09-27"],
  ]);
});
