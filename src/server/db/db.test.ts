import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { deleteAccount } from "../auth/members.js";
import { type Db, migrate, openDatabase } from "./db.js";
import { indexSongs } from "../songs/search.js";

const tables = [
  "communities",
  "entries",
  "members",
  "pages",
  "playlists",
  "plays",
  "rooms",
  "schedule_events",
  "screen_connections",
  "screens",
  "sessions",
  "song_versions",
  "songs",
  "usage_events",
  "users",
];

describe("openDatabase", () => {
  test("enables WAL, foreign keys and a busy timeout", () => {
    const db = openDatabase(
      join(mkdtempSync(join(tmpdir(), "norless-")), "test.db"),
    );

    expect(db.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(db.pragma("busy_timeout", { simple: true })).toBe(5000);
  });
});

describe("migrate", () => {
  test("applies each migration once, in order", () => {
    const dir = mkdtempSync(join(tmpdir(), "norless-migrations-"));
    writeFileSync(
      join(dir, "002-second.sql"),
      "INSERT INTO log VALUES ('second');",
    );
    writeFileSync(
      join(dir, "001-first.sql"),
      "CREATE TABLE log (step TEXT) STRICT; INSERT INTO log VALUES ('first');",
    );
    const db = openDatabase(":memory:");

    expect(migrate(db, dir)).toEqual(["001-first.sql", "002-second.sql"]);
    expect(migrate(db, dir)).toEqual([]);
    expect(db.prepare("SELECT step FROM log").pluck().all()).toEqual([
      "first",
      "second",
    ]);
  });

  test("a failing migration leaves nothing behind", () => {
    const dir = mkdtempSync(join(tmpdir(), "norless-migrations-"));
    writeFileSync(
      join(dir, "001-broken.sql"),
      "CREATE TABLE half (x TEXT) STRICT; NOT SQL;",
    );
    const db = openDatabase(":memory:");

    expect(() => migrate(db, dir)).toThrow();
    expect(
      db
        .prepare("SELECT count(*) FROM sqlite_master WHERE name = 'half'")
        .pluck()
        .get(),
    ).toBe(0);
    expect(
      db.prepare("SELECT count(*) FROM schema_migrations").pluck().get(),
    ).toBe(0);
  });

  test("the real migrations create every table and enforce foreign keys", () => {
    const db = openDatabase(":memory:");
    migrate(db);

    const names = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
      )
      .pluck()
      .all();
    expect(names).toEqual(expect.arrayContaining(tables));

    const now = new Date().toISOString();
    expect(() =>
      db
        .prepare(
          "INSERT INTO entries (id, community_id, playlist_id, position, kind, text, created_at, updated_at) VALUES ('e', 'missing', 'missing', 1, 'divider', 'x', ?, ?)",
        )
        .run(now, now),
    ).toThrow(/FOREIGN KEY/);
  });

  test("a migration can rebuild a table others refer to, and foreign keys stay on", () => {
    const dir = mkdtempSync(join(tmpdir(), "norless-migrations-"));
    writeFileSync(
      join(dir, "001-tables.sql"),
      `CREATE TABLE parent (id TEXT PRIMARY KEY, kind TEXT CHECK (kind IN ('a'))) STRICT;
       CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT REFERENCES parent (id)) STRICT;
       INSERT INTO parent VALUES ('p', 'a'); INSERT INTO child VALUES ('c', 'p');`,
    );
    writeFileSync(
      join(dir, "002-rebuild.sql"),
      `CREATE TABLE parent__new (id TEXT PRIMARY KEY, kind TEXT) STRICT;
       INSERT INTO parent__new SELECT * FROM parent;
       DROP TABLE parent;
       ALTER TABLE parent__new RENAME TO parent;`,
    );
    const db = openDatabase(":memory:");

    expect(migrate(db, dir)).toEqual(["001-tables.sql", "002-rebuild.sql"]);
    db.prepare("INSERT INTO parent VALUES ('q', 'b')").run();
    expect(db.prepare("SELECT parent_id FROM child").pluck().get()).toBe("p");
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(() =>
      db.prepare("INSERT INTO child VALUES ('d', 'missing')").run(),
    ).toThrow(/FOREIGN KEY/);
  });

  test("a migration that breaks a reference is undone", () => {
    const dir = mkdtempSync(join(tmpdir(), "norless-migrations-"));
    writeFileSync(
      join(dir, "001-tables.sql"),
      `CREATE TABLE parent (id TEXT PRIMARY KEY) STRICT;
       CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT REFERENCES parent (id)) STRICT;
       INSERT INTO parent VALUES ('p'); INSERT INTO child VALUES ('c', 'p');`,
    );
    writeFileSync(join(dir, "002-orphan.sql"), "DELETE FROM parent;");
    const db = openDatabase(":memory:");

    expect(() => migrate(db, dir)).toThrow(/002-orphan.sql leaves 1 broken/);
    expect(db.prepare("SELECT count(*) FROM parent").pluck().get()).toBe(1);
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
  });

  test("the schema keeps its rules in code: no CHECK constraints, no triggers", () => {
    const db = openDatabase(":memory:");
    migrate(db);

    expect(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE sql LIKE '%CHECK (%' OR sql LIKE '%CHECK(%' OR type = 'trigger'",
        )
        .pluck()
        .all(),
    ).toEqual([]);
  });
});

