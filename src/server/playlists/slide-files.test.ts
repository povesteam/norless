import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import type { LiveView } from "../live/live-view.js";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import { stubConverter } from "../test-helpers.js";
import type { Playlist } from "./playlists.js";
import { entriesFrom } from "./slide-files.js";
import { fileFor, type SlideFile } from "../../shared/slides.js";

let db: Db;
let dir: string;
let sessions: Record<string, string>;
let converter: Awaited<ReturnType<typeof stubConverter>>;
beforeAll(async () => {
  converter = await stubConverter();
});
afterAll(() => converter.close());

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  dir = mkdtempSync(join(tmpdir(), "norless-slides-"));
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro","uk"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('team', 'Ioana', 'ioana@example.com', 'active', '2026-01-01', '2026-01-01'),
      ('editor', 'Ed', 'ed@example.com', 'active', '2026-01-01', '2026-01-01');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m1', 'c', 'team', '["team"]', 'active', '2026-01-01', '2026-01-01'),
      ('m2', 'c', 'editor', '["editor"]', 'active', '2026-01-01', '2026-01-01');
    INSERT INTO songs (id, community_id, tags, created_at, updated_at) VALUES
      ('song', 'c', '[]', '2026-01-01', '2026-01-01');
    INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
      ('v', 'c', 'song', 'ro', 'Slavă', 'Unu', '2026-01-01', '2026-01-01');
    INSERT INTO playlists (id, community_id, title, created_at, updated_at) VALUES
      ('p', 'c', 'Duminică', '2026-01-01', '2026-01-01');
    INSERT INTO entries (id, community_id, playlist_id, position, kind, song_id, created_at, updated_at) VALUES
      ('e-song', 'c', 'p', 1, 'song', 'song', '2026-01-01', '2026-01-01');
  `);
  sessions = {
    team: createSession(db, "team"),
    editor: createSession(db, "editor"),
  };
});

let app: ReturnType<typeof buildApp>;
beforeEach(() => {
  app = buildApp({ db, logger: false, slidesDir: dir });
});

/** A multipart upload of files, each a name and its text. */
const upload = (
  as: string,
  url: string,
  files: [string, string | Uint8Array<ArrayBuffer>][],
  method: "POST" | "PUT" = "POST",
) => {
  const form = new FormData();
  for (const [name, bytes] of files)
    form.append("file", new Blob([bytes]), name);
  const request = new Request("http://x", { method: "POST", body: form });
  return request.arrayBuffer().then((body) =>
    app.inject({
      method,
      url: `/api/communities/unu-unu${url}`,
      headers: {
        cookie: `__Host-session=${sessions[as]}`,
        "content-type": request.headers.get("content-type") ?? "",
      },
      payload: Buffer.from(body),
    }),
  );
};
const playlist = async () =>
  (
    await app.inject({ url: "/api/communities/unu-unu/playlists/p" })
  ).json<Playlist>();
/** The entry once its files are no longer preparing. */
const prepared = async (entryId: string) => {
  await vi.waitFor(async () => {
    const entry = (await playlist()).entries.find((e) => e.id === entryId);
    expect(entry?.slides?.files.every((f) => f.state !== "preparing")).toBe(
      true,
    );
  });
  return (await playlist()).entries.find((e) => e.id === entryId);
};
const live = (body: object) =>
  app.inject({
    method: "POST",
    url: "/api/communities/unu-unu/live",
    headers: { cookie: `__Host-session=${sessions.team}` },
    payload: body,
  });

test("a PDF becomes an entry whose pages are drawn once and served for a year", async () => {
  const added = await upload("team", "/playlists/p/slides", [
    ["Anunțuri 12 oct.pdf", "%PDF 3"],
  ]);
  expect(added.statusCode).toBe(201);
  const [id] = added.json<{ entries: string[] }>().entries;
  const entry = await prepared(id ?? "");
  expect(entry).toMatchObject({
    kind: "slides",
    text: "Anunțuri 12 oct",
    slides: {
      files: [
        { language: null, kind: "pdf", pages: 3, total: 3, state: "ready" },
      ],
      seconds: null,
    },
  });
  const file = entry?.slides?.files[0]?.id;
  const page = await app.inject({ url: `/api/slide-pages/${file}/2/1280` });
  expect(page.payload).toBe("page 2 at 1280");
  expect(page.headers["cache-control"]).toContain("immutable");
  expect(
    (await app.inject({ url: `/api/slide-pages/${file}/2/999` })).statusCode,
  ).toBe(404);
  expect(readdirSync(join(dir, file ?? ""))).toContain("original-1.pdf");
});

test("pictures picked together make one entry, a page each in name order", async () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  const [id] = (
    await upload("team", "/playlists/p/slides", [
      ["10.png", png],
      ["2.png", png],
      ["1.png", png],
    ])
  ).json<{ entries: string[] }>().entries;
  const entry = await prepared(id ?? "");
  expect(entry?.slides?.files[0]).toMatchObject({
    kind: "pictures",
    name: "1.png",
    total: 3,
    state: "ready",
  });
  expect(
    entriesFrom(
      ["b.pdf", "10.png", "2.png", "a.pdf"].map((name) => ({
        name,
        ext: name.slice(name.indexOf(".")),
        kind: name.endsWith(".png") ? "pictures" : "pdf",
        bytes: Buffer.alloc(0),
      })),
    ).map((group) => group.map((u) => u.name)),
  ).toEqual([["b.pdf"], ["a.pdf"], ["2.png", "10.png"]]);
});

test("a file that can't be opened says so and is tried again; other files and roles are refused", async () => {
  const [id] = (
    await upload("team", "/playlists/p/slides", [["Locked.pdf", "locked"]])
  ).json<{ entries: string[] }>().entries;
  const entry = await prepared(id ?? "");
  const file = entry?.slides?.files[0];
  expect(file).toMatchObject({
    state: "failed",
    error: "The file couldn't be opened",
  });
  // A failed entry doesn't go live.
  expect((await live({ type: "go", entryId: id })).json()).toMatchObject({
    entryId: null,
  });
  const retried = await app.inject({
    method: "POST",
    url: `/api/communities/unu-unu/slide-files/${file?.id}/retry`,
    headers: { cookie: `__Host-session=${sessions.team}` },
  });
  expect(retried.statusCode).toBe(204);
  expect((await prepared(id ?? ""))?.slides?.files[0]?.state).toBe("failed");

  // Presentations too: they're added as a PDF exported from them.
  for (const name of ["notes.txt", "Anunturi.pptx", "Anunturi.key"])
    expect(
      (await upload("team", "/playlists/p/slides", [[name, "x"]])).statusCode,
    ).toBe(400);
  expect(
    (await upload("editor", "/playlists/p/slides", [["a.pdf", "%PDF 1"]]))
      .statusCode,
  ).toBe(403);
});

test("a file for UA shows on UA's screens", async () => {
  const [id] = (
    await upload("team", "/playlists/p/slides", [["Anunturi.pdf", "%PDF 2"]])
  ).json<{ entries: string[] }>().entries;
  const entry = await prepared(id ?? "");
  expect(entry?.slides?.files[0]).toMatchObject({
    kind: "pdf",
    total: 2,
    state: "ready",
  });
  const put = await upload(
    "team",
    `/playlists/p/entries/${id}/slides/uk`,
    [["Оголошення.pdf", "%PDF 4"]],
    "PUT",
  );
  expect(put.statusCode).toBe(204);
  const files = (await prepared(id ?? ""))?.slides?.files as SlideFile[];
  expect(files.map((f) => [f.language, f.total])).toEqual([
    [null, 2],
    ["uk", 4],
  ]);
  expect(fileFor(files, ["uk"])?.language).toBe("uk");
  expect(fileFor(files, ["ro"])?.language).toBeNull();
  expect(
    (
      await upload(
        "team",
        `/playlists/p/entries/${id}/slides/en`,
        [["x.pdf", "%PDF 1"]],
        "PUT",
      )
    ).statusCode,
  ).toBe(400);
});

test("while the converter is away a file waits, and is drawn once it's back", async () => {
  converter.away(true);
  let id: string | undefined;
  try {
    [id] = (
      await upload("team", "/playlists/p/slides", [["Program.pdf", "%PDF 2"]])
    ).json<{ entries: string[] }>().entries;
    await vi.waitFor(async () =>
      expect(
        (await playlist()).entries.find((e) => e.id === id)?.slides?.files[0]
          ?.state,
      ).toBe("preparing"),
    );
  } finally {
    converter.away(false);
  }
  // Every minute, those preparing are tried again.
  db.prepare("UPDATE slide_files SET updated_at = '2026-01-01'").run();
  await app.ready();
  expect((await prepared(id ?? ""))?.slides?.files[0]?.state).toBe("ready");
});

test("pages are slides: Next goes through them, then on; the timer loops until anything moves", async () => {
  const [id] = (
    await upload("team", "/playlists/p/slides", [["Anunțuri.pdf", "%PDF 3"]])
  ).json<{ entries: string[] }>().entries;
  await prepared(id ?? "");
  db.prepare(
    "INSERT INTO entries (id, community_id, playlist_id, position, kind, song_id, created_at, updated_at) VALUES ('e-after', 'c', 'p', 9, 'song', 'song', 'x', 'x')",
  ).run();
  expect(
    (await live({ type: "go", entryId: id, slide: 2 })).json<LiveView>(),
  ).toMatchObject({ entryId: id, slide: 2, slides: 3 });
  expect((await live({ type: "next" })).json<LiveView>()).toMatchObject({
    entryId: "e-after",
    slide: 0,
  });

  vi.useFakeTimers({ toFake: ["setInterval", "Date"] });
  try {
    app = buildApp({ db, logger: false, slidesDir: dir });
    const started = await live({ type: "timer", entryId: id, seconds: 8 });
    expect(started.json<LiveView>()).toMatchObject({
      entryId: id,
      slide: 0,
      timer: { seconds: 8 },
    });
    await vi.advanceTimersByTimeAsync(8_000);
    const view = () =>
      app
        .inject({ url: "/api/communities/unu-unu/live" })
        .then((r) => r.json<LiveView>());
    expect(await view()).toMatchObject({ slide: 1 });
    await vi.advanceTimersByTimeAsync(16_000);
    // After the last page, the first again.
    expect(await view()).toMatchObject({ slide: 0 });
    // Any move stops it; its seconds stay on the entry for the next start.
    expect((await live({ type: "previous" })).json()).toMatchObject({
      timer: null,
    });
    await vi.advanceTimersByTimeAsync(16_000);
    expect((await view()).timer).toBeNull();
    expect(
      (await playlist()).entries.find((e) => e.id === id)?.slides?.seconds,
    ).toBe(8);
  } finally {
    vi.useRealTimers();
  }
});
