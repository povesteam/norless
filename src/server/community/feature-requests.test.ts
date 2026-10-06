import { beforeEach, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import type { FeatureRequests } from "./feature-requests.js";
import { deleteAccount } from "../auth/members.js";

let db: Db;
const people = ["pavel", "ana", "ion", "stranger"] as const;
let sessions: Record<(typeof people)[number], string>;

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro","uk"]', 'Europe/Bucharest', 'x', 'x');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('pavel', 'Pavel', 'pavel@example.com', 'active', 'x', 'x'),
      ('ana', 'Ana', 'ana@example.com', 'active', 'x', 'x'),
      ('ion', 'Ion', 'ion@example.com', 'active', 'x', 'x'),
      ('stranger', 'St', 'st@example.com', 'active', 'x', 'x');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m-pavel', 'c', 'pavel', '["owner"]', 'active', 'x', 'x'),
      ('m-ana', 'c', 'ana', '[]', 'active', 'x', 'x'),
      ('m-ion', 'c', 'ion', '["team"]', 'active', 'x', 'x');
  `);
  sessions = Object.fromEntries(
    people.map((p) => [p, createSession(db, p)]),
  ) as typeof sessions;
});

test("members ask for features; everyone sees how many, owners see who", async () => {
  const app = buildApp({ db, logger: false });
  const call = (
    who: (typeof people)[number] | null,
    method: "GET" | "PUT" | "DELETE",
    feature = "",
    note?: string,
  ) =>
    app.inject({
      method,
      url: `/api/communities/unu-unu/feature-requests${feature && `/${feature}`}`,
      headers: who ? { cookie: `__Host-session=${sessions[who]}` } : {},
      ...(method === "PUT" && { payload: note === undefined ? {} : { note } }),
    });

  // A feature that's built and off, and one that's planned.
  expect(
    (await call("ana", "PUT", "practiceRooms", " For youth night ")).statusCode,
  ).toBe(200);
  expect((await call("ion", "PUT", "practiceRooms")).statusCode).toBe(200);
  const planned = await call("ana", "PUT", "midiChords");
  expect(planned.json<FeatureRequests>()).toEqual({
    counts: { practiceRooms: 2, midiChords: 1 },
    mine: { practiceRooms: "For youth night", midiChords: "" },
  });
  const owner = (await call("pavel", "GET")).json<FeatureRequests>();
  expect(owner.who?.practiceRooms?.map((r) => [r.name, r.note])).toEqual([
    ["Ana", "For youth night"],
    ["Ion", ""],
  ]);

  // Withdrawn, it's gone; asking again just changes the note.
  await call("ion", "DELETE", "practiceRooms");
  await call("ana", "PUT", "practiceRooms", "Or for rehearsals");
  expect((await call("ana", "GET")).json<FeatureRequests>()).toMatchObject({
    counts: { practiceRooms: 1 },
    mine: { practiceRooms: "Or for rehearsals" },
  });

  // Classic's features and unknown ones can't be asked for; only members ask.
  expect((await call("ana", "PUT", "export")).statusCode).toBe(400);
  expect((await call("ana", "PUT", "nope")).statusCode).toBe(400);
  expect((await call("stranger", "PUT", "host")).statusCode).toBe(403);
  expect((await call(null, "GET")).statusCode).toBe(401);

  // A deleted account takes its requests along.
  deleteAccount(db, "ana");
  expect((await call("pavel", "GET")).json<FeatureRequests>().counts).toEqual(
    {},
  );
});
