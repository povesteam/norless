import { expect, test } from "vitest";
import { migrate, openDatabase } from "../db/db.js";
import { changePlaylistDate } from "./playlist-date.js";
import { changePlaylist, createPlaylist, getPlaylist } from "./playlists.js";

test("a playlist moves to another day, planning its service if it has one", () => {
  const db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', 'x', 'x'),
      ('other', 'other', 'Other', '["ro"]', 'Europe/Bucharest', 'x', 'x');
    INSERT INTO schedule_events (id, community_id, name, type, kind, weekday, start_time, end_time, created_at, updated_at) VALUES
      ('sunday', 'c', 'Serviciu', 'service', 'recurring', 7, '10:00', '12:00', 'x', 'x');
    INSERT INTO users (id, display_name, status, created_at, updated_at) VALUES
      ('u', 'Ioana', 'active', 'x', 'x');
  `);
  const who = {
    communityId: "c",
    userId: "u",
    now: new Date("2026-10-07T10:00:00Z"),
  };
  const { id } = createPlaylist(db, null, { ...who, userId: null }, null);
  const shown = () => {
    const playlist = getPlaylist(db, "c", id);
    return { date: playlist?.date, service: playlist?.service };
  };

  // A Sunday: its service.
  expect(changePlaylistDate(db, id, "2026-10-18", who)).toBe(true);
  expect(shown()).toEqual({
    date: "2026-10-18",
    service: { eventId: "sunday", date: "2026-10-18" },
  });
  // A Tuesday: only the day.
  expect(changePlaylistDate(db, id, "2026-10-20", who)).toBe(true);
  expect(shown()).toEqual({ date: "2026-10-20", service: null });
  // Archived, or another community's: not changed.
  changePlaylist(db, id, { archived: true }, who);
  expect(changePlaylistDate(db, id, "2026-10-18", who)).toBe(false);
  expect(
    changePlaylistDate(db, id, "2026-10-18", { ...who, communityId: "other" }),
  ).toBe(false);
});
