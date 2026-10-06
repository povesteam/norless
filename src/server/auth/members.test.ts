import { beforeEach, describe, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { createSession, loginWithEmail } from "./auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import { createLoginLink } from "./login-links.js";
import { invite } from "./members.js";

let db: Db;
const member = (email: string) =>
  db
    .prepare(
      "SELECT m.status, m.roles FROM members m JOIN users u ON u.id = m.user_id WHERE u.email = ?",
    )
    .get(email);

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro","uk"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('pavel', 'pavel', 'pavel@example.com', 'imported', '2016-01-01', '2016-01-01');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m', 'c', 'pavel', '[]', 'imported', '2016-01-01', '2016-01-01');
  `);
});

test("the imported account is invited, and the first login makes it the owner", () => {
  invite(db, "c", "Pavel@Example.com", ["owner"]);
  expect(member("pavel@example.com")).toEqual({
    status: "invited",
    roles: '["owner"]',
  });

  expect(loginWithEmail(db, "pavel@example.com")).toEqual({
    userId: "pavel",
  });
  expect(member("pavel@example.com")).toEqual({
    status: "active",
    roles: '["owner"]',
  });
});

test("a new person gets an invited user, and an active member keeps being active", () => {
  invite(db, "c", "ana@example.com", ["team"]);
  expect(member("ana@example.com")).toEqual({
    status: "invited",
    roles: '["team"]',
  });

  loginWithEmail(db, "ana@example.com");
  invite(db, "c", "ana@example.com", ["team", "editor"]);
  expect(member("ana@example.com")).toEqual({
    status: "active",
    roles: '["team","editor"]',
  });
});

describe("member management", () => {
  let owner: string;

  beforeEach(() => {
    db.exec(`
      UPDATE users SET legacy_created_at = '2016-03-01', last_login_at = '2017-05-01' WHERE id = 'pavel';
      UPDATE members SET was_admin = 1 WHERE id = 'm';
      INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
        ('ana', 'Ana', 'ana@example.com', 'active', '2026-01-01', '2026-01-01'),
        ('ed', 'Ed', 'ed@example.com', 'active', '2026-01-01', '2026-01-01');
      INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
        ('m-ana', 'c', 'ana', '["owner"]', 'active', '2026-01-01', '2026-01-01'),
        ('m-ed', 'c', 'ed', '["editor"]', 'active', '2026-01-01', '2026-01-01');
      INSERT INTO songs (id, community_id, created_at, updated_at, created_by) VALUES
        ('song', 'c', '2016-04-01', '2016-04-01', 'pavel');
    `);
    owner = createSession(db, "ana");
  });

  const call = (
    session: string | null,
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path = "",
    payload?: object,
  ) =>
    buildApp({ db, logger: false }).inject({
      method,
      url: `/api/communities/unu-unu/members${path}`,
      headers: session ? { cookie: `__Host-session=${session}` } : {},
      payload,
    });

  test("only owners manage members", async () => {
    expect((await call(null, "GET")).statusCode).toBe(401);
    expect((await call(createSession(db, "ed"), "GET")).statusCode).toBe(403);
    expect((await call(owner, "GET")).statusCode).toBe(200);
  });

  test("imported accounts show their old details", async () => {
    const list = (await call(owner, "GET")).json<object[]>();

    expect(list).toContainEqual({
      id: "m",
      name: "pavel",
      email: "pavel@example.com",
      roles: [],
      status: "imported",
      wasAdmin: true,
      createdAt: "2016-03-01",
      lastActiveAt: "2017-05-01",
    });
  });

  test("an owner invites an imported person by their email", async () => {
    expect(
      (
        await call(owner, "POST", "", {
          email: "pavel@example.com",
          roles: ["editor"],
        })
      ).json(),
    ).toEqual({ emailed: false });
    expect(member("pavel@example.com")).toEqual({
      status: "invited",
      roles: '["editor"]',
    });
    expect(
      (
        await call(owner, "POST", "", {
          email: "not an email",
          roles: ["editor"],
        })
      ).statusCode,
    ).toBe(400);
  });

  test("an owner changes roles, but the last owner keeps the owner role", async () => {
    expect(
      (await call(owner, "PATCH", "/m-ed", { roles: ["editor", "team"] }))
        .statusCode,
    ).toBe(204);
    expect(member("ed@example.com")).toEqual({
      status: "active",
      roles: '["editor","team"]',
    });

    const response = await call(owner, "PATCH", "/m-ana", {
      roles: ["editor"],
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "last-owner" });
    expect((await call(owner, "DELETE", "/m-ana")).statusCode).toBe(409);
  });

  test("removing a member keeps their account; deleting an imported person forgets them", async () => {
    expect((await call(owner, "DELETE", "/m-ed")).statusCode).toBe(204);
    expect(
      db.prepare("SELECT email FROM users WHERE id = 'ed'").pluck().get(),
    ).toBe("ed@example.com");

    expect((await call(owner, "DELETE", "/m")).statusCode).toBe(204);
    expect(
      db
        .prepare(
          "SELECT display_name, email, status FROM users WHERE id = 'pavel'",
        )
        .get(),
    ).toEqual({ display_name: "", email: null, status: "deleted" });
    // Their songs stay, without a name.
    expect(
      db
        .prepare("SELECT created_by FROM songs WHERE id = 'song'")
        .pluck()
        .get(),
    ).toBe("pavel");
    const names = (await call(owner, "GET"))
      .json<{ name: string }[]>()
      .map((m) => m.name);
    expect(names).toEqual(["Ana"]);
  });
});

test("someone deletes their account; what they added stays without a name, their login links go, and a last owner can't", async () => {
  db.exec(`
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('ana', 'Ana', 'ana@example.com', 'active', 'x', 'x'),
      ('ion', 'Ion', 'ion@example.com', 'active', 'x', 'x');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m-ana', 'c', 'ana', '["owner"]', 'active', 'x', 'x'),
      ('m-ion', 'c', 'ion', '["team"]', 'active', 'x', 'x');
    INSERT INTO playlists (id, community_id, title, created_at, updated_at, created_by) VALUES
      ('p', 'c', 'Duminică', '2026-10-04T08:00:00.000Z', '2026-10-04T08:00:00.000Z', 'ion');
  `);
  createLoginLink(db, "ion@example.com", "/");
  createLoginLink(db, "ana@example.com", "/");
  const app = buildApp({ db, logger: false });
  const remove = (userId: string) =>
    app.inject({
      method: "DELETE",
      url: "/api/me",
      headers: { cookie: `__Host-session=${createSession(db, userId)}` },
    });

  expect((await remove("ana")).statusCode).toBe(409);
  expect((await remove("ion")).statusCode).toBe(204);
  expect(
    db
      .prepare("SELECT display_name, email, status FROM users WHERE id = 'ion'")
      .get(),
  ).toEqual({ display_name: "", email: null, status: "deleted" });
  expect(member("ion@example.com")).toBeUndefined();
  expect(
    db.prepare("SELECT status FROM members WHERE id = 'm-ion'").pluck().get(),
  ).toBe("removed");
  expect(
    db
      .prepare("SELECT count(*) FROM sessions WHERE user_id = 'ion'")
      .pluck()
      .get(),
  ).toBe(0);
  expect(db.prepare("SELECT created_by FROM playlists").pluck().get()).toBe(
    "ion",
  );
  expect(db.prepare("SELECT email FROM login_links").pluck().all()).toEqual([
    "ana@example.com",
  ]);
  expect(
    (await app.inject({ method: "DELETE", url: "/api/me" })).statusCode,
  ).toBe(401);
});

test("with email set up, the invited person gets a login link that lasts 48 hours", async () => {
  db.exec(`
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('own', 'Ana', 'ana@example.com', 'active', 'x', 'x');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m-own', 'c', 'own', '["owner"]', 'active', 'x', 'x');
  `);
  const mails: { to: string; subject: string; text: string }[] = [];
  const app = buildApp({
    db,
    logger: false,
    origin: "https://norless.com",
    mailer: async (mail) => {
      mails.push(mail);
      return true;
    },
  });
  const invited = await app.inject({
    method: "POST",
    url: "/api/communities/unu-unu/members",
    headers: { cookie: `__Host-session=${createSession(db, "own")}` },
    payload: { email: "Maria@Example.com", roles: ["team"], language: "ro" },
  });
  expect(invited.json()).toEqual({ emailed: true });
  expect(mails[0]).toMatchObject({
    to: "maria@example.com",
    subject: "Ana te-a invitat în Unu-Unu pe Norless",
  });
  const token = /\/login\/link\/([\w-]+)/.exec(mails[0]?.text ?? "")?.[1] ?? "";
  // A day later the link still works, and opens the community.
  expect(
    db
      .prepare(
        "SELECT round((julianday(expires_at) - julianday('now')) * 24) FROM login_links",
      )
      .pluck()
      .get(),
  ).toBe(48);
  db.exec(
    "UPDATE login_links SET created_at = '2000-01-01', expires_at = datetime('now', '+1 days')",
  );
  const used = await app.inject({
    method: "POST",
    url: "/api/auth/email-link/use",
    payload: { token },
  });
  expect(used.json()).toEqual({ next: "/unu-unu" });
  expect(member("maria@example.com")).toEqual({
    status: "active",
    roles: '["team"]',
  });
});
