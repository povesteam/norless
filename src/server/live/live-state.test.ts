import { musicOfTexts, noMusic } from "../../shared/music/chord-track.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { LiveAction, ServerMessage } from "../../shared/live.js";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import { WebSocket as WsClient } from "ws";
import type { FollowView, LiveView } from "./live-view.js";

let db: Db;
let sessions: Record<string, string>;
let app: ReturnType<typeof buildApp>;

// A Sunday morning in Bucharest (UTC+3), in the scheduled service.
const SUNDAY = new Date("2026-10-04T07:30:00Z");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(SUNDAY);
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro","uk"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('ioana', 'Ioana', 'ioana@example.com', 'active', '2026-01-01', '2026-01-01'),
      ('ed', 'Ed', 'ed@example.com', 'active', '2026-01-01', '2026-01-01');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m1', 'c', 'ioana', '["team"]', 'active', '2026-01-01', '2026-01-01'),
      ('m2', 'c', 'ed', '["editor"]', 'active', '2026-01-01', '2026-01-01');
    INSERT INTO schedule_events (id, community_id, name, type, kind, weekday, start_time, end_time, created_at, updated_at) VALUES
      ('sunday', 'c', 'Serviciu', 'service', 'recurring', 7, '10:00', '12:00', '2026-01-01', '2026-01-01');
    INSERT INTO songs (id, community_id, tags, created_at, updated_at, deleted_at) VALUES
      ('s1', 'c', '[]', '2026-01-01', '2026-01-01', NULL),
      ('s2', 'c', '[]', '2026-01-01', '2026-01-01', NULL),
      ('gone', 'c', '[]', '2026-01-01', '2026-01-01', '2026-02-01');
    INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
      ('s1-ro', 'c', 's1', 'ro', 'Unu', '1:\nA\n\n2:\nB\n\nR:\nC', '2026-01-01', '2026-01-01'),
      ('s1-uk', 'c', 's1', 'uk', 'Один', '1:\nА\n\n2:\nБ', '2026-01-01', '2026-01-01'),
      ('s2-ro', 'c', 's2', 'ro', 'Doi', 'Doar unul', '2026-01-01', '2026-01-01'),
      ('gone-ro', 'c', 'gone', 'ro', 'Ștearsă', 'X', '2026-01-01', '2026-01-01');
    INSERT INTO playlists (id, community_id, title, created_at, updated_at) VALUES
      ('p', 'c', 'Duminică', '2026-10-04', '2026-10-04'),
      ('q', 'c', 'Seara', '2026-10-04', '2026-10-04');
    INSERT INTO entries (id, community_id, playlist_id, position, kind, song_id, bible_book, bible_chapter, bible_verse_from, bible_verse_to, text, created_at, updated_at) VALUES
      ('start', 'c', 'p', 1, 'divider', NULL, NULL, NULL, NULL, NULL, 'Început', 'x', 'x'),
      ('e1', 'c', 'p', 2, 'song', 's1', NULL, NULL, NULL, NULL, NULL, 'x', 'x'),
      ('mid', 'c', 'p', 3, 'divider', NULL, NULL, NULL, NULL, NULL, 'Laudă', 'x', 'x'),
      ('e2', 'c', 'p', 4, 'song', 's2', NULL, NULL, NULL, NULL, NULL, 'x', 'x'),
      ('john', 'c', 'p', 5, 'bible', NULL, 43, 3, 16, 18, NULL, 'x', 'x'),
      ('deleted', 'c', 'p', 6, 'song', 'gone', NULL, NULL, NULL, NULL, NULL, 'x', 'x'),
      ('other', 'c', 'q', 1, 'song', 's2', NULL, NULL, NULL, NULL, NULL, 'x', 'x');
  `);
  sessions = { ioana: createSession(db, "ioana"), ed: createSession(db, "ed") };
  app = buildApp({ db, logger: false });
});

afterEach(() => vi.useRealTimers());

async function act(action: LiveAction, as: string | null = "ioana") {
  const response = await app.inject({
    method: "POST",
    url: "/api/communities/unu-unu/live",
    headers: {
      ...(as ? { cookie: `__Host-session=${sessions[as]}` } : {}),
      "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0) Mobile/15E148",
    },
    payload: action,
  });
  return { status: response.statusCode, view: response.json<LiveView>() };
}
const where = (view: LiveView) => `${view.entryId}:${view.slide}`;
const later = (seconds: number) =>
  vi.setSystemTime(new Date(Date.now() + seconds * 1000));

describe("controlling", () => {
  test("the team sends an entry live; everyone sees it, with who did it", async () => {
    const { status, view } = await act({ type: "go", entryId: "e1", slide: 1 });
    expect(status).toBe(200);
    expect(view).toMatchObject({
      playlistId: "p",
      entryId: "e1",
      slide: 1,
      slides: 3, // in Romanian, the community's first language
      blank: false,
      mode: "service",
      changedBy: { userId: "ioana", name: "Ioana", device: "phone" },
      entry: { kind: "song" },
      song: { id: "s1" },
    });
    const visitor = await app.inject({ url: "/api/communities/unu-unu/live" });
    expect(where(visitor.json())).toBe("e1:1");

    expect((await act({ type: "next" }, "ed")).status).toBe(403);
    expect((await act({ type: "next" }, null)).status).toBe(401);
  });

  test("dividers and deleted songs don't go live", async () => {
    await act({ type: "go", entryId: "e1" });
    expect(where((await act({ type: "go", entryId: "mid" })).view)).toBe(
      "e1:0",
    );
    expect(where((await act({ type: "go", entryId: "deleted" })).view)).toBe(
      "e1:0",
    );
  });

  test("next and previous go through slides and skip what can't go live", async () => {
    await act({ type: "go", entryId: "e1" });
    const steps: string[] = [];
    for (let i = 0; i < 5; i++)
      steps.push(where((await act({ type: "next" })).view));
    // The deleted song after the Bible reference is skipped, and the end stays.
    expect(steps).toEqual(["e1:1", "e1:2", "e2:0", "john:0", "john:0"]);

    await act({ type: "previous" });
    expect(where((await act({ type: "previous" })).view)).toBe("e1:2");
  });

  test("two presses of next from the same slide go one slide on, not two", async () => {
    await act({ type: "go", entryId: "e1" });
    const from = { entryId: "e1", slide: 0 };
    expect(where((await act({ type: "next", from })).view)).toBe("e1:1");
    // The second operator's press, sent before the first's change reached them.
    expect(where((await act({ type: "next", from })).view)).toBe("e1:1");
    // From where the device last saw it, even across entries.
    expect(
      where(
        (await act({ type: "next", from: { entryId: "e1", slide: 2 } })).view,
      ),
    ).toBe("e2:0");
  });

  test("blank keeps the position, and next ends it", async () => {
    await act({ type: "go", entryId: "e1", slide: 1 });
    expect((await act({ type: "blank", blank: true })).view).toMatchObject({
      blank: true,
      slide: 1,
    });
    expect((await act({ type: "next" })).view).toMatchObject({
      blank: false,
      slide: 2,
    });
  });
});

describe("timed dividers and messages", () => {
  test("a divider with planned minutes goes live as a timed pause; others are skipped", async () => {
    db.prepare(
      "UPDATE entries SET planned_minutes = 45, text = 'Predica' WHERE id = 'mid'",
    ).run();
    await act({ type: "go", entryId: "e1", slide: 2 });
    const { view } = await act({ type: "next" });
    expect(view).toMatchObject({
      entryId: "mid",
      entry: { kind: "divider", plannedMinutes: 45 },
      next: { id: "e2" },
    });
    expect(where((await act({ type: "next" })).view)).toBe("e2:0");
  });

  test("the live view names the next entry, and a message stays until cleared", async () => {
    expect((await act({ type: "go", entryId: "e1" })).view.next?.id).toBe("e2");
    expect(
      (await act({ type: "message", text: " refrain once more " })).view
        .message,
    ).toBe("refrain once more");
    expect((await act({ type: "next" })).view.message).toBe(
      "refrain once more",
    );
    expect(
      (await act({ type: "message", text: null })).view.message,
    ).toBeNull();
  });
});

describe("mode", () => {
  test("comes from the schedule, and can't be set by hand", async () => {
    expect((await act({ type: "go", entryId: "e1" })).view.mode).toBe(
      "service",
    );
    expect(
      (await act({ type: "mode", mode: "rehearsal" } as unknown as LiveAction))
        .status,
    ).toBe(400);
    expect((await act({ type: "go", entryId: "e2" })).view.mode).toBe(
      "service",
    );

    // After the service (12:00 + 30 minutes), the schedule says rehearsal.
    later(3 * 3600);
    expect((await act({ type: "go", entryId: "e1" })).view.mode).toBe(
      "rehearsal",
    );
  });
});

describe("plays", () => {
  const plays = () =>
    db
      .prepare(
        "SELECT song_id, playlist_id, mode, played_at, ended_at FROM plays ORDER BY played_at",
      )
      .all();

  test("a song live for 30 seconds or more is recorded when it's replaced", async () => {
    await act({ type: "go", entryId: "e1" });
    later(25);
    await act({ type: "go", entryId: "e2" }); // e1 only 25 seconds: not a play
    later(30);
    await act({ type: "go", entryId: "e1" });
    later(60);
    await act({ type: "next" }); // a slide of the same song: not a new play
    later(60);
    await act({ type: "go", entryId: "john" });

    expect(plays()).toEqual([
      {
        song_id: "s2",
        playlist_id: "p",
        mode: "service",
        played_at: "2026-10-04T07:30:25.000Z",
        ended_at: "2026-10-04T07:30:55.000Z",
      },
      {
        song_id: "s1",
        playlist_id: "p",
        mode: "service",
        played_at: "2026-10-04T07:30:55.000Z",
        ended_at: "2026-10-04T07:32:55.000Z",
      },
    ]);
  });
});

test("the live state comes back after a restart", async () => {
  await act({ type: "go", entryId: "e1", slide: 2 });
  const restarted = buildApp({ db, logger: false });
  const view = (
    await restarted.inject({ url: "/api/communities/unu-unu/live" })
  ).json<LiveView>();
  expect(where(view)).toBe("e1:2");
});

test("changes go out to everyone following the room, with names only to members", async () => {
  vi.useRealTimers();
  const address = await app.listen({ port: 0, host: "127.0.0.1" });
  const url = `${address.replace("http", "ws")}/api/live`;
  const follow = (topic: string, cookie?: string) =>
    new Promise<{ ws: WsClient; events: ServerMessage[] }>((resolve) => {
      const ws = new WsClient(url, cookie ? { headers: { cookie } } : {});
      const events: ServerMessage[] = [];
      ws.on("message", (data) =>
        events.push(JSON.parse(String(data)) as ServerMessage),
      );
      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "subscribe", topic }));
        resolve({ ws, events });
      });
    });
  const last = <T>(f: { events: ServerMessage[] }) =>
    f.events.filter((e) => e.type === "event").at(-1)?.data as T | undefined;
  const visitor = await follow("live:unu-unu");
  const everyone = await follow("live-public:unu-unu");
  const member = await follow(
    "live:unu-unu",
    `__Host-session=${sessions.ioana}`,
  );
  const phone = await follow("follow:unu-unu");
  // The current state arrives first.
  await vi.waitFor(() => {
    expect(last<LiveView>(member)?.entryId).toBeNull();
    expect(last<LiveView>(everyone)?.entryId).toBeNull();
    expect(last<FollowView>(phone)?.entryId).toBeNull();
  });

  await act({ type: "go", entryId: "e2" });
  await vi.waitFor(() => {
    expect(last<LiveView>(member)?.changedBy?.name).toBe("Ioana");
    expect(last<LiveView>(everyone)).toMatchObject({
      entryId: "e2",
      changedBy: null,
    });
    expect(last<FollowView>(phone)).toEqual({
      entryId: "e2",
      slide: 0,
      blank: false,
      page: false,
      verse: null,
      entry: {
        kind: "song",
        bible: null,
        songId: "s2",
        songUpdatedAt: "2026-01-01",
        title: { ro: "Doi" },
        slides: null,
        text: null,
      },
      next: null,
    });
  });
  // A visitor can't follow the room with names.
  expect(visitor.events.filter((e) => e.type === "event")).toEqual([]);
  for (const f of [visitor, everyone, member, phone]) f.ws.close();
  await app.close();
});

test("a visitor asking for the live state gets it without names", async () => {
  await act({ type: "go", entryId: "e1" });
  const asVisitor = await app.inject({ url: "/api/communities/unu-unu/live" });
  expect(asVisitor.json<LiveView>()).toMatchObject({
    entryId: "e1",
    changedBy: null,
  });
  const asMember = await app.inject({
    url: "/api/communities/unu-unu/live",
    headers: { cookie: `__Host-session=${sessions.ed}` },
  });
  expect(asMember.json<LiveView>().changedBy?.name).toBe("Ioana");
});

test("a new service key or new chords for the live song reach the live view at once", async () => {
  await act({ type: "go", entryId: "e1" });
  const address = await app.listen({ port: 0, host: "127.0.0.1" });
  const ws = new WebSocket(`${address.replace("http", "ws")}/api/live`);
  const views: LiveView[] = [];
  ws.addEventListener("message", (e) => {
    const message = JSON.parse(String(e.data)) as ServerMessage;
    if (message.type === "event" && message.topic === "live-public:unu-unu")
      views.push(message.data as LiveView);
  });
  await new Promise((resolve) => ws.addEventListener("open", resolve));
  ws.send(JSON.stringify({ type: "subscribe", topic: "live-public:unu-unu" }));
  await vi.waitFor(() => expect(views).toHaveLength(1));
  const as = { cookie: `__Host-session=${sessions.ioana}` };

  await app.inject({
    method: "PATCH",
    url: "/api/communities/unu-unu/playlists/p/entries/e1",
    headers: as,
    payload: { keySignature: "D" },
  });
  await vi.waitFor(() => expect(views.at(-1)?.entry?.keySignature).toBe("D"));

  await app.inject({
    method: "PUT",
    url: "/api/communities/unu-unu/songs/s1/music",
    headers: as,
    payload: {
      base: noMusic(),
      music: musicOfTexts(["1:\n.G\n A\n\n2:\nB\n\nR:\nC"]),
    },
  });
  await vi.waitFor(() =>
    expect(views.at(-1)?.song?.versions[0]?.text).toContain(".G"),
  );
  ws.close();
  await app.close();
});

test("the listening device takes over, sends the drift, and only it stops listening", async () => {
  const tempo = (as: string, payload: object) =>
    app.inject({
      method: "POST",
      url: "/api/communities/unu-unu/live/tempo",
      headers: { cookie: `__Host-session=${sessions[as]}` },
      payload,
    });
  expect((await tempo("ed", { listening: true })).statusCode).toBe(403);
  await tempo("ioana", { listening: true, measured: 77.4, drift: "fast" });
  const asMember = await app.inject({
    url: "/api/communities/unu-unu/live",
    headers: { cookie: `__Host-session=${sessions.ed}` },
  });
  expect(asMember.json<LiveView>().tempo).toEqual({
    listenerId: "ioana",
    listener: "Ioana",
    measured: 77,
    drift: "fast",
  });
  const asVisitor = await app.inject({ url: "/api/communities/unu-unu/live" });
  expect(asVisitor.json<LiveView>().tempo).toMatchObject({
    listener: null,
    drift: "fast",
  });
});

describe("YouTube chapters", () => {
  const chapters = async (playlist: string, as = "ioana") =>
    app.inject({
      url: `/api/communities/unu-unu/playlists/${playlist}/chapters`,
      headers: { cookie: `__Host-session=${sessions[as]}` },
    });

  test("each entry that goes live is kept; the last service's entries come back with when the next one went live", async () => {
    // Saturday's rehearsal of the same playlist doesn't count.
    vi.setSystemTime(new Date("2026-10-03T15:00:00Z"));
    await act({ type: "go", entryId: "e2" });
    vi.setSystemTime(SUNDAY);
    await act({ type: "go", entryId: "e1" });
    later(300);
    await act({ type: "go", entryId: "john" });
    later(120);
    await act({ type: "go", entryId: "other" });

    const response = await chapters("p");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([
      {
        entryId: "e1",
        at: "2026-10-04T07:30:00.000Z",
        until: "2026-10-04T07:35:00.000Z",
      },
      {
        entryId: "john",
        at: "2026-10-04T07:35:00.000Z",
        until: "2026-10-04T07:37:00.000Z",
      },
    ]);
    // The entry still live has no end yet.
    expect((await chapters("q")).json()).toEqual([
      { entryId: "other", at: "2026-10-04T07:37:00.000Z", until: null },
    ]);
    expect(
      (
        await app.inject({
          url: "/api/communities/unu-unu/playlists/p/chapters",
        })
      ).statusCode,
    ).toBe(401);
  });
});

test("every slide change is kept, with the song, who and when", async () => {
  await act({ type: "go", entryId: "e1" });
  await act({ type: "next" });
  await act({ type: "blank", blank: true });
  await act({ type: "blank", blank: true }); // nothing changes: nothing kept
  expect(
    db
      .prepare(
        "SELECT entry_id AS entry, song_id AS song, slide, blank, created_by AS by FROM slide_log ORDER BY at, rowid",
      )
      .all(),
  ).toEqual([
    { entry: "e1", song: "s1", slide: 0, blank: 0, by: "ioana" },
    { entry: "e1", song: "s1", slide: 1, blank: 0, by: "ioana" },
    { entry: "e1", song: "s1", slide: 1, blank: 1, by: "ioana" },
  ]);
});

test("a verse from bible.com shows over what's live until Next, an entry or blank", async () => {
  await act({ type: "go", entryId: "e1", slide: 1 });
  const verse = {
    ro: {
      reference: "Ioan 3:16",
      text: "Fiindcă atât de mult a iubit Dumnezeu lumea",
    },
    uk: { reference: "Івана 3:16", text: "Бо так полюбив Бог світ" },
    // Not a language of the community: left out.
    de: {
      reference: "Johannes 3:16",
      text: "Denn also hat Gott die Welt geliebt",
    },
  };
  let { view } = await act({ type: "verse", verse });
  expect(view.verse).toEqual({ ro: verse.ro, uk: verse.uk });
  expect(where(view)).toBe("e1:1");
  // Visitors' screens show it too.
  const shown = await app.inject({ url: "/api/communities/unu-unu/live" });
  expect(shown.json<LiveView>().verse).toEqual({ ro: verse.ro, uk: verse.uk });

  // Next goes back to the slide it covered, not past it.
  ({ view } = await act({ type: "next" }));
  expect(view.verse).toBeNull();
  expect(where(view)).toBe("e1:1");
  await act({ type: "verse", verse });
  ({ view } = await act({ type: "blank", blank: true }));
  expect(view.verse).toBeNull();
  ({ view } = await act({ type: "verse", verse }));
  expect(view.blank).toBe(false);
  ({ view } = await act({ type: "go", entryId: "e1", slide: 0 }));
  expect(view.verse).toBeNull();
  // Only the team sends one.
  expect((await act({ type: "verse", verse }, "ed")).status).toBe(403);
});
