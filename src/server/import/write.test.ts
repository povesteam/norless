import { describe, expect, test } from "vitest";
import { migrate, openDatabase } from "../db/db.js";
import { transform } from "./transform.js";
import { write } from "./write.js";

const data = new Map(
  Object.entries({
    "norless.congregations": [
      { _id: "unuunu", title: "Unu-Unu", creator: "u1", rights: {} },
    ],
    "norless.users": [
      { _id: "u1", username: "ana", emails: [{ address: "ana@example.com" }] },
    ],
    "norless.songs": [
      { _id: "s1", title: "Isus", text: "Isus e Domn", creator: "u1" },
    ],
    "norless.playlists": [
      { _id: "p1", title: "Duminică", position: 1790411208042, creator: "u1" },
    ],
    "norless.entries": [
      {
        _id: "e1",
        playlist_id: "p1",
        klass: "song",
        identifier: "s1",
        position: 1790411208043,
        username: "u1",
      },
    ],
    "norless.opens": [
      { _id: "o1", song_id: "s1", time: Date.parse("2026-09-27T07:30:00Z") },
    ],
  }),
);
const importAt = (iso: string) => transform(data, { now: new Date(iso) }).rows;
const count = (db: ReturnType<typeof openDatabase>, table: string) =>
  db.prepare(`SELECT count(*) FROM ${table}`).pluck().get();

describe("write", () => {
  test("imports every table, and a second import adds nothing", () => {
    const db = openDatabase(":memory:");
    migrate(db);

    expect(write(db, importAt("2026-10-01T00:00:00Z"))).toEqual({});
    const first = Object.fromEntries(
      ["users", "songs", "song_versions", "playlists", "entries", "plays"].map(
        (t) => [t, count(db, t)],
      ),
    );
    expect(first).toEqual({
      users: 1,
      songs: 1,
      song_versions: 1,
      playlists: 1,
      entries: 1,
      plays: 1,
    });

    expect(write(db, importAt("2026-10-02T00:00:00Z"))).toEqual({});
    expect(
      Object.fromEntries(Object.keys(first).map((t) => [t, count(db, t)])),
    ).toEqual(first);
    expect(db.prepare("SELECT imported_at FROM songs").pluck().get()).toBe(
      "2026-10-02T00:00:00.000Z",
    );
  });

  test("keeps a row that was changed in the app since the last import", () => {
    const db = openDatabase(":memory:");
    migrate(db);
    write(db, importAt("2026-10-01T00:00:00Z"));
    db.prepare(
      "UPDATE song_versions SET title = 'Isus, Domnul', updated_at = '2026-10-01T10:00:00.000Z'",
    ).run();

    expect(write(db, importAt("2026-10-02T00:00:00Z"))).toEqual({
      song_versions: 1,
    });
    expect(db.prepare("SELECT title FROM song_versions").pluck().get()).toBe(
      "Isus, Domnul",
    );
  });

  test("a song an earlier import made and this one doesn't is deleted, unless changed in the app", () => {
    const db = openDatabase(":memory:");
    migrate(db);
    const rows = importAt("2026-10-01T00:00:00Z");
    const song = (id: string) => ({ ...rows.songs[0], id, legacy_id: id });
    write(db, {
      ...rows,
      songs: [...rows.songs, song("gone"), song("edited")],
    });
    db.prepare(
      "UPDATE songs SET updated_at = '2026-10-01T10:00:00.000Z' WHERE id = 'edited'",
    ).run();

    write(db, importAt("2026-10-02T00:00:00Z"));
    expect(
      db
        .prepare("SELECT id FROM songs WHERE deleted_at IS NULL ORDER BY id")
        .pluck()
        .all(),
    ).toEqual(["edited", rows.songs[0]?.id].sort());
  });

  test("the imported community starts with Classic's set, and a re-import keeps the owner's switches", () => {
    const db = openDatabase(":memory:");
    migrate(db);
    write(db, importAt("2026-10-01T00:00:00Z"));
    const switches = () =>
      db.prepare("SELECT switches FROM communities").pluck().get();
    expect(switches()).toBe("{}");
    db.prepare(
      `UPDATE communities SET switches = '{"appFrame":true}', updated_at = '2026-10-01T10:00:00.000Z'`,
    ).run();

    write(db, importAt("2026-10-02T00:00:00Z"));
    expect(switches()).toBe('{"appFrame":true}');
  });
});
