import { describe, expect, test } from "vitest";
import { legacyId } from "./mapping.js";
import {
  firstLyricLine,
  hasCyrillic,
  splitCombinedTitle,
} from "./map-songs.js";
import { one, run, versionsOf } from "./test-helpers.js";

describe("helpers", () => {
  test("legacyId is stable and short", () => {
    expect(legacyId("shared", "songs", "abc")).toBe(
      legacyId("shared", "songs", "abc"),
    );
    expect(legacyId("shared", "songs", "abc")).not.toBe(
      legacyId("ua", "songs", "abc"),
    );
    expect(legacyId("x")).toMatch(/^[0-9A-Za-z]{12}$/);
  });

  test("hasCyrillic", () => {
    expect(hasCyrillic("Слава Богу")).toBe(true);
    expect(hasCyrillic("Slavă lui Dumnezeu")).toBe(false);
  });

  test("splitCombinedTitle splits at the first ' / '", () => {
    expect(splitCombinedTitle("Duh Sfânt / Святий Дух")).toEqual({
      ro: "Duh Sfânt",
      uk: "Святий Дух",
    });
    expect(splitCombinedTitle("A / B / C")).toEqual({ ro: "A", uk: "B / C" });
    expect(splitCombinedTitle("1/2")).toBeUndefined();
  });

  test("firstLyricLine skips section names, chord lines and blank lines", () => {
    expect(
      firstLyricLine("\nR:\n.G   C\n  Isus, Tu ești lumina\nmai departe"),
    ).toBe("Isus, Tu ești lumina");
    expect(firstLyricLine("[bridge]\nLa la")).toBe("La la");
  });
});

