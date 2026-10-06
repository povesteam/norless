import { beforeEach, expect, test } from "vitest";
import { buildApp } from "./app.js";
import { createSession } from "./auth/auth.js";
import { listChanges, runAs, startChangeLog } from "./changes.js";
import { type Db, migrate, openDatabase } from "./db/db.js";
import { deleteAccount } from "./auth/members.js";

let db: Db;

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', 'x', 'x');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('ana', 'Ana', 'ana@example.com', 'active', 'x', 'x'),
      ('ed', 'Ed', 'ed@example.com', 'active', 'x', 'x');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m-ana', 'c', 'ana', '["owner"]', 'active', 'x', 'x'),
      ('m-ed', 'c', 'ed', '["editor"]', 'active', 'x', 'x');
    INSERT INTO songs (id, community_id, key_signature, time_signature, tags, created_at, updated_at) VALUES
      ('song', 'c', 'G', '3/4', '[]', 'x', 'x');
    INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
      ('v', 'c', 'song', 'ro', 'Har', '1:\nText', 'x', 'x');
  `);
  startChangeLog(db);
});

const logged = () =>
  db
    .prepare(
      "SELECT table_name AS tableName, row_id AS rowId, action, user_id AS userId, community_id AS communityId, row, changed FROM changes ORDER BY rowid",
    )
    .all() as {
    tableName: string;
    rowId: string;
    action: string;
    userId: string | null;
    communityId: string | null;
    row: string;
    changed: string | null;
  }[];

test("an insert, an update and a delete are logged with who made them", () => {
  runAs("ed", () => {
    db.prepare(
      "INSERT INTO playlists (id, community_id, title, created_at, updated_at) VALUES ('p', 'c', 'Duminică', '2026-10-04T08:00:00.000Z', '2026-10-04T08:00:00.000Z')",
    ).run();
    db.prepare(
      "UPDATE playlists SET title = 'Duminica', updated_at = 'y' WHERE id = 'p'",
    ).run();
    db.prepare("DELETE FROM playlists WHERE id = 'p'").run();
  });

  const [insert, update, remove] = logged();
  expect(insert).toMatchObject({
    tableName: "playlists",
    rowId: "p",
    action: "insert",
    userId: "ed",
    communityId: "c",
    changed: null,
  });
  expect(JSON.parse(insert?.row ?? "")).toMatchObject({ title: "Duminică" });
  expect(JSON.parse(update?.changed ?? "")).toEqual({
    title: ["Duminică", "Duminica"],
  });
  expect(remove).toMatchObject({ action: "delete" });
  expect(JSON.parse(remove?.row ?? "")).toMatchObject({ title: "Duminica" });
});

test("a save that changes nothing but its time isn't logged, and Norless itself has no user", () => {
  db.prepare("UPDATE songs SET updated_at = 'later' WHERE id = 'song'").run();
  expect(logged()).toEqual([]);

  db.prepare("UPDATE songs SET key_signature = 'A' WHERE id = 'song'").run();
  expect(logged()).toMatchObject([{ action: "update", userId: null }]);
});

test("secrets and columns that change on their own stay out", () => {
  db.exec(`
    INSERT INTO rooms (id, community_id, name, created_at, updated_at) VALUES ('r', 'c', 'Sala', 'x', 'x');
    INSERT INTO screens (id, community_id, room_id, name, type, languages, secret, position, created_at, updated_at)
      VALUES ('s', 'c', 'r', 'Proiector', 'projector', '["ro"]', 'hush', 1, 'x', 'x');
  `);
  db.prepare("UPDATE screens SET secret = 'new' WHERE id = 's'").run();
  db.prepare(`UPDATE rooms SET live = '{"slide":1}' WHERE id = 'r'`).run();

  const rows = logged();
  expect(rows.map((r) => [r.tableName, r.action])).toEqual([
    ["rooms", "insert"],
    ["screens", "insert"],
  ]);
  expect(rows[1]?.row).not.toContain("hush");
});

test("a community's own changes belong to it", () => {
  db.prepare("UPDATE communities SET name = 'Unu Unu' WHERE id = 'c'").run();
  expect(logged()).toMatchObject([
    { tableName: "communities", communityId: "c" },
  ]);
});

test("owners list the changes newest first, by kind or person, named as people know them", () => {
  runAs("ed", () =>
    db
      .prepare("UPDATE song_versions SET title = 'Har mare' WHERE id = 'v'")
      .run(),
  );
  runAs("ana", () =>
    db
      .prepare("UPDATE members SET roles = '[\"team\"]' WHERE id = 'm-ed'")
      .run(),
  );

  const all = listChanges(db, "c").changes;
  expect(all.map((c) => [c.kind, c.label, c.user?.name])).toEqual([
    ["members", "Ed", "Ana"],
    ["songs", "Har mare", "Ed"],
  ]);
  expect(listChanges(db, "c", { kind: "songs" }).changes).toHaveLength(1);
  expect(listChanges(db, "c", { user: "ana" }).changes).toHaveLength(1);
});

test("a request's changes are its user's, and only owners read them", async () => {
  const sessions = {
    ana: createSession(db, "ana"),
    ed: createSession(db, "ed"),
  };
  const app = buildApp({ db, logger: false });
  const as = (user: keyof typeof sessions) => ({
    cookie: `__Host-session=${sessions[user]}`,
  });

  const saved = await app.inject({
    method: "PUT",
    url: "/api/communities/unu-unu/songs/song",
    headers: as("ed"),
    payload: {
      keySignature: "A",
      timeSignature: "3/4",
      tags: [],
      versions: [
        {
          language: "ro",
          title: "Har",
          text: "1:\nText nou",
          baseText: "1:\nText",
        },
      ],
    },
  });
  expect(saved.statusCode).toBe(200);

  const read = await app.inject({
    url: "/api/communities/unu-unu/changes?kind=songs",
    headers: as("ana"),
  });
  const { changes } = read.json() as {
    changes: { user: { name: string }; changed: Record<string, unknown> }[];
  };
  expect(changes.length).toBeGreaterThan(0);
  expect(changes.every((c) => c.user.name === "Ed")).toBe(true);
  expect(changes.flatMap((c) => Object.keys(c.changed ?? {}))).toEqual(
    expect.arrayContaining(["key_signature", "lyrics"]),
  );

  const refused = await app.inject({
    url: "/api/communities/unu-unu/changes",
    headers: as("ed"),
  });
  expect(refused.statusCode).toBe(403);
});

test("a deleted account's changes stay, without who made them", () => {
  runAs("ed", () =>
    db.prepare("UPDATE songs SET key_signature = 'C' WHERE id = 'song'").run(),
  );
  expect(deleteAccount(db, "ed")).toBe("ok");
  expect(
    db
      .prepare("SELECT count(*) FROM changes WHERE user_id = 'ed'")
      .pluck()
      .get(),
  ).toBe(0);
  expect(
    db
      .prepare("SELECT count(*) FROM changes WHERE table_name = 'songs'")
      .pluck()
      .get(),
  ).toBe(1);
});

test("each change tells its table and community, logged or not; a time-only save tells nothing", () => {
  const told: [string, string | null][] = [];
  startChangeLog(db, (table, community) => told.push([table, community]));

  db.prepare("UPDATE songs SET updated_at = 'later' WHERE id = 'song'").run();
  db.prepare("UPDATE songs SET key_signature = 'A' WHERE id = 'song'").run();
  db.prepare(
    "INSERT INTO plays (id, community_id, song_id, mode, played_at, created_at, updated_at) VALUES ('p', 'c', 'song', 'service', 'x', 'x', 'x')",
  ).run();

  expect(told).toEqual([
    ["songs", "c"],
    ["plays", "c"],
  ]);
  expect(logged().map((r) => r.tableName)).toEqual(["songs"]);
});
