import { beforeEach, describe, expect, test, vi } from "vitest";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import type { ServerMessage } from "../../shared/live.js";
import type { Song } from "./songs.js";
import type { Revision } from "./song-history.js";

let db: Db;

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro","uk"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01'),
      ('other', 'other-church', 'Other', '["ro"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
    INSERT INTO songs (id, community_id, key_signature, time_signature, tags, created_at, updated_at, deleted_at) VALUES
      ('song', 'c', 'G', '3/4', '["laudă"]', '2026-01-01', '2026-02-01', NULL),
      ('deleted', 'c', '', '', '[]', '2026-01-01', '2026-03-01', '2026-03-01'),
      ('elsewhere', 'other', '', '', '[]', '2026-01-01', '2026-01-01', NULL);
    INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at, deleted_at) VALUES
      ('v-uk', 'c', 'song', 'uk', 'Слава', 'Текст', '2026-01-02', '2026-01-02', NULL),
      ('v-ro', 'c', 'song', 'ro', 'Slavă', '1:\nText', '2026-01-01', '2026-02-01', NULL),
      ('v-en', 'c', 'song', 'en', 'Glory', 'Text', '2026-01-03', '2026-01-03', '2026-01-04'),
      ('v-deleted', 'c', 'deleted', 'ro', 'Șters', 'Text', '2026-01-01', '2026-01-01', NULL);
  `);
});

const get = (path: string) =>
  buildApp({ db, logger: false }).inject({ url: `/api/communities/${path}` });

test("anyone can read a song with its versions, oldest first", async () => {
  const response = await get("unu-unu/songs/song");

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({
    id: "song",
    keySignature: "G",
    timeSignature: "3/4",
    tags: ["laudă"],
    bpm: null,
    referenceLinks: [],
    authors: "",
    copyright: "",
    sourceUrl: null,
    suggestedBpm: null,
    updatedAt: "2026-02-01",
    deletedAt: null,
    excluded: null,
    // No chords: an empty track.
    music: { patterns: {}, sections: {}, parts: [] },
    versions: [
      {
        language: "ro",
        title: "Slavă",
        text: "1:\nText",
        lyrics: "1:\nText",
        updatedAt: "2026-02-01",
      },
      {
        language: "uk",
        title: "Слава",
        text: "Текст",
        lyrics: "Текст",
        updatedAt: "2026-01-02",
      },
    ],
  });
});

test("a deleted song can still be read, marked as deleted", async () => {
  const response = await get("unu-unu/songs/deleted");

  expect(response.json()).toMatchObject({ deletedAt: "2026-03-01" });
});

test("songs of other communities and unknown ids are not found", async () => {
  expect((await get("unu-unu/songs/elsewhere")).statusCode).toBe(404);
  expect((await get("unu-unu/songs/missing")).statusCode).toBe(404);
  expect((await get("missing/songs/song")).statusCode).toBe(404);
});

test("tags in use come most used first, without deleted songs", async () => {
  db.exec(`
    UPDATE songs SET tags = '["lauda","craciun"]' WHERE id = 'deleted';
    INSERT INTO songs (id, community_id, tags, created_at, updated_at) VALUES
      ('s2', 'c', '["craciun","paste"]', '2026-01-01', '2026-01-01'),
      ('s3', 'c', '["craciun"]', '2026-01-01', '2026-01-01');
  `);

  expect((await get("unu-unu/tags")).json()).toEqual([
    { tag: "craciun", count: 2 },
    { tag: "laudă", count: 1 },
    { tag: "paste", count: 1 },
  ]);
});

describe("changes", () => {
  const sessions: Record<string, string> = {};

  beforeEach(() => {
    db.exec(`
      INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
        ('editor', 'Ed', 'ed@example.com', 'active', '2026-01-01', '2026-01-01'),
        ('owner', 'Ow', 'ow@example.com', 'active', '2026-01-01', '2026-01-01'),
        ('team', 'Mu', 'mu@example.com', 'active', '2026-01-01', '2026-01-01'),
        ('stranger', 'St', 'st@example.com', 'active', '2026-01-01', '2026-01-01');
      INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
        ('m1', 'c', 'editor', '["editor"]', 'active', '2026-01-01', '2026-01-01'),
        ('m2', 'c', 'owner', '["owner"]', 'active', '2026-01-01', '2026-01-01'),
        ('m3', 'c', 'team', '["team"]', 'active', '2026-01-01', '2026-01-01');
    `);
    for (const user of ["editor", "owner", "team", "stranger"])
      sessions[user] = createSession(db, user);
  });

  const send = (
    as: string | null,
    method: "POST" | "PUT" | "DELETE",
    path: string,
    payload?: object,
  ) =>
    buildApp({ db, logger: false }).inject({
      method,
      url: `/api/communities/unu-unu/${path}`,
      headers: as ? { cookie: `__Host-session=${sessions[as]}` } : {},
      payload,
    });
  const newSong = {
    keySignature: "D",
    tags: ["Crăciun!", "craciun", ""],
    versions: [{ language: "ro", title: "Cântec nou", text: "1:\nVers" }],
  };

  test("credits: set by editors, kept when left out, restored with a revision", async () => {
    const credits = {
      authors: " Text: Ioan Bunaciu ",
      copyright: "© Editura Făclia",
      sourceUrl: "https://www.resursecrestine.ro/cantari/1",
    };
    const created = (
      await send("editor", "POST", "songs", { ...newSong, ...credits })
    ).json<Song>();
    expect(created).toMatchObject({
      ...credits,
      authors: "Text: Ioan Bunaciu",
    });
    expect(
      (
        await send("editor", "POST", "songs", {
          ...newSong,
          sourceUrl: "javascript:alert(1)",
        })
      ).statusCode,
    ).toBe(400);
    const base = created.versions.map((v) => ({ ...v, baseText: v.text }));
    // An app that doesn't send them keeps them.
    const kept = await send("editor", "PUT", `songs/${created.id}`, {
      versions: base,
    });
    expect(kept.json<Song>()).toMatchObject({
      copyright: "© Editura Făclia",
      sourceUrl: credits.sourceUrl,
    });
    const changed = await send("editor", "PUT", `songs/${created.id}`, {
      copyright: "",
      sourceUrl: "",
      versions: base,
    });
    expect(changed.json<Song>()).toMatchObject({
      copyright: "",
      sourceUrl: null,
    });
    const [last] = (
      await buildApp({ db, logger: false }).inject({
        url: `/api/communities/unu-unu/songs/${created.id}/revisions`,
        headers: { cookie: `__Host-session=${sessions.editor}` },
      })
    ).json<Revision[]>();
    expect(last).toMatchObject({ copyright: "© Editura Făclia" });
    const restored = await send(
      "editor",
      "POST",
      `songs/${created.id}/revisions/${last?.id}/restore`,
    );
    expect(restored.json<Song>().copyright).toBe("© Editura Făclia");
  });

  test("editors and owners create songs; others can't", async () => {
    expect((await send(null, "POST", "songs", newSong)).statusCode).toBe(401);
    expect((await send("stranger", "POST", "songs", newSong)).statusCode).toBe(
      403,
    );
    expect((await send("team", "POST", "songs", newSong)).statusCode).toBe(403);
    expect((await send("owner", "POST", "songs", newSong)).statusCode).toBe(
      201,
    );

    const response = await send("editor", "POST", "songs", newSong);
    expect(response.statusCode).toBe(201);
    const song = response.json<{ id: string; tags: string[] }>();
    expect(song.tags).toEqual(["craciun"]);
    expect(
      db
        .prepare("SELECT created_by, updated_by FROM songs WHERE id = ?")
        .get(song.id),
    ).toEqual({ created_by: "editor", updated_by: "editor" });
    const results = (await get(`unu-unu/search?q=cantec+nou`)).json<{
      results: { id?: string }[];
    }>().results;
    expect(results.map((r) => r.id)).toContain(song.id);
  });

  test("versions must be in the community's languages, once each", async () => {
    const version = { language: "en", title: "New", text: "" };
    expect(
      (await send("editor", "POST", "songs", { versions: [version] }))
        .statusCode,
    ).toBe(400);
    const ro = { language: "ro", title: "A", text: "" };
    expect(
      (await send("editor", "POST", "songs", { versions: [ro, ro] }))
        .statusCode,
    ).toBe(400);
  });

  test("saving the whole song adds a translation and keeps unchanged fields", async () => {
    const response = await send("editor", "PUT", "songs/song", {
      keySignature: "A",
      timeSignature: "3/4",
      tags: ["laudă"],
      versions: [
        {
          language: "ro",
          title: "Slavă",
          text: "1:\nText nou",
          baseText: "1:\nText",
        },
        { language: "uk", title: "Слава", text: "Текст", baseText: "Текст" },
      ],
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      keySignature: "A",
      tags: ["lauda"],
      versions: [
        { language: "ro", text: "1:\nText nou" },
        { language: "uk", text: "Текст" },
      ],
    });
  });

  test("a version someone else changed meanwhile isn't overwritten", async () => {
    const response = await send("editor", "PUT", "songs/song", {
      keySignature: "A",
      versions: [
        { language: "ro", title: "Slavă", text: "Mine", baseText: "Old" },
      ],
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      conflict: { language: "ro", theirs: "1:\nText", mine: "Mine" },
    });
    expect((await get("unu-unu/songs/song")).json()).toMatchObject({
      keySignature: "G",
    });
  });

  test("two editors saving different sections keep both changes", async () => {
    db.prepare("UPDATE song_versions SET lyrics = ? WHERE id = 'v-ro'").run(
      "1:\nVers unu\n\nR:\nRefren",
    );
    const section = (index: number, baseText: string, text: string) =>
      send("editor", "PUT", `songs/song/versions/ro/sections/${index}`, {
        baseText,
        text,
      });

    expect((await section(0, "1:\nVers unu", "1:\nVers 1")).statusCode).toBe(
      200,
    );
    const second = await section(1, "R:\nRefren", "R:\nRefren nou");
    expect(second.json<{ versions: object[] }>().versions[0]).toMatchObject({
      language: "ro",
      text: "1:\nVers 1\n\nR:\nRefren nou",
    });

    const conflict = await section(1, "R:\nRefren", "R:\nAlt refren");
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json()).toEqual({
      conflict: {
        language: "ro",
        theirs: "R:\nRefren nou",
        mine: "R:\nAlt refren",
      },
    });
  });

  test("every save keeps the song as it was, with who saved over it and when", async () => {
    const revisions = () =>
      db
        .prepare(
          "SELECT key_signature, tags, versions, created_by FROM song_revisions WHERE song_id = 'song' ORDER BY created_at, rowid",
        )
        .all()
        .map((r) => {
          const row = r as { versions: string; tags: string };
          return {
            ...row,
            tags: JSON.parse(row.tags) as unknown,
            versions: JSON.parse(row.versions) as unknown,
          };
        });

    await send("editor", "PUT", "songs/song", {
      keySignature: "A",
      versions: [
        {
          language: "ro",
          title: "Slavă",
          text: "1:\nText nou",
          baseText: "1:\nText",
        },
      ],
    });
    await send("owner", "PUT", "songs/song/versions/ro/sections/0", {
      baseText: "1:\nText nou",
      text: "1:\nText corectat",
    });
    // A save that conflicts changes nothing, so it keeps nothing.
    await send("editor", "PUT", "songs/song/versions/ro/sections/0", {
      baseText: "1:\nText",
      text: "1:\nAltceva",
    });

    expect(revisions()).toEqual([
      {
        key_signature: "G",
        tags: ["laudă"], // as the seed stored it
        versions: [
          { language: "ro", title: "Slavă", lyrics: "1:\nText" },
          { language: "uk", title: "Слава", lyrics: "Текст" },
        ],
        created_by: "editor",
      },
      {
        key_signature: "A",
        tags: [],
        versions: [
          { language: "ro", title: "Slavă", lyrics: "1:\nText nou" },
          { language: "uk", title: "Слава", lyrics: "Текст" },
        ],
        created_by: "owner",
      },
    ]);
  });

  test("deleting keeps the song readable, marked deleted, and out of search", async () => {
    expect((await send("team", "DELETE", "songs/song")).statusCode).toBe(403);
    expect((await send("editor", "DELETE", "songs/song")).statusCode).toBe(204);

    expect((await get("unu-unu/songs/song")).json()).toMatchObject({
      deletedAt: expect.any(String),
    });
    expect((await get("unu-unu/search?q=slava")).json()).toMatchObject({
      results: [{ type: "divider" }, { type: "new-song" }],
    });
    expect(
      (await send("editor", "PUT", "songs/song", { versions: [] })).statusCode,
    ).toBe(400);
    expect(
      (
        await send("editor", "PUT", "songs/song", {
          versions: [
            {
              language: "ro",
              title: "X",
              text: "1:\nText",
              baseText: "1:\nText",
            },
          ],
        })
      ).statusCode,
    ).toBe(404);
  });

  test("members see who created and last edited a song; visitors don't", async () => {
    const created = await send("owner", "POST", "songs", newSong);
    const id = created.json<{ id: string }>().id;
    await send("editor", "PUT", `songs/${id}/versions/ro/sections/0`, {
      baseText: "1:\nVers",
      text: "1:\nVers nou",
    });

    const asMember = await buildApp({ db, logger: false }).inject({
      url: `/api/communities/unu-unu/songs/${id}`,
      headers: { cookie: `__Host-session=${sessions.team}` },
    });
    expect(asMember.json()).toMatchObject({
      people: {
        createdBy: { name: "Ow", avatar: null },
        updatedBy: { name: "Ed", avatar: null },
      },
    });
    expect((await get(`unu-unu/songs/${id}`)).json()).not.toHaveProperty(
      "people",
    );
    const asStranger = await buildApp({ db, logger: false }).inject({
      url: `/api/communities/unu-unu/songs/${id}`,
      headers: { cookie: `__Host-session=${sessions.stranger}` },
    });
    expect(asStranger.json()).not.toHaveProperty("people");
  });

  test("saved songs go live to everyone following them", async () => {
    const app = buildApp({ db, logger: false });
    const address = await app.listen({ port: 0, host: "127.0.0.1" });
    const ws = new WebSocket(`${address.replace("http", "ws")}/api/live`);
    const events: ServerMessage[] = [];
    ws.addEventListener("message", (e) =>
      events.push(JSON.parse(String(e.data)) as ServerMessage),
    );
    await new Promise((resolve) => ws.addEventListener("open", resolve));
    ws.send(JSON.stringify({ type: "subscribe", topic: "song:song" }));

    // Keep saving until the subscription has arrived.
    await vi.waitFor(async () => {
      await app.inject({
        method: "PUT",
        url: "/api/communities/unu-unu/songs/song/versions/ro/sections/0",
        headers: { cookie: `__Host-session=${sessions.editor}` },
        payload: { baseText: "1:\nText", text: "1:\nText" },
      });
      expect(events).toContainEqual(
        expect.objectContaining({ type: "event", topic: "song:song" }),
      );
    });
    ws.close();
    await app.close();
  });
});
