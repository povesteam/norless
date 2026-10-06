import { expect, test } from "vitest";
import { buildApp } from "./app.js";
import { createSession } from "./auth/auth.js";
import { migrate, openDatabase } from "./db/db.js";

const db = openDatabase(":memory:");
migrate(db);

test("health endpoint reports ok", async () => {
  const response = await buildApp({ db, logger: false }).inject({
    url: "/api/health",
  });

  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ status: "ok" });
});

test("unknown API routes return 404 JSON", async () => {
  const response = await buildApp({ db, logger: false }).inject({
    url: "/api/nope",
  });

  expect(response.statusCode).toBe(404);
});

test("anyone can read a community's name, languages and number of songs", async () => {
  db.prepare(
    "INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES ('c', 'unu-unu', 'Unu-Unu', '[\"ro\",\"uk\"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01')",
  ).run();
  db.prepare(
    "INSERT INTO songs (id, community_id, tags, created_at, updated_at, deleted_at) VALUES ('s1', 'c', '[]', '2026-01-01', '2026-01-01', NULL), ('s2', 'c', '[]', '2026-01-01', '2026-01-01', '2026-02-01')",
  ).run();
  const app = buildApp({ db, logger: false });

  const found = await app.inject({ url: "/api/communities/unu-unu" });
  expect(found.json()).toEqual({
    slug: "unu-unu",
    name: "Unu-Unu",
    languages: ["ro", "uk"],
    songCount: 1, // not the deleted one
    theme: {},
    switches: {}, // none switched: only Classic's features are on
    bibleVersions: {}, // the default version for each language
    noteNames: "letters",
    tempoCheck: { percent: 4, seconds: 8 },
    youtubeChannel: null, // where services are streamed, for chapters
  });
  const missing = await app.inject({ url: "/api/communities/nope-nope" });
  expect(missing.statusCode).toBe(404);
});

test("the license and the running version's source, for the About page", async () => {
  const source = "https://github.com/example/norless/tree/abc123";
  const response = await buildApp({ db, logger: false, source }).inject({
    url: "/api/about",
  });
  expect(response.json()).toEqual({ license: "AGPL-3.0-or-later", source });
});

test("owners set the theme; colors with too little contrast are refused", async () => {
  const app = buildApp({ db, logger: false });
  db.prepare(
    "INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES ('theme-owner', 'Ow', 'theme@example.com', 'active', 'x', 'x')",
  ).run();
  db.prepare(
    "INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES ('m-theme', 'c', 'theme-owner', '[\"owner\"]', 'active', 'x', 'x')",
  ).run();
  const cookie = `__Host-session=${createSession(db, "theme-owner")}`;
  const put = (theme: object) =>
    app.inject({
      method: "PUT",
      url: "/api/communities/unu-unu/theme",
      headers: { cookie },
      payload: theme,
    });

  const pale = await put({ color: "#f0b090" });
  expect(pale.statusCode).toBe(400);
  expect(pale.json()).toMatchObject({ problems: ["color", "soft"] });
  expect(
    (await put({ fontFile: "data:text/css;base64,Ym9keXt9" })).statusCode,
  ).toBe(400);
  expect((await put({ logo: "data:text/html;base64,PGI+" })).statusCode).toBe(
    400,
  );

  expect((await put({ color: "#ac5334", tint: "#f9f5f2" })).statusCode).toBe(
    204,
  );
  const community = await app.inject({ url: "/api/communities/unu-unu" });
  expect(community.json()).toMatchObject({
    theme: { color: "#ac5334", tint: "#f9f5f2" },
  });
});

