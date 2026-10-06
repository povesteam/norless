import type { Document } from "bson";
import { describe, expect, test } from "vitest";
import { legacyId } from "./mapping.js";
import { archive, now, one } from "./test-helpers.js";
import { transform } from "./transform.js";

describe("the oplog's history (import-oplog)", () => {
  const t0 = Date.parse("2016-07-30T15:00:00Z") / 1000;
  const at = (seconds: number) => new Date((t0 + seconds) * 1000).toISOString();
  let i = 0;
  const op = (
    seconds: number,
    kind: string,
    ns: string,
    o: Document,
    o2?: Document,
  ) => ({
    ts: { t: t0 + seconds, i: i++ },
    op: kind,
    ns,
    o,
    ...(o2 && { o2 }),
  });
  const users = [
    { _id: "u1", username: "Ana", emails: [{ address: "ana@example.com" }] },
    { _id: "u2", username: "Ed", emails: [{ address: "ed@example.com" }] },
  ];
  const song = {
    _id: "s1",
    title: "Har",
    text: "1:\nVechi",
    key_signature: "Re",
  };
  const data = {
    "norless.users": users,
    "norless.songs": [{ ...song, text: "1:\nNou", key_signature: "Mi" }],
    "norless.playlists": [{ _id: "p1", title: "Duminică", position: 1 }],
    "norless.entries": [
      {
        _id: "e1",
        playlist_id: "p1",
        klass: "song",
        identifier: "s1",
        position: 1,
        username: "u1",
      },
      {
        _id: "e2",
        playlist_id: "p1",
        klass: "song",
        identifier: "s1",
        position: 2,
        username: "u1",
        deleted: { username: "u2" },
      },
    ],
    "norless.opens": [{ _id: "o1", song_id: "s1", time: (t0 + 90_000) * 1000 }],
  };
  const oplog = [
    // The 2016 restore: not new records.
    op(0, "i", "norless.songs", song),
    op(
      7200,
      "u",
      "norless.songs",
      { $set: { text: "1:\nNou" } },
      { _id: "s1" },
    ),
    op(7300, "u", "norless.songs", { $set: { open_list: [] } }, { _id: "s1" }),
    op(
      8000,
      "u",
      "norless.songs",
      { $set: { key_signature: "Mi" } },
      { _id: "s1" },
    ),
    op(80_000, "i", "norless.playlists", { _id: "p1", title: "Duminică" }),
    op(80_100, "i", "norless.entries", { _id: "e1" }),
    op(80_200, "i", "norless.entries", { _id: "e2" }),
    op(
      80_300,
      "u",
      "norless.entries",
      { $set: { deleted: { username: "u2" } } },
      { _id: "e2" },
    ),
    op(
      90_000,
      "u",
      "norless.live_object",
      {
        $set: {
          entry_id: "e1",
          klass: "song",
          identifier: "s1",
          slide_index: 0,
          username: "u1",
        },
      },
      { _id: "unuunu" },
    ),
    op(
      90_060,
      "u",
      "norless.live_object",
      { $set: { slide_index: 1 } },
      { _id: "unuunu" },
    ),
    op(
      90_090,
      "u",
      "norless.live_object",
      { $set: { username: "u2" } },
      { _id: "unuunu" },
    ),
    op(
      90_300,
      "u",
      "norless.live_object",
      { $set: { entry_id: "", klass: "", identifier: "" } },
      { _id: "unuunu" },
    ),
  ];
  const { rows } = transform(archive(data), { now, oplog });

  test("each save of a song keeps the song as it was before, keys in letters", () => {
    expect(
      rows.song_revisions.map((r) => [
        r.created_at,
        r.key_signature,
        JSON.parse(String(r.versions))[0].lyrics,
      ]),
    ).toEqual([
      [at(7200), "D", "1:\nVechi"],
      [at(8000), "D", "1:\nNou"],
    ]);
  });

  test("playlists and entries get their real times, and a dropped entry who dropped it", () => {
    expect(one(rows.playlists).created_at).toBe(at(80_000));
    const [kept, dropped] = rows.entries;
    expect(kept?.created_at).toBe(at(80_100));
    expect(dropped).toMatchObject({
      deleted_at: at(80_300),
      updated_by: legacyId("shared", "users", "ed@example.com"),
    });
  });

  test("every slide the screens showed, who showed it, and the play's end", () => {
    expect(
      rows.slide_log.map((s) => [s.at, s.slide, s.blank, s.song_id !== null]),
    ).toEqual([
      [at(90_000), 0, 0, true],
      [at(90_060), 1, 0, true],
      [at(90_300), 0, 1, false],
    ]);
    expect(rows.slide_log[0]?.created_by).toBe(
      legacyId("shared", "users", "ana@example.com"),
    );
    expect(one(rows.plays).ended_at).toBe(at(90_300));
  });
});
