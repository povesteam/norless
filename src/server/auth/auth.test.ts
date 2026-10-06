import { beforeEach, describe, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { createSession, devLoginEnabled, loginWithEmail } from "./auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";

let db: Db;
let app: ReturnType<typeof buildApp>;

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('ana', 'Ana', 'ana@example.com', 'active', '2026-01-01', '2026-01-01');
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro","uk"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m', 'c', 'ana', '["team"]', 'active', '2026-01-01', '2026-01-01');
  `);
  app = buildApp({ db, logger: false });
});

const cookie = (token: string) => ({ cookie: `__Host-session=${token}` });
const me = (token?: string) =>
  app.inject({ url: "/api/me", headers: token ? cookie(token) : {} });

describe("sessions", () => {
  test("the session cookie identifies the user and their memberships", async () => {
    const response = await me(createSession(db, "ana"));

    expect(response.json()).toEqual({
      user: {
        id: "ana",
        displayName: "Ana",
        email: "ana@example.com",
        avatar: null,
        avatarSource: null,
        device: null,
      },
      memberships: [{ community: "unu-unu", roles: ["team"] }],
      preferences: {},
      appTeam: false,
    });
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  test("preferences per device type are kept with the account", async () => {
    const token = createSession(db, "ana");
    const preferences = {
      tablet: { layouts: { live: "running-order" }, textSize: 1.5 },
      phone: { stageScheme: "light" },
      // The switches whose what's new notice was seen, per community.
      seenSwitches: { "unu-unu": ["controller", "parts"] },
    };
    const put = (body: object, headers = cookie(token)) =>
      app.inject({
        method: "PUT",
        url: "/api/me/preferences",
        headers,
        payload: body,
      });

    expect((await put(preferences)).statusCode).toBe(204);
    expect((await me(token)).json()).toMatchObject({ preferences });
    // Unknown device types are dropped, as Fastify does with unknown fields.
    await put({ ...preferences, watch: { textSize: 2 } });
    expect(
      (await me(token)).json<{ preferences: object }>().preferences,
    ).toEqual(preferences);
    expect((await put({ phone: { textSize: 9 } })).statusCode).toBe(400);
    expect((await put(preferences, {} as never)).statusCode).toBe(401);
  });

  test("two devices saving what each knew don't erase each other's preferences", async () => {
    const token = createSession(db, "ana");
    const put = (body: object) =>
      app.inject({
        method: "PUT",
        url: "/api/me/preferences",
        headers: cookie(token),
        payload: body,
      });
    // The laptop and the phone both loaded {}.
    await put({ seenSwitches: { functii: ["host"] } });
    await put({ seenSwitches: { clasic: [] }, phone: { textSize: 1.5 } });
    await put({ laptop: { layouts: { playlist: "big" } } });
    await put({ laptop: { layouts: { song: "one" } } });
    expect(
      (await me(token)).json<{ preferences: object }>().preferences,
    ).toEqual({
      seenSwitches: { functii: ["host"], clasic: [] },
      phone: { textSize: 1.5 },
      laptop: { layouts: { playlist: "big", song: "one" } },
    });
  });

  test("without a valid session there's no user, and a stale cookie is cleared", async () => {
    expect((await me()).json()).toEqual({
      user: null,
      memberships: [],
      preferences: {},
    });

    const response = await me("forged");
    expect(response.json()).toMatchObject({ user: null });
    expect(response.headers["set-cookie"]).toMatch(
      /__Host-session=; Max-Age=0/,
    );
  });

  test("a session ends after 30 days without use", async () => {
    const token = createSession(
      db,
      "ana",
      new Date(Date.now() - 31 * 86_400_000),
    );

    expect((await me(token)).json()).toMatchObject({ user: null });
  });

  test("a session in use is renewed for 30 days, at most once a day", async () => {
    const token = createSession(
      db,
      "ana",
      new Date(Date.now() - 2 * 86_400_000),
    );

    const response = await me(token);
    expect(response.headers["set-cookie"]).toMatch(
      /^__Host-session=.+; Max-Age=2592000; Path=\/; HttpOnly; Secure; SameSite=Lax$/,
    );
    const expires = db
      .prepare("SELECT expires_at FROM sessions")
      .pluck()
      .get() as string;
    expect(Date.parse(expires) - Date.now()).toBeGreaterThan(29.9 * 86_400_000);
    expect((await me(token)).headers["set-cookie"]).toBeUndefined();
  });

  test("logging out ends the session", async () => {
    const token = createSession(db, "ana");

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: cookie(token),
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers["set-cookie"]).toMatch(/Max-Age=0/);
    expect((await me(token)).json()).toMatchObject({ user: null });
  });

  test("logging out everywhere ends the other sessions", async () => {
    const here = createSession(db, "ana");
    const lostPhone = createSession(db, "ana");

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/logout-everywhere",
      headers: cookie(here),
    });
    expect(response.statusCode).toBe(204);
    expect((await me(lostPhone)).json()).toMatchObject({ user: null });
    expect((await me(here)).json()).toMatchObject({ user: { id: "ana" } });
  });
});

describe("cross-site requests", () => {
  const logout = (origin: string) =>
    app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { origin },
    });

  test("changes from another site are refused", async () => {
    expect((await logout("https://evil.example")).statusCode).toBe(403);
    expect((await logout("null")).statusCode).toBe(403);
  });

  test("changes from this site pass", async () => {
    expect((await logout("http://localhost")).statusCode).toBe(204);
  });
});

describe("loginWithEmail", () => {
  const status = (table: string, id: string) =>
    db.prepare(`SELECT status FROM ${table} WHERE id = ?`).pluck().get(id);

  beforeEach(() => {
    db.exec(`
      INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
        ('old', 'Ion', 'ion@example.com', 'imported', '2016-01-01', '2016-01-01'),
        ('invited', 'Maria', 'maria@example.com', 'imported', '2016-01-01', '2016-01-01');
      INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
        ('m-old', 'c', 'old', '[]', 'imported', '2016-01-01', '2016-01-01'),
        ('m-invited', 'c', 'invited', '["editor"]', 'invited', '2016-01-01', '2016-01-01');
    `);
  });

  test("an invited person is linked by email, ignoring case, and becomes a member", () => {
    expect(loginWithEmail(db, " Maria@Example.com ")).toEqual({
      userId: "invited",
    });
    expect(status("users", "invited")).toBe("active");
    expect(status("members", "m-invited")).toBe("active");
  });

  test("an imported person who wasn't invited can't log in", () => {
    expect(loginWithEmail(db, "ion@example.com")).toBeNull();
    expect(status("users", "old")).toBe("imported");
  });

  test("an unknown email gets a new user without memberships", () => {
    const login = loginWithEmail(db, "new@example.com", { displayName: "Nou" });

    expect(login).not.toBeNull();
    expect(
      db
        .prepare(
          "SELECT display_name, status FROM users WHERE email = 'new@example.com'",
        )
        .get(),
    ).toEqual({ display_name: "Nou", status: "active" });
    expect(
      db
        .prepare("SELECT count(*) FROM members WHERE user_id = ?")
        .pluck()
        .get(login?.userId),
    ).toBe(0);
  });

  test("an active member logs in again", () => {
    expect(loginWithEmail(db, "ana@example.com")).toEqual({ userId: "ana" });
  });
});

describe("dev login", () => {
  const devApp = () => buildApp({ db, logger: false, devLogin: true });
  const devLogin = (email: string) =>
    devApp().inject({
      method: "POST",
      url: "/api/auth/dev-login",
      payload: { email },
    });

  test("logs in any email and sets the session cookie", async () => {
    const response = await devLogin("ana@example.com");

    expect(response.statusCode).toBe(204);
    const token = /__Host-session=([^;]+)/.exec(
      String(response.headers["set-cookie"]),
    )?.[1];
    expect((await me(token)).json()).toMatchObject({ user: { id: "ana" } });
  });

  test("refuses imported people who weren't invited", async () => {
    db.exec(
      "INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES ('old', 'Ion', 'ion@example.com', 'imported', '2016-01-01', '2016-01-01')",
    );

    expect((await devLogin("ion@example.com")).json()).toEqual({
      error: "not-invited",
    });
  });

  test("is off unless enabled, and never in production", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/dev-login",
      payload: { email: "ana@example.com" },
    });
    expect(response.statusCode).toBe(404);
    expect((await app.inject({ url: "/api/auth/methods" })).json()).toEqual({
      dev: false,
      email: false,
      google: false,
      fakeGoogle: false,
      devMail: false,
    });

    expect(devLoginEnabled({ DEV_LOGIN: "1" })).toBe(true);
    expect(devLoginEnabled({})).toBe(false);
    expect(() =>
      devLoginEnabled({ DEV_LOGIN: "1", NODE_ENV: "production" }),
    ).toThrow();
  });
});

test("in development, the pretend Google lists the accounts, and emails are shown", async () => {
  const dev = buildApp({
    db,
    logger: false,
    devLogin: true,
    devMail: () => undefined,
  });
  expect((await dev.inject({ url: "/api/auth/methods" })).json()).toMatchObject(
    {
      dev: true,
      google: true,
      fakeGoogle: true,
      devMail: true,
    },
  );
  const accounts = (await dev.inject({ url: "/api/auth/dev-accounts" })).json<
    { email: string }[]
  >();
  expect(accounts.map((a) => a.email)).toContain("ana@example.com");
  expect((await app.inject({ url: "/api/auth/dev-accounts" })).statusCode).toBe(
    404,
  );
});
