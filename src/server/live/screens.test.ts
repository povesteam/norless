import { beforeEach, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";

let db: Db;
let sessions: Record<string, string>;
let app: ReturnType<typeof buildApp>;

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro","uk"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('owner', 'Ow', 'ow@example.com', 'active', '2026-01-01', '2026-01-01'),
      ('team', 'Te', 'te@example.com', 'active', '2026-01-01', '2026-01-01'),
      ('ed', 'Ed', 'ed@example.com', 'active', '2026-01-01', '2026-01-01');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m1', 'c', 'owner', '["owner"]', 'active', '2026-01-01', '2026-01-01'),
      ('m2', 'c', 'team', '["team"]', 'active', '2026-01-01', '2026-01-01'),
      ('m3', 'c', 'ed', '["editor"]', 'active', '2026-01-01', '2026-01-01');
  `);
  app = buildApp({ db, logger: false });
  sessions = {
    owner: createSession(db, "owner"),
    team: createSession(db, "team"),
    ed: createSession(db, "ed"),
  };
});

const call = (
  as: string | null,
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  payload?: object,
) =>
  app.inject({
    method,
    url,
    headers: as ? { cookie: `__Host-session=${sessions[as]}` } : {},
    payload,
  });
const screens = "/api/communities/unu-unu/screens";
const projector = {
  name: "Proiector RO",
  type: "projector",
  languages: ["ro"],
};

test("owners add screens; each opens with its secret, without a login", async () => {
  const created = await call("owner", "POST", screens, projector);
  expect(created.statusCode).toBe(201);
  const { id, secret } = created.json<{ id: string; secret: string }>();
  expect(secret).toMatch(/^[\w-]{24}$/);

  const opened = await call(null, "GET", `/api/screens/${secret}`);
  expect(opened.json()).toEqual({
    id,
    name: "Proiector RO",
    type: "projector",
    languages: ["ro"],
    layout: null,
    settings: {},
    community: { slug: "unu-unu", languages: ["ro", "uk"] },
  });
  // The team sees them, to open them; others don't.
  expect((await call("team", "GET", screens)).json()).toHaveLength(1);
  expect((await call("ed", "GET", screens)).statusCode).toBe(403);
  expect((await call("team", "POST", screens, projector)).statusCode).toBe(403);
});

test("a screen shows one or two of the community's languages", async () => {
  const refused = async (languages: string[]) =>
    expect(
      (await call("owner", "POST", screens, { ...projector, languages }))
        .statusCode,
    ).toBe(400);
  await refused(["en"]);
  await refused([]);
  await refused(["ro", "uk", "ro"]);
  expect(
    (
      await call("owner", "POST", screens, {
        ...projector,
        languages: ["uk", "ro"],
        settings: { split: "columns" },
      })
    ).statusCode,
  ).toBe(201);
});

test("a new secret revokes the old link, and so does deleting", async () => {
  const { id, secret } = (
    await call("owner", "POST", screens, projector)
  ).json<{ id: string; secret: string }>();

  const renewed = await call("owner", "POST", `${screens}/${id}/secret`);
  const fresh = renewed.json<{ secret: string }>().secret;
  expect(fresh).not.toBe(secret);
  expect((await call(null, "GET", `/api/screens/${secret}`)).statusCode).toBe(
    404,
  );
  expect((await call(null, "GET", `/api/screens/${fresh}`)).statusCode).toBe(
    200,
  );

  expect(
    (
      await call("owner", "PUT", `${screens}/${id}`, {
        ...projector,
        name: "Proiector",
      })
    ).statusCode,
  ).toBe(204);
  expect(
    (await call(null, "GET", `/api/screens/${fresh}`)).json(),
  ).toMatchObject({ name: "Proiector" });

  expect((await call("owner", "DELETE", `${screens}/${id}`)).statusCode).toBe(
    204,
  );
  expect((await call(null, "GET", `/api/screens/${fresh}`)).statusCode).toBe(
    404,
  );
});

test("a device shows a code; the team types it, and the device becomes the screen until unpaired", async () => {
  const { id } = (await call("owner", "POST", screens, projector)).json<{
    id: string;
  }>();
  const stage = (
    await call("owner", "POST", screens, { ...projector, name: "Scenă" })
  ).json<{ id: string }>();
  const token = "tv-box-token-0123456789abcdef";
  const ask = async () =>
    (await call(null, "POST", "/api/pairing", { token })).json<{
      code: string;
      expiresAt: string;
    }>();
  const { code, expiresAt } = await ask();
  expect(code).toMatch(/^\d{6}$/);
  expect(Date.parse(expiresAt) - Date.now()).toBeGreaterThan(4 * 60_000);
  expect((await call(null, "GET", `/api/screens/${token}`)).statusCode).toBe(
    404,
  );

  const wrong = code === "000000" ? "000001" : "000000";
  expect(
    (await call("team", "POST", `${screens}/${id}/devices`, { code: wrong }))
      .statusCode,
  ).toBe(400);
  const paired = await call("team", "POST", `${screens}/${id}/devices`, {
    code,
  });
  expect(paired.statusCode).toBe(201);
  expect(paired.json()).toMatchObject({ screenId: id, pairedBy: "Te" });
  // A code works once.
  expect(
    (await call("team", "POST", `${screens}/${id}/devices`, { code }))
      .statusCode,
  ).toBe(400);
  expect(
    (await call(null, "GET", `/api/screens/${token}`)).json(),
  ).toMatchObject({ id, name: "Proiector RO" });

  // Paired again, it moves to the other screen.
  const again = await call("team", "POST", `${screens}/${stage.id}/devices`, {
    code: (await ask()).code,
  });
  expect(again.statusCode).toBe(201);
  const devices = (
    await call("team", "GET", "/api/communities/unu-unu/devices")
  ).json<{ id: string; screenId: string }[]>();
  expect(devices.map((d) => d.screenId)).toEqual([stage.id]);

  const device = devices[0]?.id ?? "";
  expect(
    (await call("team", "DELETE", `/api/communities/unu-unu/devices/${device}`))
      .statusCode,
  ).toBe(204);
  expect((await call(null, "GET", `/api/screens/${token}`)).statusCode).toBe(
    404,
  );
  // Unpaired, the same device can be paired again.
  expect(
    (
      await call("team", "POST", `${screens}/${id}/devices`, {
        code: (await ask()).code,
      })
    ).statusCode,
  ).toBe(201);
});