describe("songs", () => {
  test("RO only: one song with a Romanian version", () => {
    const { rows } = run({
      "norless.songs": [
        { _id: "s1", title: "Isus", text: "Isus e Domn", key_signature: "Re" },
      ],
    });

    const song = one(rows.songs);
    // Keys are stored in letters.
    expect(song.key_signature).toBe("D");
    expect(versionsOf(rows.song_versions, song.id)).toEqual({
      ro: { title: "Isus", text: "Isus e Domn" },
    });
  });

  test("UA only: one song with a Ukrainian version", () => {
    const { rows } = run({
      "norless-ua.songs": [{ _id: "s1", title: "Слава", text: "Слава Богу" }],
    });

    expect(versionsOf(rows.song_versions, one(rows.songs).id)).toEqual({
      uk: { title: "Слава", text: "Слава Богу" },
    });
  });

  test("UA only without Cyrillic: a Romanian version", () => {
    const { rows, report } = run({
      "norless-ua.songs": [{ _id: "s1", title: "Rugăciune", text: "Pace" }],
    });

    expect(versionsOf(rows.song_versions, one(rows.songs).id)).toEqual({
      ro: { title: "Rugăciune", text: "Pace" },
    });
    expect(report.samples.uaOnlySongsWithoutCyrillic).toEqual(["s1"]);
  });

  // Real pairs from UA_SONG_MATCHES.
  const aVenit = { ua: "32uECu9FQ795fNA2M", ro: "4SNZ4fdY4ecMu255z" };

  test("a UA song matched by hand joins its RO song, with its entries and opens", () => {
    const { rows } = run({
      "norless.songs": [
        { _id: aVenit.ro, title: "A venit Isus", text: "Îngeri mii" },
        { _id: aVenit.ua, title: "", text: "" },
      ],
      "norless-ua.songs": [
        { _id: aVenit.ua, title: "A venit Isus", text: "Тысячи ангелов" },
      ],
      "norless-ua.playlists": [{ _id: "p1", title: "Crăciun", position: 1 }],
      "norless-ua.entries": [
        {
          _id: "e1",
          playlist_id: "p1",
          klass: "song",
          identifier: aVenit.ua,
          position: 1,
        },
      ],
      "norless-ua.opens": [{ _id: "o1", song_id: aVenit.ua, time: 1 }],
      // The RO app's empty copy of the UA song, played there too.
      "norless.opens": [{ _id: "o2", song_id: aVenit.ua, time: 2 }],
    });

    const song = one(rows.songs);
    expect(song.legacy_id).toBe(aVenit.ro);
    expect(versionsOf(rows.song_versions, song.id)).toEqual({
      ro: { title: "A venit Isus", text: "Îngeri mii" },
      uk: { title: "A venit Isus", text: "Тысячи ангелов" },
    });
    expect(one(rows.entries).song_id).toBe(song.id);
    expect(rows.plays.map((p) => p.song_id)).toEqual([song.id, song.id]);
  });

  test("a UA copy overwritten with another song moves to that song; a second translation is dropped", () => {
    const vine = "DgX6iJoei6aSvuDu8"; // its UA copy became "Iubirea-adâncă-a Tatălui"
    const iubirea = "GB48GpRSuNXMEem63";
    const vineUa = "zA88nXmT2aLWRoWhz";
    const { rows, report } = run({
      "norless.songs": [
        { _id: vine, title: "Vine duminica", text: "Din Galileea" },
        { _id: iubirea, title: "Iubirea-adâncă", text: "Iubirea-adâncă" },
      ],
      "norless-ua.songs": [
        { _id: vine, title: "Глубокая любовь", text: "Глубокая любовь" },
        { _id: iubirea, title: "Глубокая любовь", text: "Глубокая любовь!" },
        { _id: vineUa, title: "Vine duminica", text: "Из Галилеи" },
      ],
      "norless-ua.playlists": [{ _id: "p1", title: "Paște", position: 1 }],
      "norless-ua.entries": [
        { _id: "e1", playlist_id: "p1", klass: "song", identifier: vine },
      ],
    });

    const idOf = (old: string) =>
      rows.songs.find((s) => s.legacy_id === old)?.id;
    expect(versionsOf(rows.song_versions, idOf(vine)).uk?.text).toBe(
      "Из Галилеи",
    );
    expect(versionsOf(rows.song_versions, idOf(iubirea)).uk?.text).toBe(
      "Глубокая любовь!",
    );
    expect(rows.songs).toHaveLength(2);
    expect(report.samples.uaDuplicatesMerged).toEqual([vine]);
    expect(one(rows.entries).song_id).toBe(idOf(iubirea));
  });

  test("a Ukrainian carol kept in the RO app with its Romanian text in the UA app is swapped", () => {
    const { rows } = run({
      "norless.songs": [
        {
          _id: "xACnLPiYcabJhtQj7",
          title: "Добрий вечір",
          text: "Добрий вечір тобі",
        },
      ],
      "norless-ua.songs": [
        { _id: "LzSTnT9PYsQAzEgx3", title: "Добрий вечір", text: "Bună seara" },
      ],
    });

    expect(versionsOf(rows.song_versions, one(rows.songs).id)).toEqual({
      ro: { title: "Добрий вечір", text: "Bună seara" },
      uk: { title: "Добрий вечір", text: "Добрий вечір тобі" },
    });
  });

  test("in both, UA text in Cyrillic: Romanian and Ukrainian versions, combined title split", () => {
    const { rows, report } = run({
      "norless.songs": [
        { _id: "s1", title: "Duh Sfânt", text: "Vino, Duh Sfânt" },
      ],
      "norless-ua.songs": [
        {
          _id: "s1",
          title: "Duh Sfânt / Святий Дух",
          text: "Прийди, Святий Дух",
        },
      ],
    });

    expect(versionsOf(rows.song_versions, one(rows.songs).id)).toEqual({
      ro: { title: "Duh Sfânt", text: "Vino, Duh Sfânt" },
      uk: { title: "Святий Дух", text: "Прийди, Святий Дух" },
    });
    expect(report.notes.combinedTitleDiffersFromRo).toBeUndefined();
  });

  test("in both with identical text: only the Romanian version", () => {
    const { rows, report } = run({
      "norless.songs": [{ _id: "s1", title: "Isus", text: "Isus e Domn" }],
      "norless-ua.songs": [{ _id: "s1", title: "Isus", text: "Isus e Domn" }],
    });

    expect(
      Object.keys(versionsOf(rows.song_versions, one(rows.songs).id)),
    ).toEqual(["ro"]);
    expect(report.notes.untranslatedUaCopies).toBe(1);
  });

  test("in both with different non-Cyrillic text: Romanian version, reported for review", () => {
    const { rows, report } = run({
      "norless.songs": [{ _id: "s1", title: "Isus", text: "Isus e Domn" }],
      "norless-ua.songs": [{ _id: "s1", title: "Isus", text: "Isus e Domn!" }],
    });

    expect(
      Object.keys(versionsOf(rows.song_versions, one(rows.songs).id)),
    ).toEqual(["ro"]);
    expect(report.samples.differentUaTextWithoutCyrillic).toEqual(["s1"]);
  });

  test("empty songs are skipped, untitled ones get their first lyric line", () => {
    const { rows, report } = run({
      "norless.songs": [
        { _id: "empty", title: "", text: "  " },
        { _id: "untitled", title: "", text: "R:\nIsus, Tu ești lumina\nmea" },
      ],
    });

    expect(one(rows.songs).legacy_id).toBe("untitled");
    expect(one(rows.song_versions).title).toBe("Isus, Tu ești lumina");
    expect(report.notes).toMatchObject({
      emptySongsSkipped: 1,
      untitledSongs: 1,
    });
  });

  test("tags from both databases are merged and normalized", () => {
    const { rows } = run({
      "norless.songs": [
        { _id: "s1", title: "A", text: "a", tags: ["Crăciun", "laudă"] },
      ],
      "norless-ua.songs": [
        { _id: "s1", title: "A / А", text: "а", tags: ["craciun", "Різдво"] },
      ],
    });

    expect(one(rows.songs).tags).toBe('["craciun","lauda","різдво"]');
  });
});

test("an English song in the Romanian app becomes its English version", () => {
  const { rows } = run({
    "norless.songs": [
      {
        _id: "xjwMtb7jLqwMjEci6",
        title: "10.000 Reasons",
        text: "Bless the Lord",
      },
    ],
  });
  expect(versionsOf(rows.song_versions, one(rows.songs).id)).toEqual({
    en: { title: "10.000 Reasons", text: "Bless the Lord" },
  });
});
