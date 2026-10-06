import { beforeEach, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { channelOf, findStream, type YouTube } from "./chapters.js";
import { type Db, migrate, openDatabase } from "../db/db.js";

let db: Db;
let owner: string;

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', 'x', 'x');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('ana', 'Ana', 'ana@example.com', 'active', 'x', 'x');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m', 'c', 'ana', '["owner"]', 'active', 'x', 'x');
    INSERT INTO playlists (id, community_id, title, created_at, updated_at) VALUES
      ('p', 'c', 'Duminică', '2026-10-04T08:00:00.000Z', '2026-10-04T08:00:00.000Z');
    INSERT INTO entries (id, community_id, playlist_id, position, kind, text, created_at, updated_at) VALUES
      ('e1', 'c', 'p', 1, 'text', 'Bun venit', 'x', 'x');
    INSERT INTO live_log (id, community_id, playlist_id, entry_id, mode, at) VALUES
      ('l1', 'c', 'p', 'e1', 'service', '2026-10-04T07:12:30.000Z');
  `);
  owner = createSession(db, "ana");
});

/** A channel with an old stream, Sunday's (from 07:00 to 09:00) and an upload. */
const youtube: YouTube = async (resource, params) => {
  calls.push(resource);
  if (resource === "channels")
    return params.forHandle === "@Unu-unuRo"
      ? { items: [{ id: "UC0123456789012345678901" }] }
      : { items: [] };
  if (resource === "playlistItems")
    return params.playlistId === "UU0123456789012345678901"
      ? {
          items: ["old", "sunday", "upload"].map((videoId) => ({
            contentDetails: { videoId },
          })),
        }
      : {};
  return {
    items: [
      {
        id: "old",
        liveStreamingDetails: {
          actualStartTime: "2026-09-27T07:00:00Z",
          actualEndTime: "2026-09-27T09:00:00Z",
        },
      },
      {
        id: "sunday",
        liveStreamingDetails: {
          actualStartTime: "2026-10-04T07:00:00Z",
          actualEndTime: "2026-10-04T09:00:00Z",
        },
      },
      { id: "upload" },
    ],
  };
};
let calls: string[] = [];

test("a channel is a handle or a channel id, from what was typed or pasted", () => {
  expect(channelOf("@Unu-unuRo")).toBe("@Unu-unuRo");
  expect(channelOf("https://www.youtube.com/@Unu-unuRo/streams")).toBe(
    "@Unu-unuRo",
  );
  expect(channelOf("youtube.com/channel/UC0123456789012345678901?si=x")).toBe(
    "UC0123456789012345678901",
  );
  expect(channelOf("https://example.com/@Unu-unuRo")).toBeNull();
  expect(channelOf("Unu-unu")).toBeNull();
});

test("the stream running at the service is found among the channel's videos", async () => {
  calls = [];
  expect(
    await findStream(youtube, "@Unu-unuRo", "2026-10-04T07:12:30.000Z"),
  ).toEqual({
    videoId: "sunday",
    startedAt: "2026-10-04T07:00:00Z",
    endedAt: "2026-10-04T09:00:00Z",
  });
  expect(calls).toEqual(["channels", "playlistItems", "videos"]);
  // A channel id needs no lookup; no stream at that time is none.
  calls = [];
  expect(
    await findStream(
      youtube,
      "UC0123456789012345678901",
      "2026-10-05T07:00:00.000Z",
    ),
  ).toBeNull();
  expect(calls).toEqual(["playlistItems", "videos"]);
  expect(
    await findStream(youtube, "@Altcineva", "2026-10-04T07:12:30.000Z"),
  ).toBeNull();
});

test("owners set the channel; members get the last service's stream", async () => {
  const app = buildApp({ db, logger: false, youtube });
  const headers = { cookie: `__Host-session=${owner}` };
  const stream = async () =>
    (
      await app.inject({
        url: "/api/communities/unu-unu/playlists/p/stream",
        headers,
      })
    ).json();
  // No channel yet: nothing to look in.
  expect(await stream()).toEqual({ stream: null });

  const set = (channel: string | null) =>
    app.inject({
      method: "PUT",
      url: "/api/communities/unu-unu/youtube-channel",
      headers,
      payload: { channel },
    });
  expect((await set("not a channel")).statusCode).toBe(400);
  expect((await set("https://www.youtube.com/@Unu-unuRo")).json()).toEqual({
    channel: "@Unu-unuRo",
  });
  expect(
    (await app.inject({ url: "/api/communities/unu-unu" })).json(),
  ).toMatchObject({ youtubeChannel: "@Unu-unuRo" });
  const sunday = {
    videoId: "sunday",
    startedAt: "2026-10-04T07:00:00Z",
    endedAt: "2026-10-04T09:00:00Z",
  };
  expect(await stream()).toEqual({ stream: sunday });

  // Found once, it's kept: asked again, YouTube isn't.
  const failing = buildApp({
    db,
    logger: false,
    youtube: () => Promise.reject(new Error("quota")),
  });
  const again = async () =>
    (
      await failing.inject({
        url: "/api/communities/unu-unu/playlists/p/stream",
        headers,
      })
    ).json();
  expect(await again()).toEqual({ stream: sunday });

  // Without an API key, or when YouTube fails, the offset is typed as before.
  db.exec("DELETE FROM streams");
  expect(
    (
      await failing.inject({
        url: "/api/communities/unu-unu/playlists/p/stream",
        headers,
      })
    ).json(),
  ).toEqual({ stream: null });
  expect((await set(null)).json()).toEqual({ channel: null });
});
