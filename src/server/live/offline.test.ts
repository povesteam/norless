import { beforeEach, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import type { Kept } from "./offline.js";

let db: Db;
let sessions: Record<string, string>;
beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro","uk"]', 'Europe/Bucharest', 'x', 'x');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('ana', 'Ana', 'ana@example.com', 'active', 'x', 'x');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m-ana', 'c', 'ana', '["team"]', 'active', 'x', 'x');
    INSERT INTO songs (id, community_id, key_signature, time_signature, tags, created_at, updated_at, deleted_at) VALUES
      ('s1', 'c', 'G', '3/4', '[]', 'x', 'x', NULL),
      ('gone', 'c', '', '', '[]', 'x', 'x', 'y');
    INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
      ('v1', 'c', 's1', 'ro', 'Har minunat', '1:\n.G\nHar minunat', 'x', 'x'),
      ('v2', 'c', 's1', 'uk', 'Дивна благодать', 'Дивна благодать', 'x', 'x');
    INSERT INTO playlists (id, community_id, title, created_at, updated_at, created_by) VALUES
      ('p1', 'c', 'Duminică', '2026-10-01', 'x', 'ana');
    INSERT INTO entries (id, community_id, playlist_id, position, kind, song_id, created_at, updated_at, created_by) VALUES
      ('e1', 'c', 'p1', 1, 'song', 's1', 'x', 'x', 'ana');
  `);
  sessions = { ana: createSession(db, "ana") };
});

test("a member's device keeps the songs and the newest playlists, without names", async () => {
  const app = buildApp({ db, logger: false });
  const get = (cookie?: string) =>
    app.inject({
      url: "/api/communities/unu-unu/offline",
      headers: cookie ? { cookie: `__Host-session=${cookie}` } : {},
    });
  expect((await get()).statusCode).toBe(401);
  const kept = (await get(sessions.ana)).json<Kept>();
  expect(kept.community).toEqual({ name: "Unu-Unu", languages: ["ro", "uk"] });
  expect(kept.songs.map((s) => s.id)).toEqual(["s1"]);
  expect(kept.songs[0]?.versions.map((v) => v.text)).toEqual([
    "1:\n.G\nHar minunat",
    "Дивна благодать",
  ]);
  expect(kept.playlists.map((p) => p.title)).toEqual(["Duminică"]);
  expect(JSON.stringify(kept)).not.toContain("Ana");
});