describe("the search index", () => {
  const now = "2026-09-30T10:00:00.000Z";
  const addVersion = (db: Db, id: string, title: string, text: string) => {
    db.prepare(
      "INSERT OR IGNORE INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES ('c', 'community', 'C', '[]', 'UTC', ?, ?)",
    ).run(now, now);
    db.prepare(
      "INSERT INTO songs (id, community_id, created_at, updated_at) VALUES (?, 'c', ?, ?)",
    ).run(id, now, now);
    db.prepare(
      "INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES (?, 'c', ?, 'ro', ?, ?, ?, ?)",
    ).run(id, id, title, text, now, now);
    indexSongs(db, [id]);
  };
  const search = (db: Db, query: string) =>
    db
      .prepare(
        "SELECT version_id FROM songs_fts WHERE songs_fts MATCH ? ORDER BY version_id",
      )
      .pluck()
      .all(query);

  test("matches titles and lyrics without diacritics or case", () => {
    const db = openDatabase(":memory:");
    migrate(db);
    addVersion(db, "title", "Isus e Domn", "Cântăm cu bucurie");
    addVersion(db, "lyrics", "Altă cântare", "Mărturisim:\nIsus e Domn!");
    addVersion(db, "uk", "Святий Бог", "Хвала Тобі");

    expect(search(db, "isus e domn")).toEqual(["lyrics", "title"]);
    expect(search(db, "cantam")).toEqual(["title"]);
    expect(search(db, "святий")).toEqual(["uk"]);
  });

  test("leaves out chords, section names and notes", () => {
    const db = openDatabase(":memory:");
    migrate(db);
    addVersion(
      db,
      "song",
      "Cântare",
      "R:\n! unison fete\n.Am      G\nSlavă Ție\n\nR",
    );

    expect(search(db, "slava")).toEqual(["song"]);
    expect(search(db, "Am")).toEqual([]);
    expect(search(db, "R")).toEqual([]);
    expect(search(db, "unison")).toEqual([]);
  });

  test("follows the texts the code writes; a full rebuild drops what's gone", () => {
    const db = openDatabase(":memory:");
    migrate(db);
    addVersion(db, "song", "Vechi", "Text vechi");

    db.prepare(
      "UPDATE song_versions SET title = 'Nou', lyrics = 'Text nou' WHERE id = 'song'",
    ).run();
    indexSongs(db, ["song"]);
    expect(search(db, "vechi")).toEqual([]);
    expect(search(db, "nou")).toEqual(["song"]);

    db.prepare("DELETE FROM song_versions WHERE id = 'song'").run();
    indexSongs(db);
    expect(search(db, "nou")).toEqual([]);
  });
});

test("deleting an account keeps its usage events without its id", () => {
  const db = openDatabase(":memory:");
  migrate(db);
  db.prepare(
    "INSERT INTO users (id, display_name, status, created_at, updated_at) VALUES ('ana', 'Ana', 'active', 'x', 'x')",
  ).run();
  const insert = db.prepare(
    "INSERT INTO usage_events (id, at, user_id, device_type, feature, detail) VALUES (?, 'x', ?, 'laptop', 'live.go', '{\"via\":\"enter\"}')",
  );
  insert.run("e1", "ana");
  insert.run("e2", null);
  expect(deleteAccount(db, "ana")).toBe("ok");
  expect(
    db.prepare("SELECT id, user_id FROM usage_events ORDER BY id").all(),
  ).toEqual([
    { id: "e1", user_id: null },
    { id: "e2", user_id: null },
  ]);
});
