import { beforeEach, describe, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import { convertSongs, type Song } from "./songs.js";
import type { Revision } from "./song-history.js";
import {
  mapChords,
  type Music,
  musicOfTexts,
} from "../../shared/music/chord-track.js";
import { parseSong } from "../../shared/song-text.js";

let db: Db;
const sessions: Record<string, string> = {};
const text = "1:\n Cântați Domnului toți\n\nR:\nAleluia";

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro","uk"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
    INSERT INTO songs (id, community_id, key_signature, time_signature, tags, created_at, updated_at) VALUES
      ('song', 'c', 'G', '4/4', '[]', '2026-01-01', '2026-01-01');
    INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
      ('v-ro', 'c', 'song', 'ro', 'Cântați', '${text}', '2026-01-01', '2026-01-01');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('editor', 'Ed', 'ed@example.com', 'active', '2026-01-01', '2026-01-01'),
      ('owner', 'Ow', 'ow@example.com', 'active', '2026-01-01', '2026-01-01'),
      ('team', 'Mihai', 'mu@example.com', 'active', '2026-01-01', '2026-01-01'),
      ('member', 'Me', 'me@example.com', 'active', '2026-01-01', '2026-01-01'),
      ('stranger', 'St', 'st@example.com', 'active', '2026-01-01', '2026-01-01');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m1', 'c', 'editor', '["editor"]', 'active', '2026-01-01', '2026-01-01'),
      ('m2', 'c', 'owner', '["owner"]', 'active', '2026-01-01', '2026-01-01'),
      ('m3', 'c', 'team', '["team"]', 'active', '2026-01-01', '2026-01-01'),
      ('m4', 'c', 'member', '[]', 'active', '2026-01-01', '2026-01-01');
  `);
  // The seed's text in the old format, taken apart as the import does.
  convertSongs(db);
  for (const user of ["editor", "owner", "team", "member", "stranger"])
    sessions[user] = createSession(db, user);
});

const send = (
  as: string | null,
  method: "GET" | "POST" | "PUT",
  path: string,
  payload?: object,
) =>
  buildApp({ db, logger: false }).inject({
    method,
    url: `/api/communities/unu-unu/songs/song${path && `/${path}`}`,
    headers: as ? { cookie: `__Host-session=${sessions[as]}` } : {},
    payload,
  });
const withChords =
  "1:\n.G       C\n Cântați Domnului toți\n! drums: rim\n\nR:\n.D\nAleluia";
const chordsMusic = musicOfTexts([withChords]);
const current = async () => (await send("member", "GET", "")).json<Song>();
const music = async (as: string | null, next: Music, base?: Music) =>
  send(as, "PUT", "music", {
    base: base ?? (await current()).music,
    music: next,
  });
/** Each line's chords, per section, as the views read them. */
const chordsOf = (text = "") =>
  parseSong(text).sections.map((s) =>
    s.lines.map((l) => l.chords.map((c) => c.name).join(" ")),
  );

describe("chords, notes and tempo", () => {
  test("the team, editors and owners change chords and notes; others can't", async () => {
    expect((await music(null, chordsMusic)).statusCode).toBe(401);
    expect((await music("member", chordsMusic)).statusCode).toBe(403);
    expect((await music("stranger", chordsMusic)).statusCode).toBe(403);

    const response = await music("team", chordsMusic);
    expect(response.statusCode).toBe(200);
    const saved = response.json<Song>();
    expect(chordsOf(saved.versions[0]?.text)).toEqual([["G C"], ["D"]]);
    expect(parseSong(saved.versions[0]?.text ?? "").sections[0]?.notes).toEqual(
      [{ text: "drums: rim", group: "drums" }],
    );
    // The words stay as they were, without chords.
    expect(saved.versions[0]?.lyrics).toBe(
      "1:\nCântați Domnului toți\n\nR:\nAleluia",
    );
    for (const as of ["editor", "owner"])
      expect((await music(as, chordsMusic)).statusCode).toBe(200);
  });

  test("one track shows over every language (separate-chord-track)", async () => {
    db.exec(`INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
      ('v-uk', 'c', 'song', 'uk', 'Співайте', '1:\nСпівайте Господу всі\n\nR:\nАлілуя', '2026-01-02', '2026-01-02')`);
    const saved = (await music("team", chordsMusic)).json<Song>();
    expect(chordsOf(saved.versions[1]?.text)).toEqual([["G C"], ["D"]]);
  });

  test("the team adds a notation block, which the lyrics leave out", async () => {
    const intro = musicOfTexts([
      "1:\n```abc\nX:1\nK:G\nG2 B2 d2 g2|\n```\nCântați Domnului toți",
    ]);
    const response = await music("team", intro);
    expect(response.statusCode).toBe(200);
    const saved = response.json<Song>().versions[0];
    expect(saved?.text).toContain("G2 B2 d2 g2|");
    expect(saved?.lyrics).not.toContain("abc");
  });

  test("a section of its own and a part first keep their shape through the server", async () => {
    // A part without words before the first section, and verse 2 with chords of its own.
    const own = musicOfTexts([
      "I:\n.| G | C |\n\n1:\n.G\n Cântați Domnului toți\n\nR:\n.D\nAleluia",
    ]);
    own.sections["verse.2"] = {
      follows: false,
      own: { lines: 1, rows: [] },
    };
    const saved = (await music("team", own)).json<Song>();
    expect(saved.music.parts[0]?.after).toBeNull();
    expect(saved.music.sections["verse.2"]?.follows).toBe(false);
  });

  test("someone else's change in between is a conflict", async () => {
    const before = (await current()).music;
    const saved = (await music("team", chordsMusic)).json<Song>();
    const response = await music(
      "editor",
      musicOfTexts([text.replace("1:\n", "1:\n.A\n")]),
      before,
    );
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      conflict: { language: "ro", theirs: saved.versions[0]?.text },
    });
  });

  test("the team sets the tempo, between 30 and 300 or none", async () => {
    expect((await send("member", "PUT", "tempo", { bpm: 72 })).statusCode).toBe(
      403,
    );
    expect((await send("team", "PUT", "tempo", { bpm: 301 })).statusCode).toBe(
      400,
    );
    const response = await send("team", "PUT", "tempo", { bpm: 72 });
    expect(response.json<Song>().bpm).toBe(72);
    expect(
      (await send("team", "PUT", "tempo", { bpm: null })).json<Song>().bpm,
    ).toBeNull();
  });
});

describe("history", () => {
  test("members see each save with who made it; visitors and strangers don't", async () => {
    const before = (await current()).versions[0]?.text;
    const withTrack = (await music("team", chordsMusic)).json<Song>()
      .versions[0]?.text;
    await send("team", "PUT", "tempo", { bpm: 72 });

    expect((await send(null, "GET", "revisions")).statusCode).toBe(401);
    expect((await send("stranger", "GET", "revisions")).statusCode).toBe(403);
    const history = (await send("member", "GET", "revisions")).json<
      Revision[]
    >();
    expect(history.map((r) => [r.savedBy, r.bpm, r.versions[0]?.text])).toEqual(
      [
        ["Mihai", null, withTrack],
        ["Mihai", null, before],
      ],
    );
  });

  test("editors and owners restore a song as it was; the restore can be undone", async () => {
    const withTrack = (await music("team", chordsMusic)).json<Song>()
      .versions[0]?.text;
    const [before] = (await send("member", "GET", "revisions")).json<
      Revision[]
    >();
    expect(
      (await send("team", "POST", `revisions/${before?.id}/restore`))
        .statusCode,
    ).toBe(403);

    const restored = await send(
      "editor",
      "POST",
      `revisions/${before?.id}/restore`,
    );
    expect(chordsOf(restored.json<Song>().versions[0]?.text)).toEqual([
      [""],
      [""],
    ]);
    const history = (await send("member", "GET", "revisions")).json<
      Revision[]
    >();
    expect(history[0]).toMatchObject({ savedBy: "Ed" });
    expect(history[0]?.versions[0]?.text).toBe(withTrack);
    // Restoring the save with the track brings its chords back.
    const back = await send(
      "editor",
      "POST",
      `revisions/${history[0]?.id}/restore`,
    );
    expect(chordsOf(back.json<Song>().versions[0]?.text)).toEqual([
      ["G C"],
      ["D"],
    ]);
    expect(
      (await send("owner", "POST", "revisions/missing/restore")).statusCode,
    ).toBe(404);
  });
});

describe("changing the key", () => {
  const moved = mapChords(
    chordsMusic,
    (name) => ({ G: "A", C: "D", D: "E" })[name] ?? name,
    (row) => row,
  );

  test("the team and editors change the key with the chords moved; others can't", async () => {
    const base = (await music("team", chordsMusic)).json<Song>().music;
    const key = (as: string) =>
      send(as, "PUT", "key", { keySignature: "A", base, music: moved });
    expect((await key("member")).statusCode).toBe(403);
    const response = await key("team");
    expect(response.statusCode).toBe(200);
    expect(response.json<Song>().keySignature).toBe("A");
    expect(chordsOf(response.json<Song>().versions[0]?.text)).toEqual([
      ["A D"],
      ["E"],
    ]);
    const history = (await send("member", "GET", "revisions")).json<
      Revision[]
    >();
    expect(history[0]).toMatchObject({ savedBy: "Mihai", keySignature: "G" });
  });

  test("a key change over a track someone else changed is a conflict", async () => {
    const before = (await current()).music;
    await music("team", chordsMusic);
    const response = await send("editor", "PUT", "key", {
      keySignature: "A",
      base: before,
      music: moved,
    });
    expect(response.statusCode).toBe(409);
  });
});

describe("a song's key for one service", () => {
  test("the team sets it on a song entry; the song keeps its own", async () => {
    db.exec(`
      INSERT INTO playlists (id, community_id, title, created_at, updated_at) VALUES
        ('p', 'c', 'Duminică', '2026-01-01', '2026-01-01');
      INSERT INTO entries (id, community_id, playlist_id, position, kind, song_id, text, created_at, updated_at) VALUES
        ('e', 'c', 'p', 1, 'song', 'song', NULL, '2026-01-01', '2026-01-01'),
        ('d', 'c', 'p', 2, 'divider', NULL, 'Predică', '2026-01-01', '2026-01-01');
    `);
    const patch = (as: string, entry: string, keySignature: string | null) =>
      buildApp({ db, logger: false }).inject({
        method: "PATCH",
        url: `/api/communities/unu-unu/playlists/p/entries/${entry}`,
        headers: { cookie: `__Host-session=${sessions[as]}` },
        payload: { keySignature },
      });
    expect((await patch("editor", "e", "F")).statusCode).toBe(403);
    expect((await patch("team", "d", "F")).statusCode).toBe(400);
    expect((await patch("team", "e", "F")).statusCode).toBe(204);
    const playlist = await buildApp({ db, logger: false }).inject({
      url: "/api/communities/unu-unu/playlists/p",
    });
    expect(
      playlist.json<{ entries: { keySignature: string | null }[] }>()
        .entries[0],
    ).toMatchObject({
      keySignature: "F",
    });
    expect(
      db
        .prepare("SELECT key_signature FROM songs WHERE id = 'song'")
        .pluck()
        .get(),
    ).toBe("G");
  });
});

describe("tempo checks", () => {
  test("the team reports measured tempos; the song suggests the median of the last three", async () => {
    const check = (as: string, bpm: number) =>
      send(as, "POST", "tempo-checks", { bpm });
    expect((await check("member", 70)).statusCode).toBe(403);
    for (const bpm of [80, 70, 74, 69]) await check("team", bpm);
    const read = () =>
      buildApp({ db, logger: false }).inject({
        url: "/api/communities/unu-unu/songs/song",
      });
    expect((await read()).json<Song>().suggestedBpm).toBe(70);

    // Close to the song's own tempo, there's nothing to suggest.
    await send("team", "PUT", "tempo", { bpm: 71 });
    expect(
      (
        await buildApp({ db, logger: false }).inject({
          url: "/api/communities/unu-unu/songs/song",
        })
      ).json<Song>().suggestedBpm,
    ).toBeNull();
  });
});

describe("reference links", () => {
  test("the team and editors set https links with titles and pictures; History keeps them", async () => {
    const link = {
      url: "https://www.youtube.com/watch?v=abc",
      title: " Har minunat (live) ",
      site: "YouTube",
      image: null,
    };
    const put = (as: string, links: object[]) =>
      send(as, "PUT", "reference-links", { links });
    expect((await put("member", [link])).statusCode).toBe(403);
    for (const bad of [
      "javascript:alert(1)",
      "http://example.com",
      "https://a b",
    ])
      expect((await put("team", [{ ...link, url: bad }])).statusCode).toBe(400);
    // A picture is one Norless keeps.
    expect(
      (await put("team", [{ ...link, image: "nosuchimage1" }])).statusCode,
    ).toBe(400);
    db.prepare(
      "INSERT INTO images (id, content_type, data, created_at) VALUES ('picture12345', 'image/jpeg', x'ffd8', '2026-10-04')",
    ).run();
    const other = {
      url: "https://example.org/acoustic",
      title: "",
      site: "",
      image: "picture12345",
    };
    const response = await put("team", [link, other]);
    expect(response.json<Song>().referenceLinks).toEqual([
      { ...link, title: "Har minunat (live)" },
      other,
    ]);
    // Visitors see them too, and the picture.
    const app = buildApp({ db, logger: false });
    const read = await app.inject({
      url: "/api/communities/unu-unu/songs/song",
    });
    expect(read.json<Song>().referenceLinks).toHaveLength(2);
    const picture = await app.inject({ url: "/api/images/picture12345" });
    expect(picture.headers["content-type"]).toBe("image/jpeg");
    expect(picture.headers["cache-control"]).toContain("immutable");

    // History keeps the links before; restoring brings them back.
    expect((await put("editor", [])).json<Song>().referenceLinks).toEqual([]);
    const [last] = (await send("team", "GET", "revisions")).json<Revision[]>();
    expect(last?.referenceLinks).toHaveLength(2);
    const restored = await send(
      "editor",
      "POST",
      `revisions/${last?.id}/restore`,
    );
    expect(restored.json<Song>().referenceLinks).toHaveLength(2);
  });
});
