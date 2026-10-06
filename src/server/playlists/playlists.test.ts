import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ServerMessage } from "../../shared/live.js";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import {
  createPlaylist,
  freeService,
  getPlaylist,
  leaderOf,
  type Playlist,
} from "./playlists.js";
import { moveEntry } from "./entries.js";

let db: Db;
let sessions: Record<string, string>;

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro","uk"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01'),
      ('other', 'other-church', 'Other', '["ro"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('team', 'Ioana', 'ioana@example.com', 'active', '2026-01-01', '2026-01-01'),
      ('editor', 'Ed', 'ed@example.com', 'active', '2026-01-01', '2026-01-01');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m1', 'c', 'team', '["team"]', 'active', '2026-01-01', '2026-01-01'),
      ('m2', 'c', 'editor', '["editor"]', 'active', '2026-01-01', '2026-01-01');
    INSERT INTO songs (id, community_id, key_signature, time_signature, tags, created_at, updated_at, deleted_at) VALUES
      ('song', 'c', 'G', '3/4', '["laudă"]', '2026-01-01', '2026-01-01', NULL),
      ('gone', 'c', '', '', '[]', '2026-01-01', '2026-01-01', '2026-03-01'),
      ('elsewhere', 'other', '', '', '[]', '2026-01-01', '2026-01-01', NULL);
    INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
      ('v-ro', 'c', 'song', 'ro', 'Slavă', '1:\nText', '2026-01-01', '2026-01-01'),
      ('v-uk', 'c', 'song', 'uk', 'Слава', 'Текст', '2026-01-01', '2026-01-01'),
      ('v-gone', 'c', 'gone', 'ro', 'Ștearsă', 'Text', '2026-01-01', '2026-01-01');
  `);
  sessions = {
    team: createSession(db, "team"),
    editor: createSession(db, "editor"),
  };
});

const call = (
  as: string | null,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  path: string,
  payload?: object,
) =>
  buildApp({ db, logger: false }).inject({
    method,
    url: `/api/communities/unu-unu/playlists${path}`,
    headers: as ? { cookie: `__Host-session=${sessions[as]}` } : {},
    payload,
  });

async function newPlaylist(title = "30 septembrie 2026") {
  const response = await call("team", "POST", "", { title });
  expect(response.statusCode).toBe(201);
  return response.json<{ id: string }>().id;
}
async function add(playlist: string, entry: object) {
  const response = await call("team", "POST", `/${playlist}/entries`, entry);
  expect(response.statusCode).toBe(201);
  return response.json<{ id: string }>().id;
}
const order = (playlist: string) =>
  getPlaylist(db, "c", playlist)?.entries.map((e) => e.text ?? e.kind);

describe("playlists", () => {
  test("two playlists may share a title, and the list is newest first", async () => {
    const first = await newPlaylist();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await newPlaylist();

    const list = (await call(null, "GET", "")).json<{
      playlists: { id: string; title: string }[];
      more: boolean;
      next: string | null;
    }>();
    expect(list.playlists.map((p) => p.id)).toEqual([second, first]);
    // Without a schedule, no service's playlist: the home opens the newest.
    expect(list.next).toBeNull();
    expect(list.playlists[0]?.title).toBe("30 septembrie 2026");
    expect(list.more).toBe(false);

    const page = (await call(null, "GET", "?limit=1")).json<{
      playlists: { id: string }[];
      more: boolean;
    }>();
    expect(page.playlists.map((p) => p.id)).toEqual([second]);
    expect(page.more).toBe(true);
  });

  test("members see who created each playlist; visitors don't", async () => {
    await newPlaylist();
    const by = async (as: string | null) =>
      (await call(as, "GET", "")).json<{
        playlists: { createdBy?: string }[];
      }>().playlists[0]?.createdBy;
    expect(await by("editor")).toBe("Ioana");
    expect(await by(null)).toBeUndefined();
  });

  test("a playlist is renamed, archived, read and restored", async () => {
    const id = await newPlaylist();
    expect(
      (await call("team", "PATCH", `/${id}`, { title: " Seara " })).statusCode,
    ).toBe(204);
    expect((await call(null, "GET", `/${id}`)).json()).toMatchObject({
      title: "Seara",
    });
    // An empty title leaves the date alone.
    expect(
      (await call("team", "PATCH", `/${id}`, { title: "  " })).statusCode,
    ).toBe(204);
    expect((await call(null, "GET", `/${id}`)).json()).toMatchObject({
      title: null,
    });
    await call("team", "PATCH", `/${id}`, { title: "Seara" });

    const archive = (archived: boolean) =>
      call("team", "PUT", `/${id}/archived`, { archived });
    const listed = async (query = "") =>
      (await call(null, "GET", query)).json<{ playlists: { id: string }[] }>()
        .playlists;
    expect((await archive(true)).statusCode).toBe(204);
    // Still readable by its link, listed only among the archived, and not changed.
    expect((await call(null, "GET", `/${id}`)).json()).toMatchObject({
      title: "Seara",
      archivedAt: expect.any(String),
    });
    expect(await listed()).toEqual([]);
    expect(await listed("?archived=true")).toEqual([
      expect.objectContaining({ id }),
    ]);
    expect(
      (await call("team", "PATCH", `/${id}`, { title: "Alta" })).statusCode,
    ).toBe(404);
    expect(
      (
        await call("team", "POST", `/${id}/entries`, {
          kind: "divider",
          text: "x",
        })
      ).statusCode,
    ).toBe(404);

    expect((await archive(false)).statusCode).toBe(204);
    expect(await listed()).toEqual([expect.objectContaining({ id })]);
    expect((await call(null, "GET", `/${id}`)).json()).toMatchObject({
      archivedAt: null,
    });
  });

  test("only the team changes playlists", async () => {
    expect((await call(null, "POST", "", { title: "x" })).statusCode).toBe(401);
    expect((await call("editor", "POST", "", { title: "x" })).statusCode).toBe(
      403,
    );
  });
});

describe("entries", () => {
  test("each kind of entry, in the order added, with what the playlist shows", async () => {
    const id = await newPlaylist();
    await add(id, { kind: "song", songId: "song" });
    await add(id, {
      kind: "bible",
      bible: { book: 43, chapter: 3, from: 16, to: 18 },
    });
    await add(id, { kind: "divider", text: " Predica ", plannedMinutes: 45 });
    await add(id, { kind: "text", text: "# Anunțuri\nDuminică la 10:00" });
    await add(id, { kind: "song", songId: "gone" });

    const playlist = (await call(null, "GET", `/${id}`)).json<{
      entries: Record<string, unknown>[];
    }>();
    expect(playlist.entries).toMatchObject([
      {
        kind: "song",
        song: {
          id: "song",
          titles: { ro: "Slavă", uk: "Слава" },
          keySignature: "G",
          timeSignature: "3/4",
          tags: ["laudă"],
          deleted: false,
          playedRecently: false,
        },
      },
      { kind: "bible", bible: { book: 43, chapter: 3, from: 16, to: 18 } },
      { kind: "divider", text: "Predica", plannedMinutes: 45 },
      {
        kind: "text",
        text: "# Anunțuri\nDuminică la 10:00",
        plannedMinutes: null,
      },
      { kind: "song", song: { id: "gone", deleted: true } },
    ]);
    // Visitors see no names.
    expect(playlist.entries[0]).not.toHaveProperty("addedBy");
  });

  test("members see who added each entry", async () => {
    const id = await newPlaylist();
    await add(id, { kind: "divider", text: "Rugăciune" });
    const asMember = (await call("editor", "GET", `/${id}`)).json<{
      entries: { addedBy: string }[];
    }>();
    expect(asMember.entries[0]?.addedBy).toBe("Ioana");
  });

  test("a song played in the last hour is marked", async () => {
    const id = await newPlaylist();
    await add(id, { kind: "song", songId: "song" });
    const play = (minutesAgo: number) =>
      db
        .prepare(
          "INSERT INTO plays (id, community_id, song_id, mode, played_at, created_at, updated_at) VALUES (?, 'c', 'song', 'service', ?, ?, ?)",
        )
        .run(
          `p${minutesAgo}`,
          new Date(Date.now() - minutesAgo * 60_000).toISOString(),
          "2026-01-01",
          "2026-01-01",
        );
    const recently = () =>
      getPlaylist(db, "c", id)?.entries[0]?.song?.playedRecently;

    play(90);
    expect(recently()).toBe(false);
    play(20);
    expect(recently()).toBe(true);
  });

  test("invalid entries are refused", async () => {
    const id = await newPlaylist();
    const refused = async (entry: object) =>
      expect(
        (await call("team", "POST", `/${id}/entries`, entry)).statusCode,
      ).toBe(400);
    await refused({ kind: "song", songId: "elsewhere" });
    await refused({ kind: "song" });
    await refused({
      kind: "bible",
      bible: { book: 19, chapter: 23, from: 1, to: 7 },
    });
    await refused({ kind: "divider", text: "  " });
    await refused({ kind: "divider", text: "Predica", plannedMinutes: 241 });
    expect(
      (
        await call("team", "POST", "/missing/entries", {
          kind: "divider",
          text: "x",
        })
      ).statusCode,
    ).toBe(404);
  });

  test("a song added twice stays when the other copy is removed", async () => {
    const id = await newPlaylist();
    const first = await add(id, { kind: "song", songId: "song" });
    await add(id, { kind: "song", songId: "song" });

    expect(
      (await call("team", "DELETE", `/${id}/entries/${first}`)).statusCode,
    ).toBe(204);
    expect(getPlaylist(db, "c", id)?.entries).toHaveLength(1);
    expect(
      (await call("team", "DELETE", `/${id}/entries/${first}`)).statusCode,
    ).toBe(404);
  });

  test("a divider's text and planned minutes change, a song's don't", async () => {
    const id = await newPlaylist();
    const divider = await add(id, { kind: "divider", text: "Predica" });
    const song = await add(id, { kind: "song", songId: "song" });

    expect(
      (
        await call("team", "PATCH", `/${id}/entries/${divider}`, {
          text: "Predica de azi",
          plannedMinutes: 40,
        })
      ).statusCode,
    ).toBe(204);
    expect(getPlaylist(db, "c", id)?.entries[0]).toMatchObject({
      text: "Predica de azi",
      plannedMinutes: 40,
    });
    await call("team", "PATCH", `/${id}/entries/${divider}`, {
      plannedMinutes: null,
    });
    expect(getPlaylist(db, "c", id)?.entries[0]?.plannedMinutes).toBeNull();

    expect(
      (
        await call("team", "PATCH", `/${id}/entries/${song}`, {
          plannedMinutes: 5,
        })
      ).statusCode,
    ).toBe(400);
  });

  test("entries move or are added after another one, or to the top", async () => {
    const id = await newPlaylist();
    const [a, b, c] = [
      await add(id, { kind: "divider", text: "a" }),
      await add(id, { kind: "divider", text: "b" }),
      await add(id, { kind: "divider", text: "c" }),
    ];
    const move = (entry: string, after: string | null) =>
      call("team", "POST", `/${id}/entries/${entry}/move`, { after });

    expect((await move(c, a)).statusCode).toBe(204);
    expect(order(id)).toEqual(["a", "c", "b"]);
    await move(b, null);
    expect(order(id)).toEqual(["b", "a", "c"]);
    await move(b, c);
    expect(order(id)).toEqual(["a", "c", "b"]);
    expect((await move(a, a)).statusCode).toBe(404);
    expect((await move(a, "missing")).statusCode).toBe(404);
    // Added in place.
    await add(id, { kind: "divider", text: "d", after: a });
    await add(id, { kind: "text", text: "e", after: null });
    expect(order(id)).toEqual(["e", "a", "d", "c", "b"]);
  });

  test("moving into the same gap again and again renumbers the playlist", () => {
    db.exec(`
      INSERT INTO playlists (id, community_id, title, created_at, updated_at) VALUES ('p', 'c', 'P', '2026-01-01', '2026-01-01');
      INSERT INTO entries (id, community_id, playlist_id, position, kind, text, created_at, updated_at) VALUES
        ('a', 'c', 'p', 1, 'divider', 'a', '2026-01-01', '2026-01-01'),
        ('b', 'c', 'p', 2, 'divider', 'b', '2026-01-01', '2026-01-01'),
        ('x', 'c', 'p', 3, 'divider', 'x', '2026-01-01', '2026-01-01'),
        ('y', 'c', 'p', 4, 'divider', 'y', '2026-01-01', '2026-01-01');
    `);
    const who = { communityId: "c", userId: "team" };
    // x and y take turns going between a and whatever follows it.
    for (let i = 0; i < 80; i++)
      moveEntry(db, "p", i % 2 ? "y" : "x", "a", who);
    expect(order("p")).toEqual(["a", "y", "x", "b"]);
    const positions = db
      .prepare(
        "SELECT position FROM entries WHERE playlist_id = 'p' ORDER BY position",
      )
      .pluck()
      .all() as number[];
    expect(new Set(positions).size).toBe(4);
  });

  test("changes go out to everyone following the playlist", async () => {
    const id = await newPlaylist();
    const app = buildApp({ db, logger: false });
    const address = await app.listen({ port: 0, host: "127.0.0.1" });
    const ws = new WebSocket(`${address.replace("http", "ws")}/api/live`);
    const events: ServerMessage[] = [];
    ws.addEventListener("message", (e) =>
      events.push(JSON.parse(String(e.data)) as ServerMessage),
    );
    await new Promise((resolve) => ws.addEventListener("open", resolve));
    ws.send(JSON.stringify({ type: "subscribe", topic: `playlist:${id}` }));

    // Keep adding until the subscription has arrived.
    await vi.waitFor(async () => {
      await app.inject({
        method: "POST",
        url: `/api/communities/unu-unu/playlists/${id}/entries`,
        headers: { cookie: `__Host-session=${sessions.team}` },
        payload: { kind: "divider", text: "Nou" },
      });
      expect(events).toContainEqual(
        expect.objectContaining({ type: "event", topic: `playlist:${id}` }),
      );
    });
    ws.close();
    await app.close();
  });
});

test("a removed entry comes back in its place with Undo; only the team can", async () => {
  const id = await newPlaylist();
  for (const text of ["Unu", "Doi", "Trei"])
    await add(id, { kind: "divider", text });
  const doi = getPlaylist(db, "c", id)?.entries[1]?.id;
  expect(
    (await call("team", "DELETE", `/${id}/entries/${doi}`)).statusCode,
  ).toBe(204);
  expect(order(id)).toEqual(["Unu", "Trei"]);
  expect(
    (await call("editor", "POST", `/${id}/entries/${doi}/restore`)).statusCode,
  ).toBe(403);
  expect(
    (await call("team", "POST", `/${id}/entries/${doi}/restore`)).statusCode,
  ).toBe(204);
  expect(order(id)).toEqual(["Unu", "Doi", "Trei"]);
  // Only a removed entry comes back.
  expect(
    (await call("team", "POST", `/${id}/entries/${doi}/restore`)).statusCode,
  ).toBe(404);
});

test("the list finds playlists by any part of their title, in any case", async () => {
  for (const title of [
    "Crăciun 2025",
    "Duminică",
    "Seara de crăciun",
    "50% off_",
  ])
    await newPlaylist(title);
  const titles = async (q: string) =>
    (await call(null, "GET", `?q=${encodeURIComponent(q)}`))
      .json<{ playlists: { title: string }[] }>()
      .playlists.map((p) => p.title);
  expect(await titles("crăciun")).toEqual(["Seara de crăciun", "Crăciun 2025"]);
  expect(await titles("%")).toEqual(["50% off_"]);
  expect(await titles("_")).toEqual(["50% off_"]);
  expect(await titles("nimic")).toEqual([]);
});

test("a playlist without a title is named by its date, found in any language", async () => {
  const response = await call("team", "POST", "", {});
  expect(response.statusCode).toBe(201);
  const { id, title, date } = response.json<{
    id: string;
    title: string | null;
    date: string;
  }>();
  expect(title).toBeNull();
  expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  const month = (language: string) =>
    new Intl.DateTimeFormat(language, { month: "long", timeZone: "UTC" })
      .format(new Date(`${date}T12:00:00Z`))
      .toLocaleUpperCase();
  for (const q of [month("ro"), month("en"), date.slice(0, 4)])
    expect(
      (await call(null, "GET", `?q=${encodeURIComponent(q)}`))
        .json<{ playlists: { id: string }[] }>()
        .playlists.map((p) => p.id),
    ).toContain(id);
});

test("the team writes host's words per language on any entry; members read them", async () => {
  const playlist = await newPlaylist();
  const divider = await add(playlist, { kind: "divider", text: "Colecta" });
  const words = {
    ro: " Acum strângem darurile ",
    uk: "Зараз збираємо пожертви",
    en: "",
  };
  expect(
    (
      await call("editor", "PATCH", `/${playlist}/entries/${divider}`, {
        hostWords: words,
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await call("team", "PATCH", `/${playlist}/entries/${divider}`, {
        hostWords: { de: "Jetzt" },
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await call("team", "PATCH", `/${playlist}/entries/${divider}`, {
        hostWords: words,
      })
    ).statusCode,
  ).toBe(204);
  const read = async (as: string | null) =>
    (await call(as, "GET", `/${playlist}`)).json<Playlist>().entries[0]
      ?.hostWords;
  expect(await read("editor")).toEqual({
    ro: "Acum strângem darurile",
    uk: "Зараз збираємо пожертви",
  });
  // Visitors don't get them; emptied, they go.
  expect(await read(null)).toBeUndefined();
  await call("team", "PATCH", `/${playlist}/entries/${divider}`, {
    hostWords: { ro: " ", uk: "" },
  });
  expect(await read("team")).toBeUndefined();
});

test("led by: the service's worship lead leads each song, unless the team chose a vocalist", async () => {
  db.exec(`
    INSERT INTO schedule_events (id, community_id, name, type, kind, weekday, start_time, end_time, created_at, updated_at) VALUES
      ('sun', 'c', 'Duminică', 'service', 'recurring', 7, '10:00', '12:00', 'x', 'x');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('ana', 'Ana', 'ana@example.com', 'active', 'x', 'x'),
      ('vlad', 'Vlad', 'vlad@example.com', 'active', 'x', 'x'),
      ('out', 'Out', 'out@example.com', 'active', 'x', 'x');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m-ana', 'c', 'ana', '[]', 'active', 'x', 'x'),
      ('m-vlad', 'c', 'vlad', '[]', 'active', 'x', 'x');
    INSERT INTO service_roles (id, community_id, name, instrument, leads, position, created_at, updated_at) VALUES
      ('lead', 'c', 'Lider de laudă', NULL, 1, 0, 'x', 'x'),
      ('voc', 'c', 'Voce', 'vocals', 0, 1, 'x', 'x');
    INSERT INTO slots (id, community_id, event_id, date, role_id, user_id, status, position, created_at, updated_at) VALUES
      ('s1', 'c', 'sun', '2026-10-11', 'lead', 'ana', 'accepted', 0, 'x', 'x'),
      ('s2', 'c', 'sun', '2026-10-11', 'voc', 'vlad', 'asked', 0, 'x', 'x');
  `);
  // A playlist made on Tuesday plans Sunday's service; the next one, the Sunday after.
  const tuesday = new Date("2026-10-06T10:00:00Z");
  expect(freeService(db, "c", tuesday)).toEqual({
    eventId: "sun",
    date: "2026-10-11",
  });
  const { id } = createPlaylist(db, "11 octombrie 2026", {
    communityId: "c",
    userId: "team",
    now: tuesday,
  });
  expect(freeService(db, "c", tuesday)?.date).toBe("2026-10-18");

  const entry = await add(id, { kind: "song", songId: "song" });
  let playlist = (await call("team", "GET", `/${id}`)).json<Playlist>();
  expect(playlist.leads).toEqual({
    lead: { id: "ana", name: "Ana" },
    people: [
      { id: "ana", name: "Ana" },
      { id: "vlad", name: "Vlad" },
    ],
  });
  expect(playlist.entries[0]?.ledBy).toBeNull();
  expect(leaderOf(db, "c", entry)).toBe("ana");

  // Vlad takes this song; someone outside the community can't.
  const lead = (ledBy: string | null) =>
    call("team", "PATCH", `/${id}/entries/${entry}`, { ledBy });
  expect((await lead("out")).statusCode).toBe(400);
  expect((await lead("vlad")).statusCode).toBe(204);
  playlist = (await call("team", "GET", `/${id}`)).json<Playlist>();
  expect(playlist.entries[0]?.ledBy).toEqual({ id: "vlad", name: "Vlad" });
  expect(leaderOf(db, "c", entry)).toBe("vlad");
  // Visitors don't see who leads.
  expect(
    (await call(null, "GET", `/${id}`)).json<Playlist>().entries[0],
  ).not.toHaveProperty("ledBy");
  expect((await lead(null)).statusCode).toBe(204);
  expect(leaderOf(db, "c", entry)).toBe("ana");
});
