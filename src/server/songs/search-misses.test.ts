import { beforeEach, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import { foldQuery } from "./search-misses.js";
import { indexSongs } from "./search.js";

let db: Db;
let app: ReturnType<typeof buildApp>;
let sessions: Record<string, string>;

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', 'x', 'x');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('ed', 'Ed', 'ed@example.com', 'active', 'x', 'x'),
      ('mu', 'Mu', 'mu@example.com', 'active', 'x', 'x');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m1', 'c', 'ed', '["editor"]', 'active', 'x', 'x'),
      ('m2', 'c', 'mu', '["team"]', 'active', 'x', 'x');
    INSERT INTO songs (id, community_id, tags, created_at, updated_at) VALUES ('s', 'c', '[]', 'x', 'x');
    INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
      ('v', 'c', 's', 'ro', 'Har minunat', '1:\\nHar minunat', 'x', 'x');
  `);
  indexSongs(db);
  sessions = { ed: createSession(db, "ed"), mu: createSession(db, "mu") };
  app = buildApp({ db, logger: false });
});

const miss = (q: string) =>
  app.inject({
    method: "POST",
    url: "/api/communities/unu-unu/search-misses",
    payload: { q },
  });
const list = (as: string) =>
  app.inject({
    url: "/api/communities/unu-unu/search-misses",
    headers: { cookie: `__Host-session=${sessions[as]}` },
  });

test("searches that found nothing are counted together, without who searched", async () => {
  await miss("Oceane");
  await miss("oceane ");
  await miss("Oceáne");
  await miss("Cântare nouă");
  // It finds a song or a Bible passage: no miss.
  await miss("har minunat");
  await miss("Ioan 3:16");
  const misses = (await list("ed")).json<{ query: string; times: number }[]>();
  expect(misses.map((m) => [m.query, m.times])).toEqual([
    ["Oceáne", 3],
    ["Cântare nouă", 1],
  ]);
  expect(db.prepare("SELECT count(*) FROM search_misses").pluck().get()).toBe(
    4,
  );
  expect(foldQuery("  Cântare   Nouă ")).toBe("cantare noua");
});

test("a song added since leaves the list, and only editors and owners read it", async () => {
  await miss("Oceane");
  db.exec(`
    INSERT INTO songs (id, community_id, tags, created_at, updated_at) VALUES ('o', 'c', '[]', 'x', 'x');
    INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
      ('vo', 'c', 'o', 'ro', 'Oceane', 'Oceane', 'x', 'x');
  `);
  indexSongs(db, ["o"]);
  expect((await list("ed")).json()).toEqual([]);
  expect((await list("mu")).statusCode).toBe(403);
});
