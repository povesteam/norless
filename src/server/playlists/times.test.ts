import { beforeEach, describe, expect, test } from "vitest";
import type { LiveState } from "../../shared/live.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import type { ScheduleEvent } from "../schedule/schedule.js";
import { playlistTimes, songLengths, sungWords } from "./times.js";

const tz = "Europe/Bucharest";
const community = { id: "c", languages: ["ro"] };
let db: Db;

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', 'x', 'x');
    INSERT INTO songs (id, community_id, tags, created_at, updated_at) VALUES
      ('known', 'c', '[]', 'x', 'x'), ('other', 'c', '[]', 'x', 'x'), ('new', 'c', '[]', 'x', 'x');
    INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
      ('v1', 'c', 'known', 'ro', 'Știută', 'unu doi trei patru cinci șase șapte opt nouă zece', 'x', 'x'),
      ('v2', 'c', 'other', 'ro', 'Alta', 'X', 'x', 'x'),
      ('v3', 'c', 'new', 'ro', 'Nouă', 'unu doi trei patru cinci', 'x', 'x');
  `);
});

const play = (
  id: string,
  song: string,
  at: string,
  { imported = 1, mode = "service", ended = null as string | null } = {},
) =>
  db
    .prepare(
      "INSERT INTO plays (id, community_id, song_id, mode, played_at, ended_at, imported, created_at, updated_at) VALUES (?, 'c', ?, ?, ?, ?, ?, 'x', 'x')",
    )
    .run(id, song, mode, at, ended, imported);

describe("lengths", () => {
  test("an imported play lasts until the next play that day, at most 12 minutes", () => {
    play("a", "known", "2026-09-06T07:21:00Z");
    play("b", "other", "2026-09-06T07:27:00Z");
    play("c", "known", "2026-09-13T07:00:00Z");
    play("d", "other", "2026-09-13T07:30:00Z"); // 30 minutes later: 12
    play("e", "known", "2026-09-20T07:00:00Z"); // the day's last: no length
    expect(songLengths(db, community, tz).lengths.get("known")).toBe(
      (6 * 60 + 12 * 60) / 2,
    );
  });

  test("Norless's own plays have an end; rehearsals don't count", () => {
    play("a", "known", "2026-09-06T07:00:00Z", {
      imported: 0,
      ended: "2026-09-06T07:05:52Z",
    });
    play("b", "known", "2026-09-07T07:00:00Z", {
      imported: 0,
      mode: "rehearsal",
      ended: "2026-09-07T07:30:00Z",
    });
    expect(songLengths(db, community, tz).lengths.get("known")).toBe(352);
  });

  test("the median of the last 10 service plays", () => {
    for (let i = 0; i < 12; i++)
      play(
        `p${i}`,
        "known",
        `2026-0${1 + Math.floor(i / 4)}-1${i % 4}T07:00:00Z`,
        {
          imported: 0,
          ended: `2026-0${1 + Math.floor(i / 4)}-1${i % 4}T07:0${i < 2 ? 9 : 4}:00Z`,
        },
      );
    // The two 9-minute plays are the oldest, so they fall out.
    expect(songLengths(db, community, tz).lengths.get("known")).toBe(240);
  });

  test("sung words count repeats by name and repeat marks", () => {
    expect(sungWords("1:\nUnu doi\n\nR:\n/:Trei patru:/\n\nR")).toBe(10);
    expect(sungWords("<i>Unu</i> ~doi_\n! notă")).toBe(2);
  });
});

describe("playlist times", () => {
  const idle: LiveState = {
    playlistId: null,
    entryId: null,
    slide: 0,
    blank: false,
    mode: "rehearsal",
    changedBy: null,
    changedAt: null,
    since: null,
  };
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
  beforeEach(() => {
    // "known" lasts 6 minutes over 10 words: 36 seconds a word.
    play("a", "known", "2026-09-06T07:00:00Z", {
      imported: 0,
      ended: "2026-09-06T07:06:00Z",
    });
    db.exec(`
      INSERT INTO playlists (id, community_id, title, created_at, updated_at) VALUES ('p', 'c', 'P', '2026-10-04T08:00:00.000Z', '2026-10-04T08:00:00.000Z');
      INSERT INTO entries (id, community_id, playlist_id, position, kind, song_id, text, planned_minutes, created_at, updated_at) VALUES
        ('e1', 'c', 'p', 1, 'song', 'known', NULL, NULL, 'x', 'x'),
        ('e2', 'c', 'p', 2, 'divider', NULL, 'Predica', 45, 'x', 'x'),
        ('e3', 'c', 'p', 3, 'song', 'new', NULL, NULL, 'x', 'x');
    `);
  });

  test("before the service, starts from the scheduled start; a new song is approximate", () => {
    // Saturday: the next event is Sunday 10:00 (07:00Z).
    const times = playlistTimes(
      db,
      community,
      "p",
      idle,
      [sunday],
      tz,
      new Date("2026-10-03T12:00:00Z"),
    );
    expect(times?.entries.map((e) => [e.at, e.minutes, e.approximate])).toEqual(
      [
        ["2026-10-04T07:00:00.000Z", 6, false],
        ["2026-10-04T07:06:00.000Z", 45, false],
        ["2026-10-04T07:51:00.000Z", 3, true], // 5 words at 36 seconds
      ],
    );
    expect(times).toMatchObject({
      end: "2026-10-04T07:54:00.000Z",
      approximate: true,
      scheduledEnd: "2026-10-04T09:00:00.000Z",
      minutesPast: -66,
    });
  });

  test("during the service, entries shown keep when they went live", () => {
    const live: LiveState = {
      ...idle,
      playlistId: "p",
      entryId: "e2",
      since: "2026-10-04T07:10:00.000Z",
      wentLive: {
        e1: "2026-10-04T07:02:00.000Z",
        e2: "2026-10-04T07:10:00.000Z",
      },
    };
    const times = playlistTimes(
      db,
      community,
      "p",
      live,
      [sunday],
      tz,
      new Date("2026-10-04T07:20:00Z"),
    );
    expect(times?.entries.map((e) => [e.at, e.shown])).toEqual([
      ["2026-10-04T07:02:00.000Z", true],
      ["2026-10-04T07:10:00.000Z", true],
      ["2026-10-04T07:55:00.000Z", false],
    ]);
  });

  test("live outside an event, the end isn't compared with next week's service", () => {
    // A Thursday evening rehearsal of the playlist, with no event in the schedule.
    const live: LiveState = {
      ...idle,
      playlistId: "p",
      entryId: "e1",
      since: "2026-10-01T16:00:00.000Z",
    };
    const times = playlistTimes(
      db,
      community,
      "p",
      live,
      [sunday],
      tz,
      new Date("2026-10-01T16:02:00Z"),
    );
    expect(times).toMatchObject({ scheduledEnd: null, minutesPast: null });
  });
});
