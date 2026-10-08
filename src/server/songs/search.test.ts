import { beforeEach, describe, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import { type SearchResult, search as searchFor } from "./search.js";
import { indexSongs } from "./search.js";
import { createSong, updateSong } from "./song-saves.js";

const now = "2026-09-30T10:00:00.000Z";
let db: Db;

function addSong(
  id: string,
  versions: Record<string, [title: string, text: string]>,
  fields: { tags?: string[]; deleted?: boolean; community?: string } = {},
) {
  db.prepare(
    "INSERT INTO songs (id, community_id, key_signature, time_signature, tags, created_at, updated_at, deleted_at) VALUES (?, ?, 'G', '4/4', ?, ?, ?, ?)",
  ).run(
    id,
    fields.community ?? "c",
    JSON.stringify(fields.tags ?? []),
    now,
    now,
    fields.deleted ? now : null,
  );
  for (const [language, [title, text]] of Object.entries(versions))
    db.prepare(
      "INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      `${id}-${language}`,
      fields.community ?? "c",
      id,
      language,
      title,
      text,
      now,
      now,
    );
  indexSongs(db, [id]);
}

async function search(q: string, slug = "unu-unu") {
  const response = await buildApp({ db, logger: false }).inject({
    url: `/api/communities/${slug}/search`,
    query: { q },
  });
  return {
    status: response.statusCode,
    results: (response.json() as { results?: SearchResult[] }).results ?? [],
  };
}

const songIds = (results: SearchResult[]) =>
  results.flatMap((r) => (r.type === "song" ? [r.id] : []));

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  const community = db.prepare(
    "INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES (?, ?, ?, ?, 'Europe/Bucharest', ?, ?)",
  );
  community.run("c", "unu-unu", "Unu-Unu", '["ro","uk"]', now, now);
  community.run("other", "other-church", "Other", '["ro"]', now, now);
});

describe("song search", () => {
  test("title matches rank above lyric matches, without diacritics", async () => {
    addSong("lyrics", { ro: ["Mărturisim", "Isus e Domn peste tot"] });
    addSong("title", { ro: ["Isus e Domn", "Cântăm"] });
    addSong("none", { ro: ["Altceva", "Nimic"] });

    const { results } = await search("isus e domn");
    expect(songIds(results)).toEqual(["title", "lyrics"]);
    expect(results.slice(-2)).toEqual([
      { type: "divider", text: "isus e domn" },
      { type: "new-song", title: "isus e domn" },
    ]);
  });

  test("finds songs by a word's start and by the Ukrainian title", async () => {
    addSong("song", {
      ro: ["Harul Tău", "Text"],
      uk: ["Святий Бог", "Хвала"],
    });

    expect(songIds((await search("har")).results)).toEqual(["song"]);
    expect(songIds((await search("святий")).results)).toEqual(["song"]);
  });

  test("a song saved through the app is found by its new words at once", async () => {
    db.prepare(
      "INSERT INTO users (id, display_name, status, created_at, updated_at) VALUES ('u', 'U', 'active', ?, ?)",
    ).run(now, now);
    const edit = { communityId: "c", userId: "u" };
    const song = createSong(
      db,
      { versions: [{ language: "ro", title: "Vechi", text: "Text vechi" }] },
      edit,
    );
    expect(songIds((await search("vechi")).results)).toEqual([song.id]);

    updateSong(
      db,
      song.id,
      {
        versions: [
          {
            language: "ro",
            title: "Nou",
            text: "Text nou",
            baseText: "Text vechi",
          },
        ],
      },
      edit,
    );
    expect(songIds((await search("vechi")).results)).toEqual([]);
    expect(songIds((await search("nou")).results)).toEqual([song.id]);
  });

  test("words typed together and typos find songs, after the exact matches", async () => {
    addSong("joined", { ro: ["Dați-mi un cântec", "Vreau să cânt"] });
    addSong("typo", { ro: ["Har minunat", "Ce mare har"] });
    addSong("exact", { ro: ["Minunt", "Har și pace"] });
    addSong("lyrics", { ro: ["Altul", "Doar har minunat mă ține"] });

    expect(songIds((await search("datimi")).results)).toEqual(["joined"]);
    // "minunt" as typed comes first; the titles with a typo before the lyrics.
    expect(songIds((await search("har minunt")).results)).toEqual([
      "exact",
      "typo",
      "lyrics",
    ]);
    // Fewer than five letters: no sloppy matches.
    expect(songIds((await search("hsr")).results)).toEqual([]);
  });

  test("chords don't match", async () => {
    addSong("song", { ro: ["Cântare", ".Am    G\nSlavă"] });

    expect(songIds((await search("Am")).results)).toEqual([]);
  });

  test("leaves out deleted songs and other communities", async () => {
    addSong("deleted", { ro: ["Slavă", "Text"] }, { deleted: true });
    addSong("other", { ro: ["Slavă", "Text"] }, { community: "other" });

    expect(songIds((await search("slava")).results)).toEqual([]);
  });

  test("returns at most 25 songs", async () => {
    for (let i = 0; i < 30; i++)
      addSong(`s${i}`, { ro: [`Slavă ${i}`, "Text"] });

    expect(songIds((await search("slava")).results)).toHaveLength(25);
  });

  test("result details", async () => {
    addSong(
      "song",
      { ro: ["Isus e Domn", "Text"], uk: ["Ісус є Господь", "Текст"] },
      { tags: ["laudă"] },
    );
    const play = db.prepare(
      "INSERT INTO plays (id, community_id, song_id, mode, played_at, created_at, updated_at) VALUES (?, 'c', 'song', ?, ?, ?, ?)",
    );
    play.run("p1", "service", "2026-09-06T09:00:00.000Z", now, now);
    play.run("p2", "rehearsal", "2026-09-27T09:00:00.000Z", now, now);

    expect((await search("isus")).results[0]).toEqual({
      type: "song",
      id: "song",
      titles: { ro: "Isus e Domn", uk: "Ісус є Господь" },
      keySignature: "G",
      timeSignature: "4/4",
      tags: ["laudă"],
      lastPlayedAt: "2026-09-06T09:00:00.000Z",
    });
  });
});

