import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import { type Recording } from "./recording-view.js";
import { cut, stretches } from "./recording-finish.js";
import { stubConverter } from "../test-helpers.js";

let db: Db;
let dir: string;
const sessions: Record<string, string> = {};

let converter: Awaited<ReturnType<typeof stubConverter>>;
beforeAll(async () => {
  converter = await stubConverter();
});
afterAll(() => converter.close());

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  dir = mkdtempSync(join(tmpdir(), "norless-recordings-"));
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('mihai', 'Mihai', 'mihai@example.com', 'active', '2026-01-01', '2026-01-01'),
      ('dan', 'Dan', 'dan@example.com', 'active', '2026-01-01', '2026-01-01'),
      ('ana', 'Ana', 'ana@example.com', 'active', '2026-01-01', '2026-01-01'),
      ('ed', 'Ed', 'ed@example.com', 'active', '2026-01-01', '2026-01-01');
    INSERT INTO users (id, display_name, status, device_of, device_kind, created_at, updated_at) VALUES
      ('vlad', 'Vlad (guest of Mihai)', 'active', 'mihai', 'guest', '2026-01-01', '2026-01-01');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m1', 'c', 'mihai', '["team"]', 'active', '2026-01-01', '2026-01-01'),
      ('m2', 'c', 'dan', '["team"]', 'active', '2026-01-01', '2026-01-01'),
      ('m3', 'c', 'ana', '["owner"]', 'active', '2026-01-01', '2026-01-01'),
      ('m4', 'c', 'ed', '["editor"]', 'active', '2026-01-01', '2026-01-01'),
      ('m5', 'c', 'vlad', '["team"]', 'active', '2026-01-01', '2026-01-01');
    INSERT INTO songs (id, community_id, tags, created_at, updated_at) VALUES
      ('s1', 'c', '[]', '2026-01-01', '2026-01-01'),
      ('s2', 'c', '[]', '2026-01-01', '2026-01-01');
    INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
      ('s1-ro', 'c', 's1', 'ro', 'Unu', '1:\nA\n\nR:\nB', '2026-01-01', '2026-01-01'),
      ('s2-ro', 'c', 's2', 'ro', 'Doi', 'C', '2026-01-01', '2026-01-01');
    INSERT INTO playlists (id, community_id, title, created_at, updated_at) VALUES
      ('p', 'c', 'Repetiție', '2026-01-01', '2026-01-01');
    INSERT INTO entries (id, community_id, playlist_id, position, kind, song_id, created_at, updated_at) VALUES
      ('e1', 'c', 'p', 1, 'song', 's1', '2026-01-01', '2026-01-01'),
      ('e2', 'c', 'p', 2, 'song', 's2', '2026-01-01', '2026-01-01');
  `);
  for (const user of ["mihai", "dan", "ana", "ed", "vlad"])
    sessions[user] = createSession(db, user);
});

const app = () => buildApp({ db, logger: false, recordingsDir: dir });
const call = (
  as: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  payload?: object | Buffer,
) =>
  app().inject({
    method,
    url: `/api/communities/unu-unu${path}`,
    headers: {
      cookie: `__Host-session=${sessions[as]}`,
      ...(Buffer.isBuffer(payload)
        ? { "content-type": "application/octet-stream" }
        : {}),
    },
    payload,
  });

/** A recording's bytes, as the browser uploads them; the stub converter cuts them. */
const tone = () => Buffer.alloc(6000, 7);

test("stretches cut where another entry went live; a click past one joins the one before", () => {
  expect(
    stretches(
      [
        { at_ms: 0, entry_id: "e1", song_id: "s1" },
        { at_ms: 1500, entry_id: "e1", song_id: "s1" },
        { at_ms: 3000, entry_id: "e2", song_id: "s2" },
        { at_ms: 3300, entry_id: "e3", song_id: null },
        { at_ms: 3400, entry_id: "e2", song_id: "s2" },
      ],
      6000,
    ),
  ).toEqual([
    { entryId: "e1", songId: "s1", start: 0, end: 3000 },
    { entryId: "e2", songId: "s2", start: 3400, end: 6000 },
  ]);
});

describe("recording", () => {
  test("uploaded in pieces, marked with what was live, cut into a file per song", async () => {
    await call("mihai", "POST", "/live", { type: "go", entryId: "e1" });
    const { id } = (
      await call("mihai", "POST", "/recordings", {
        mime: "audio/webm;codecs=opus",
      })
    ).json<{ id: string }>();
    // Stage screens show it: names to members only.
    expect((await call("dan", "GET", "/live")).json()).toMatchObject({
      recording: { by: "Mihai" },
    });

    const audio = tone();
    const half = Math.floor(audio.length / 2);
    expect(
      (
        await call(
          "mihai",
          "POST",
          `/recordings/${id}/pieces?piece=0`,
          audio.subarray(0, half),
        )
      ).statusCode,
    ).toBe(204);
    // A retry of a piece the server has is ignored; a gap is refused.
    expect(
      (
        await call(
          "mihai",
          "POST",
          `/recordings/${id}/pieces?piece=0`,
          audio.subarray(0, half),
        )
      ).statusCode,
    ).toBe(204);
    expect(
      (
        await call(
          "mihai",
          "POST",
          `/recordings/${id}/pieces?piece=2`,
          audio.subarray(half),
        )
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await call(
          "dan",
          "POST",
          `/recordings/${id}/pieces?piece=1`,
          audio.subarray(half),
        )
      ).statusCode,
    ).toBe(404);
    await call(
      "mihai",
      "POST",
      `/recordings/${id}/pieces?piece=1`,
      audio.subarray(half),
    );

    // The second song went live 3 seconds in, its refrain 4.5 seconds in.
    db.prepare("UPDATE recordings SET started_at = ? WHERE id = ?").run(
      new Date(Date.now() - 6000).toISOString(),
      id,
    );
    db.prepare("DELETE FROM recording_marks WHERE recording_id = ?").run(id);
    const mark = db.prepare(
      "INSERT INTO recording_marks (recording_id, at_ms, entry_id, song_id, slide) VALUES (?, ?, ?, ?, ?)",
    );
    mark.run(id, 0, "e1", "s1", 0);
    mark.run(id, 1500, "e1", "s1", 1);
    mark.run(id, 3000, "e2", "s2", 0);
    const stopped = await call("mihai", "POST", `/recordings/${id}/stop`);
    const recording = stopped.json<Recording>();
    expect(recording).toMatchObject({
      by: "Mihai",
      status: "ready",
      access: "own",
      parts: [
        {
          titles: { ro: "Unu" },
          startMs: 0,
          endMs: 3000,
          marks: [
            { atMs: 0, slide: 0 },
            { atMs: 1500, slide: 1 },
          ],
        },
        { titles: { ro: "Doi" }, startMs: 3000 },
      ],
    });
    const files = readdirSync(join(dir, id)).sort();
    // m4a, which Finder and QuickTime play, unlike the WebM browsers record.
    expect(files).toEqual(["01.m4a", "02.m4a"]);
    // Cut by the converter, which got the whole upload and the stretches.
    expect(readFileSync(join(dir, id, "01.m4a"), "utf8")).toMatch(
      /^part 0-3000\n/,
    );
    expect(readFileSync(join(dir, id, "02.m4a"), "utf8")).toMatch(
      /^part 3000-\n/,
    );
    expect(converter.jobs.at(-1)).toMatchObject({
      path: "/v1/recordings",
      bytes: 6000,
    });
    expect(converter.jobs.at(-1)?.query.get("ext")).toBe("webm");
    expect((await call("dan", "GET", "/live")).json()).toMatchObject({
      recording: null,
    });

    // Playback with byte ranges, for its owner.
    const part = recording.parts[0]?.id;
    const ranged = await app().inject({
      url: `/api/communities/unu-unu/recordings/${id}/parts/${part}/audio`,
      headers: {
        cookie: `__Host-session=${sessions.mihai}`,
        range: "bytes=0-99",
      },
    });
    expect(ranged.statusCode).toBe(206);
    expect(ranged.headers["content-type"]).toBe("audio/mp4");
    expect(ranged.rawPayload).toHaveLength(100);

    // The song's page lists its file, for the team.
    const song = await call("dan", "GET", "/songs/s1/recordings");
    expect(song.json()).toMatchObject([
      {
        recording: { id, by: "Mihai", access: null },
        part: { id: part, titles: { ro: "Unu" } },
      },
    ]);
    expect(song.json()[0].recording).not.toHaveProperty("requests");
    expect((await call("ed", "GET", "/songs/s1/recordings")).statusCode).toBe(
      403,
    );
  });

  test("others see it and ask; its owner grants; an owner deletes it with its audio", async () => {
    const { id } = (
      await call("mihai", "POST", "/recordings", { mime: "audio/webm" })
    ).json<{ id: string }>();
    await call("mihai", "POST", `/recordings/${id}/pieces?piece=0`, tone());
    const { parts } = (
      await call("mihai", "POST", `/recordings/${id}/stop`)
    ).json<Recording>();
    const audio = (as: string) =>
      call(as, "GET", `/recordings/${id}/parts/${parts[0]?.id}/audio`);

    expect((await call("ed", "GET", "/recordings")).statusCode).toBe(403);
    const [seen] = (await call("dan", "GET", "/recordings")).json<
      Recording[]
    >();
    expect(seen).toMatchObject({ by: "Mihai", access: null });
    expect(seen).not.toHaveProperty("requests");
    expect((await audio("dan")).statusCode).toBe(403);

    await call("dan", "POST", `/recordings/${id}/access`);
    const mine = (
      await call("mihai", "GET", `/recordings/${id}`)
    ).json<Recording>();
    expect(mine.requests).toEqual([
      { userId: "dan", name: "Dan", status: "asked" },
    ]);
    expect(
      (
        await call("dan", "PUT", `/recordings/${id}/access/dan`, {
          status: "granted",
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await call("mihai", "PUT", `/recordings/${id}/access/dan`, {
          status: "granted",
        })
      ).statusCode,
    ).toBe(204);
    expect((await audio("dan")).statusCode).toBe(200);
    await call("mihai", "PUT", `/recordings/${id}/access/dan`, {
      status: "refused",
    });
    expect((await audio("dan")).statusCode).toBe(403);

    expect((await call("dan", "DELETE", `/recordings/${id}`)).statusCode).toBe(
      403,
    );
    expect((await call("ana", "DELETE", `/recordings/${id}`)).statusCode).toBe(
      204,
    );
    expect((await call("mihai", "GET", "/recordings")).json()).toEqual([]);
    expect(readdirSync(dir)).toEqual([]);
  });

  test("while the converter is away, a recording waits whole and is cut once it's back", async () => {
    const { id } = (
      await call("mihai", "POST", "/recordings", { mime: "audio/webm" })
    ).json<{ id: string }>();
    await call("mihai", "POST", `/recordings/${id}/pieces?piece=0`, tone());
    converter.away(true);
    try {
      const stopped = await call("mihai", "POST", `/recordings/${id}/stop`);
      expect(stopped.json()).toMatchObject({ status: "processing", parts: [] });
      expect(readdirSync(join(dir, id))).toEqual(["upload.webm"]);
    } finally {
      converter.away(false);
    }
    // recordings.ts tries again every 5 minutes.
    await cut(db, dir, id);
    expect(
      (await call("mihai", "GET", `/recordings/${id}`)).json(),
    ).toMatchObject({ status: "ready", parts: [{ startMs: 0 }] });
    expect(readdirSync(join(dir, id))).toEqual(["01.m4a"]);
  });

  test("a guest's recording belongs to the member who let the guest in", async () => {
    const { id } = (
      await call("vlad", "POST", "/recordings", { mime: "audio/webm" })
    ).json<{ id: string }>();
    expect(
      (await call("mihai", "GET", `/recordings/${id}`)).json(),
    ).toMatchObject({
      by: "Mihai",
      device: "Vlad (guest of Mihai)",
      access: "own",
    });
  });
});
