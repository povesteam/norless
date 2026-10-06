import type { Document } from "bson";
import { describe, expect, test } from "vitest";
import { one, run } from "./test-helpers.js";

describe("playlists and entries", () => {
  const songs = {
    "norless.songs": [
      { _id: "s1", title: "A", text: "a" },
      { _id: "empty", title: "", text: "" },
    ],
  };
  const entry = (
    id: string,
    playlist: string,
    klass: string | null,
    identifier: string,
    position: number,
    extra: Document = {},
  ) => ({
    _id: id,
    playlist_id: playlist,
    klass,
    identifier,
    position,
    username: "u1",
    ...extra,
  });

  test("identical copies in both databases become one playlist", () => {
    const entries = [entry("e1", "p1", "song", "s1", 1)];
    const { rows, report } = run({
      ...songs,
      "norless.playlists": [
        { _id: "p1", title: "4 Mai 2021", position: 1620111600000 },
      ],
      "norless-ua.playlists": [
        { _id: "p1", title: "4 Mai 2021", position: 1620111600000 },
      ],
      "norless.entries": entries,
      "norless-ua.entries": entries,
    });

    // Only a date: untitled, dated.
    expect(one(rows.playlists)).toMatchObject({
      title: null,
      service_date: "2021-05-04",
    });
    expect(rows.entries).toHaveLength(1);
    expect(report.notes.playlistsInBothMerged).toBe(1);
  });

  test("different copies stay separate, the Ukrainian one marked (UA)", () => {
    const { rows } = run({
      ...songs,
      "norless.playlists": [
        { _id: "p1", title: "4 Mai 2021 seara", position: 1 },
      ],
      "norless-ua.playlists": [
        { _id: "p1", title: "4 Mai 2021 seara", position: 1 },
      ],
      "norless.entries": [entry("e1", "p1", "song", "s1", 1)],
      "norless-ua.entries": [
        entry("e1", "p1", "song", "s1", 1),
        entry("e2", "p1", "divider", "Cina", 2),
      ],
    });

    expect(rows.playlists.map((p) => p.title)).toEqual(["seara", "seara (UA)"]);
    expect(rows.entries).toHaveLength(3);
  });

  test("entries keep their kind, order and soft delete; bad ones are skipped and counted", () => {
    const { rows, report } = run({
      ...songs,
      "norless.playlists": [{ _id: "p1", title: "Duminică", position: 1 }],
      "norless.entries": [
        entry("e3", "p1", "divider", " Cina Domnului ", 3),
        entry("e1", "p1", "song", "s1", 1, { deleted: { username: "u1" } }),
        entry("e2", "p1", "bible", "b43_3_18_16", 2),
        entry("e4", "p1", null, "x", 4),
        entry("e5", "p1", "song", "empty", 5),
        entry("e6", "p1", "song", "gone", 6),
      ],
    });

    expect(
      rows.entries.map((e) => [
        e.legacy_id,
        e.kind,
        e.position,
        e.deleted_at !== null,
      ]),
    ).toEqual([
      ["e1", "song", 1, true],
      ["e2", "bible", 2, false],
      ["e3", "divider", 3, false],
    ]);
    expect(rows.entries[1]).toMatchObject({
      bible_book: 43,
      bible_chapter: 3,
      bible_verse_from: 16,
      bible_verse_to: 18,
    });
    expect(rows.entries[2]?.text).toBe("Cina Domnului");
    expect(report.notes).toMatchObject({
      entriesWithoutKindSkipped: 1,
      entriesToEmptySongsSkipped: 1,
      entriesToMissingSongsSkipped: 1,
    });
  });
});