describe("other results", () => {
  test("a Bible reference gives references instead of songs", async () => {
    addSong("song", { ro: ["Ioan 3", "Text"] });

    expect((await search("ioan 3:16-18")).results).toEqual([
      { type: "bible", book: 43, chapter: 3, from: 16, to: 18 },
      { type: "bible", book: 62, chapter: 3, from: 16, to: 18 },
    ]);
  });

  test("an empty query lists up to 100 random songs", async () => {
    for (let i = 0; i < 110; i++)
      addSong(`s${i}`, { ro: [`Cântare ${i}`, "Text"] });
    addSong("deleted", { ro: ["Șters", "Text"] }, { deleted: true });

    const { results } = await search("");
    expect(results).toHaveLength(100);
    expect(results.every((r) => r.type === "song")).toBe(true);
    expect(songIds(results)).not.toContain("deleted");
  });

  test("an unknown community is not found", async () => {
    expect((await search("isus", "missing")).status).toBe(404);
  });
});

describe("suggestions in the empty box", () => {
  test("liked, played lately and not played lately come first, each once, with their reason", () => {
    for (const id of [
      "liked",
      "once",
      "lastWeek",
      "twice",
      "planned",
      "rested",
    ])
      addSong(id, { ro: [id, "Text"] });
    for (let i = 0; i < 5; i++)
      addSong(`random${i}`, { ro: [`r${i}`, "Text"] });
    db.exec(`
      INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
        ('u', 'Ana', 'ana@example.com', 'active', '${now}', '${now}');
      INSERT INTO song_opinions (id, community_id, song_id, user_id, opinion, created_at, updated_at) VALUES
        ('o', 'c', 'liked', 'u', 'like', '${now}', '${now}');
      INSERT INTO playlists (id, community_id, title, created_at, updated_at) VALUES
        ('pl', 'c', 'Duminică', '${now}', '${now}');
      INSERT INTO entries (id, community_id, playlist_id, position, kind, song_id, created_at, updated_at) VALUES
        ('e', 'c', 'pl', 1, 'song', 'planned', '${now}', '${now}');
    `);
    const play = db.prepare(
      "INSERT INTO plays (id, community_id, song_id, mode, played_at, created_at, updated_at) VALUES (?, 'c', ?, 'service', ?, ?, ?)",
    );
    const plays: [string, string][] = [
      // The last 4 services: 7, 14, 21 and 28 September.
      ["once", "2026-09-07"],
      ["liked", "2026-09-14"],
      ["twice", "2026-09-14"],
      ["twice", "2026-09-21"],
      ["planned", "2026-09-21"],
      ["lastWeek", "2026-09-28"],
      // Not in the last 6 months.
      ["rested", "2025-01-05"],
      ["rested", "2025-02-02"],
      ["rested", "2025-03-02"],
    ];
    plays.forEach(([song, day], i) =>
      play.run(`p${i}`, song, `${day}T08:00:00.000Z`, now, now),
    );

    const results = searchFor(
      db,
      { id: "c", languages: ["ro"] },
      "",
      "u",
      "pl",
    ).flatMap((r) => (r.type === "song" ? [r] : []));
    expect(results.slice(0, 4).map((r) => [r.id, r.reason])).toEqual([
      ["liked", "liked"],
      ["once", "lately"],
      ["lastWeek", "lately"],
      ["rested", "rested"],
    ]);
    // The rest at random: the song played twice lately and the one planned already.
    expect(results.slice(4).map((r) => r.reason)).toEqual(
      Array(7).fill(undefined),
    );
    expect(songIds(results.slice(4))).toEqual(
      expect.arrayContaining(["twice", "planned", "random0"]),
    );
  });
});
