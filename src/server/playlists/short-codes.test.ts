import { expect, test } from "vitest";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { migrate, openDatabase } from "../db/db.js";
import { newCode } from "./short-codes.js";

test("codes are 6 characters with a digit, and 7 once 6 keep colliding", () => {
  for (let i = 0; i < 200; i++)
    expect(newCode(() => false)).toMatch(/^(?=.*[2-9])[2-9a-zA-Z]{6}$/);
  expect(newCode((code) => code.length === 6)).toHaveLength(7);
});

test("a playlist or song gets one short code for good, which redirects to it", async () => {
  const db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', 'x', 'x');
    INSERT INTO playlists (id, community_id, title, created_at, updated_at) VALUES ('p', 'c', 'Duminică', '2026-10-04T08:00:00.000Z', '2026-10-04T08:00:00.000Z');
  `);
  const app = buildApp({ db, logger: false });
  const share = (kind: string, id: string) =>
    app.inject({
      method: "POST",
      url: "/api/communities/unu-unu/short-codes",
      payload: { kind, id },
    });

  const first = await share("playlist", "p");
  expect(first.statusCode).toBe(201);
  const { code } = first.json<{ code: string }>();
  expect((await share("playlist", "p")).json()).toEqual({ code });
  expect((await share("song", "nope")).statusCode).toBe(404);

  const opened = await app.inject({ method: "GET", url: `/${code}` });
  expect(opened.statusCode).toBe(302);
  expect(opened.headers.location).toBe("/unu-unu/playlists/p");

  // Deleted, the playlist keeps its code, so no one else gets it.
  db.exec("UPDATE playlists SET deleted_at = 'x'");
  expect(
    db
      .prepare("SELECT count(*) FROM short_codes WHERE code = ?")
      .pluck()
      .get(code),
  ).toBe(1);
  // An unknown code is any other unknown page.
  expect(
    (await app.inject({ method: "GET", url: "/zz9" })).headers.location,
  ).toBeUndefined();
});

test("the team shares a screen; a new secret retires its short code", async () => {
  const db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', 'x', 'x');
    INSERT INTO rooms (id, community_id, name, created_at, updated_at) VALUES ('r', 'c', 'Sala', 'x', 'x');
    INSERT INTO screens (id, community_id, room_id, name, type, languages, secret, position, created_at, updated_at) VALUES
      ('s', 'c', 'r', 'Scenă', 'stage', '["ro"]', 'old-secret', 1, 'x', 'x');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES ('t', 'Te', 'te@example.com', 'active', 'x', 'x');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES ('m', 'c', 't', '["team"]', 'active', 'x', 'x');
  `);
  const app = buildApp({ db, logger: false });
  const share = (secret: string, cookie?: string) =>
    app.inject({
      method: "POST",
      url: "/api/communities/unu-unu/short-codes",
      headers: cookie ? { cookie } : {},
      payload: { kind: "screen", id: secret },
    });
  const team = `__Host-session=${createSession(db, "t")}`;

  expect((await share("old-secret")).statusCode).toBe(401);
  const { code } = (await share("old-secret", team)).json<{ code: string }>();
  expect(
    (await app.inject({ method: "GET", url: `/${code}` })).headers.location,
  ).toBe("/s/old-secret");

  db.exec("UPDATE screens SET secret = 'new-secret'");
  // The old code still leads to the old link, which no longer works.
  expect(
    (await app.inject({ method: "GET", url: `/${code}` })).headers.location,
  ).toBe("/s/old-secret");
  expect((await share("old-secret", team)).statusCode).toBe(404);
  const fresh = (await share("new-secret", team)).json<{ code: string }>();
  expect(fresh.code).not.toBe(code);
  // The team's list of screens has the same code, for one link to open or copy.
  const list = await app.inject({
    method: "GET",
    url: "/api/communities/unu-unu/screens",
    headers: { cookie: team },
  });
  expect(list.json<{ code: string }[]>()[0]?.code).toBe(fresh.code);
});
