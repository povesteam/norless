import { beforeEach, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import type { YouTube } from "./chapters.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import { findStreams, replayAt } from "./replays.js";

let db: Db;

// Sunday's service, streamed from 06:58 to 09:00; songs went live at 07:02 and 07:20.
beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, youtube_channel, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', 'UC0123456789012345678901', 'x', 'x');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('ion', 'Ion', 'ion@example.com', 'active', 'x', 'x'),
      ('eva', 'Eva', 'eva@example.com', 'active', 'x', 'x');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m1', 'c', 'ion', '["team"]', 'active', 'x', 'x'),
      ('m2', 'c', 'eva', '[]', 'active', 'x', 'x');
    INSERT INTO songs (id, community_id, created_at, updated_at) VALUES ('har', 'c', 'x', 'x');
    INSERT INTO playlists (id, community_id, title, created_at, updated_at) VALUES ('p', 'c', 'Duminică', '2026-10-04T08:00:00.000Z', '2026-10-04T08:00:00.000Z');
    INSERT INTO entries (id, community_id, playlist_id, position, kind, song_id, created_at, updated_at) VALUES
      ('e1', 'c', 'p', 1, 'song', 'har', 'x', 'x'),
      ('e2', 'c', 'p', 2, 'song', 'har', 'x', 'x');
    INSERT INTO live_log (id, community_id, playlist_id, entry_id, mode, at) VALUES
      ('l1', 'c', 'p', 'e1', 'service', '2026-10-04T07:02:00.000Z'),
      ('l2', 'c', 'p', 'e2', 'service', '2026-10-04T07:20:00.000Z');
    INSERT INTO plays (id, community_id, song_id, playlist_id, mode, played_at, created_at, updated_at) VALUES
      ('a', 'c', 'har', 'p', 'service', '2026-10-04T07:02:00.000Z', 'x', 'x'),
      ('b', 'c', 'har', 'p', 'service', '2026-10-04T07:20:00.000Z', 'x', 'x'),
      ('old', 'c', 'har', NULL, 'service', '2025-01-05T08:00:00.000Z', 'x', 'x');
  `);
});

/** A channel whose latest stream is Sunday's, finished or still live. */
const channel =
  (ended = true): YouTube =>
  async (resource) => {
    calls.push(resource);
    if (resource === "playlistItems")
      return { items: [{ contentDetails: { videoId: "sunday" } }] };
    return {
      items: [
        {
          id: "sunday",
          liveStreamingDetails: {
            actualStartTime: "2026-10-04T06:58:00Z",
            ...(ended && { actualEndTime: "2026-10-04T09:00:00Z" }),
          },
        },
      ],
    };
  };
let calls: string[] = [];
const monday = new Date("2026-10-05T08:00:00Z");

test("after a service its stream is found once and kept, and moments link to their second", async () => {
  // Still live: not kept, since it would cover every later service.
  await findStreams(db, channel(false), monday);
  expect(replayAt(db, "c", "2026-10-04T07:02:00.000Z")).toBeNull();

  calls = [];
  await findStreams(db, channel(), monday);
  expect(calls).toEqual(["playlistItems", "videos"]);
  expect(replayAt(db, "c", "2026-10-04T07:02:00.000Z")).toBe(
    "https://www.youtube.com/watch?v=sunday&t=240s",
  );
  // Outside it: nothing. Kept: not looked up again.
  expect(replayAt(db, "c", "2026-10-04T09:30:00.000Z")).toBeNull();
  calls = [];
  await findStreams(db, channel(), monday);
  expect(calls).toEqual([]);
});

test("a song's moments for everyone, a playlist's entries, and the team's correction", async () => {
  await findStreams(db, channel(), monday);
  const app = buildApp({ db, logger: false });
  const get = async (url: string) =>
    (await app.inject({ url: `/api/communities/unu-unu${url}` })).json();

  // Newest first, only those in a stream; visitors too.
  expect(await get("/songs/har/replays")).toEqual([
    {
      at: "2026-10-04T07:20:00.000Z",
      url: "https://www.youtube.com/watch?v=sunday&t=1320s",
    },
    {
      at: "2026-10-04T07:02:00.000Z",
      url: "https://www.youtube.com/watch?v=sunday&t=240s",
    },
  ]);
  expect(await get("/playlists/p/replays")).toEqual({
    e1: "https://www.youtube.com/watch?v=sunday&t=240s",
    e2: "https://www.youtube.com/watch?v=sunday&t=1320s",
  });

  // The first chapter starts at 3:00 in the video: the stream started a minute later.
  const correct = (user: string) =>
    app.inject({
      method: "PUT",
      url: "/api/communities/unu-unu/playlists/p/stream",
      headers: { cookie: `__Host-session=${createSession(db, user)}` },
      payload: { videoId: "sunday", firstAt: 180 },
    });
  expect((await correct("eva")).statusCode).toBe(403);
  expect((await correct("ion")).statusCode).toBe(204);
  expect(await get("/playlists/p/replays")).toEqual({
    e1: "https://www.youtube.com/watch?v=sunday&t=180s",
    e2: "https://www.youtube.com/watch?v=sunday&t=1260s",
  });
});