test("the community's font file is served by Norless, and kept when the theme is saved again", async () => {
  const app = buildApp({ db, logger: false });
  const cookie = `__Host-session=${createSession(db, "theme-owner")}`;
  const put = (theme: object) =>
    app.inject({
      method: "PUT",
      url: "/api/communities/unu-unu/theme",
      headers: { cookie },
      payload: theme,
    });
  const font = Buffer.from("wOF2 not really a font").toString("base64");
  expect(
    (await put({ font: "Switzer", fontFile: `data:font/woff2;base64,${font}` }))
      .statusCode,
  ).toBe(204);
  const { theme } = (
    await app.inject({ url: "/api/communities/unu-unu" })
  ).json<{ theme: { fontFile?: string; fontFileUrl: string } }>();
  expect(theme.fontFile).toBeUndefined();
  expect(theme.fontFileUrl).toMatch(
    /^\/api\/communities\/unu-unu\/font\?v=\w{12}$/,
  );
  const served = await app.inject({ url: theme.fontFileUrl });
  expect(served.headers["content-type"]).toBe("font/woff2");
  expect(served.headers["cache-control"]).toContain("immutable");
  expect(served.rawPayload.toString()).toBe("wOF2 not really a font");

  // Saved again with the file's address, the file stays.
  await put({
    font: "Switzer",
    color: "#ac5334",
    fontFileUrl: theme.fontFileUrl,
  });
  expect((await app.inject({ url: theme.fontFileUrl })).statusCode).toBe(200);
  await put({ font: "Switzer" });
  expect((await app.inject({ url: theme.fontFileUrl })).statusCode).toBe(404);
});

test("the privacy notice names each community's contact, the operator and the services", async () => {
  const app = buildApp({
    db,
    logger: false,
    operator: "Pavel Popa, pavel@example.com",
    services: ["Hetzner Online GmbH, Germany (servers)"],
  });
  const cookie = `__Host-session=${createSession(db, "theme-owner")}`;
  const saved = await app.inject({
    method: "PUT",
    url: "/api/communities/unu-unu/privacy",
    headers: { cookie },
    payload: {
      name: " Biserica UnuUnu ",
      address: "",
      email: "contact@example.com",
    },
  });
  expect(saved.statusCode).toBe(204);
  expect((await app.inject({ url: "/api/privacy" })).json()).toEqual({
    operator: "Pavel Popa, pavel@example.com",
    services: ["Hetzner Online GmbH, Germany (servers)"],
    communities: [
      {
        name: "Unu-Unu",
        slug: "unu-unu",
        contact: { name: "Biserica UnuUnu", email: "contact@example.com" },
      },
    ],
  });
  const visitor = await app.inject({
    method: "PUT",
    url: "/api/communities/unu-unu/privacy",
    payload: { name: "x" },
  });
  expect(visitor.statusCode).toBe(401);
});

test("owners switch features on and off; nobody else can", async () => {
  const app = buildApp({ db, logger: false });
  db.prepare(
    "INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES ('step-owner', 'Ow', 'step-owner@example.com', 'active', 'x', 'x'), ('step-team', 'Te', 'step-team@example.com', 'active', 'x', 'x')",
  ).run();
  db.prepare(
    "INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES ('m-step-o', 'c', 'step-owner', '[\"owner\"]', 'active', 'x', 'x'), ('m-step-t', 'c', 'step-team', '[\"team\"]', 'active', 'x', 'x')",
  ).run();
  const put = (user: string | null, switches: unknown) =>
    app.inject({
      method: "PUT",
      url: "/api/communities/unu-unu/switches",
      headers: user
        ? { cookie: `__Host-session=${createSession(db, user)}` }
        : {},
      payload: { switches },
    });
  const switches = async () =>
    (await app.inject({ url: "/api/communities/unu-unu" })).json<{
      switches: unknown;
    }>().switches;

  const set = { practiceRooms: true, chordColors: false, host: false };
  expect((await put("step-owner", set)).statusCode).toBe(204);
  expect(await switches()).toEqual(set);
  // Unknown switches are dropped, other values refused.
  expect((await put("step-owner", { ...set, nope: true })).statusCode).toBe(
    204,
  );
  expect((await put("step-owner", { chords: "step" })).statusCode).toBe(400);
  // Classic's features are always on.
  expect((await put("step-owner", { ...set, export: false })).statusCode).toBe(
    204,
  );
  expect((await put("step-team", {})).statusCode).toBe(403);
  expect((await put(null, {})).statusCode).toBe(401);
  expect(await switches()).toEqual(set);
});
