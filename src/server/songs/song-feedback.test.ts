import { beforeEach, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import { deleteAccount } from "../auth/members.js";
import type { SearchResult } from "./search.js";
import type { ExcludedSong, ReviewedSong } from "./song-feedback.js";
import type { Song } from "./songs.js";
import { indexSongs } from "./search.js";

let db: Db;
const people = ["pavel", "ana", "ion", "maria"] as const;
type Person = (typeof people)[number];
let sessions: Record<Person, string>;

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', 'x', 'x');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('pavel', 'Pavel', 'pavel@example.com', 'active', 'x', 'x'),
      ('ana', 'Ana', 'ana@example.com', 'active', 'x', 'x'),
      ('ion', 'Ion', 'ion@example.com', 'active', 'x', 'x'),
      ('maria', 'Maria', 'maria@example.com', 'active', 'x', 'x');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m-pavel', 'c', 'pavel', '["owner"]', 'active', 'x', 'x'),
      ('m-ana', 'c', 'ana', '[]', 'active', 'x', 'x'),
      ('m-ion', 'c', 'ion', '["team"]', 'active', 'x', 'x'),
      ('m-maria', 'c', 'maria', '["editor"]', 'active', 'x', 'x');
    INSERT INTO songs (id, community_id, key_signature, tags, created_at, updated_at) VALUES
      ('har', 'c', 'G', '[]', 'x', 'x'), ('isus', 'c', 'D', '[]', 'x', 'x'),
      ('cer', 'c', 'A', '[]', 'x', 'x');
    INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
      ('v1', 'c', 'har', 'ro', 'Har minunat', 'Har minunat', 'x', 'x'),
      ('v2', 'c', 'isus', 'ro', 'Isus e Domn', 'Isus e Domn', 'x', 'x'),
      ('v3', 'c', 'cer', 'ro', 'Cerul', 'Cerul e sus', 'x', 'x');
  `);
  indexSongs(db);
  sessions = Object.fromEntries(
    people.map((p) => [p, createSession(db, p)]),
  ) as typeof sessions;
});

const call = async (
  as: Person | null,
  method: "GET" | "PUT",
  path: string,
  payload?: object,
) => {
  const response = await buildApp({ db, logger: false }).inject({
    method,
    url: `/api/communities/unu-unu${path}`,
    headers: as ? { cookie: `__Host-session=${sessions[as]}` } : {},
    payload,
  });
  return {
    status: response.statusCode,
    body: response.body ? response.json() : null,
  };
};
const vote = (
  as: Person | null,
  song: string,
  opinion: string | null,
  reason?: string,
) => call(as, "PUT", `/songs/${song}/opinion`, { opinion, reason });
const song = async (as: Person | null, id: string) =>
  (await call(as, "GET", `/songs/${id}`)).body as Song;
const results = async (as: Person | null, q: string) =>
  (
    (await call(as, "GET", `/search?q=${encodeURIComponent(q)}`)).body as {
      results: SearchResult[];
    }
  ).results.flatMap((r) => (r.type === "song" ? [r] : []));

test("members like or dislike a song once, change their mind, or take it back", async () => {
  expect((await vote("ana", "har", "like")).status).toBe(200);
  await vote("ion", "har", "like");
  expect(
    (await vote("ana", "har", "dislike", " too high ")).body,
  ).toMatchObject({
    likes: 1,
    dislikes: 1,
    mine: "dislike",
    reason: "too high",
  });
  // A like carries no reason, even if one is sent.
  await vote("ana", "har", "like", "ignored");
  expect((await song("ana", "har")).opinions).toEqual({
    likes: 2,
    dislikes: 0,
    mine: "like",
    reason: "",
  });
  await vote("ana", "har", null);
  expect((await song("ana", "har")).opinions?.likes).toBe(1);
});

test("owners read the reasons with names; members and visitors don't", async () => {
  await vote("ana", "har", "dislike", "too high");
  await vote("ion", "har", "dislike");
  expect((await song("pavel", "har")).opinions?.reasons).toEqual([
    { name: "Ana", reason: "too high" },
  ]);
  expect((await song("ion", "har")).opinions).not.toHaveProperty("reasons");
  expect((await song(null, "har")).opinions).toBeUndefined();
  expect((await vote(null, "har", "like")).status).toBe(401);
});

test("only members still in the community count, and deleting one's account deletes them", async () => {
  await vote("ana", "har", "like");
  await vote("ion", "har", "like");
  db.exec("UPDATE members SET status = 'removed' WHERE id = 'm-ion'");
  expect((await song("pavel", "har")).opinions?.likes).toBe(1);
  expect(deleteAccount(db, "ana")).toBe("ok");
  expect(
    db
      .prepare("SELECT count(*) FROM song_opinions WHERE user_id = 'ana'")
      .pluck()
      .get(),
  ).toBe(0);
});

test("the empty search lists the songs a member likes first, with a heart", async () => {
  await vote("ion", "cer", "like");
  const browse = await results("ion", "");
  expect(browse[0]).toMatchObject({ id: "cer", liked: true });
  expect(browse.map((r) => r.id).sort()).toEqual(["cer", "har", "isus"]);
  expect(browse.filter((r) => r.liked)).toHaveLength(1);
  // Searching marks them too; nobody else's likes show.
  expect((await results("ion", "cerul"))[0]).toMatchObject({ liked: true });
  expect((await results("ana", "cerul"))[0]).not.toHaveProperty("liked");
});

test("owners exclude a song with a reason: search leaves it out, its page says why", async () => {
  expect(
    (await call("ion", "PUT", "/songs/isus/exclusion", { reason: "x" })).status,
  ).toBe(403);
  expect(
    (await call("pavel", "PUT", "/songs/isus/exclusion", { reason: "  " }))
      .status,
  ).toBe(400);
  expect(
    (
      await call("pavel", "PUT", "/songs/isus/exclusion", {
        reason: "Against our doctrine",
      })
    ).status,
  ).toBe(204);
  expect(await results(null, "isus")).toEqual([]);
  expect((await results(null, "")).map((r) => r.id)).not.toContain("isus");
  expect((await song(null, "isus")).excluded).toMatchObject({
    reason: "Against our doctrine",
  });
  // A liked song that is excluded isn't offered either.
  await vote("ana", "isus", "like");
  expect((await results("ana", "")).map((r) => r.id)).not.toContain("isus");

  await call("pavel", "PUT", "/songs/isus/exclusion", { reason: null });
  expect((await results(null, "isus")).map((r) => r.id)).toEqual(["isus"]);
  expect((await song(null, "isus")).excluded).toBeNull();
});

test("the owners' Songs tab: the most disliked first, then the excluded ones", async () => {
  await vote("ana", "har", "dislike", "too high");
  await vote("ion", "cer", "dislike");
  await vote("maria", "cer", "dislike", "slow");
  await vote("pavel", "cer", "like");
  await call("pavel", "PUT", "/songs/isus/exclusion", {
    reason: "Against our doctrine",
  });
  expect((await call("ion", "GET", "/song-feedback")).status).toBe(403);
  const { disliked, excluded } = (await call("pavel", "GET", "/song-feedback"))
    .body as { disliked: ReviewedSong[]; excluded: ExcludedSong[] };
  expect(disliked).toEqual([
    {
      id: "cer",
      title: "Cerul",
      likes: 1,
      dislikes: 2,
      reasons: [{ name: "Maria", reason: "slow" }],
    },
    {
      id: "har",
      title: "Har minunat",
      likes: 0,
      dislikes: 1,
      reasons: [{ name: "Ana", reason: "too high" }],
    },
  ]);
  expect(excluded).toEqual([
    {
      id: "isus",
      title: "Isus e Domn",
      reason: "Against our doctrine",
      by: "Pavel",
      at: expect.any(String),
    },
  ]);
});
