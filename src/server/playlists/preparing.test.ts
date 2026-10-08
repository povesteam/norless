import { expect, test } from "vitest";
import { migrate, openDatabase } from "../db/db.js";
import { createPlaylist, getPlaylist } from "./playlists.js";

test("a playlist is being prepared until it's past or sung from", () => {
  const db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
    INSERT INTO songs (id, community_id, key_signature, time_signature, tags, created_at, updated_at) VALUES
      ('song', 'c', 'G', '', '[]', '2026-01-01', '2026-01-01');
  `);
  const now = new Date("2026-10-07T10:00:00Z");
  const { id } = createPlaylist(db, null, {
    communityId: "c",
    userId: null,
    now,
  });
  const preparing = (at: Date) =>
    getPlaylist(db, "c", id, { now: at })?.preparing;

  expect(preparing(now)).toBe(true);
  // The day after, it's past.
  expect(preparing(new Date("2026-10-08T10:00:00Z"))).toBe(false);
  db.prepare(
    "INSERT INTO plays (id, community_id, song_id, playlist_id, mode, played_at, created_at, updated_at) VALUES ('p', 'c', 'song', ?, 'service', ?, ?, ?)",
  ).run(id, now.toISOString(), now.toISOString(), now.toISOString());
  expect(preparing(now)).toBe(false);
});
