import { beforeEach, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { migrate, openDatabase, type Db } from "../db/db.js";
import { createSession } from "./auth.js";
import { deviceOf, type SessionInfo } from "./sessions.js";

let db: Db;
let app: ReturnType<typeof buildApp>;

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('ana', 'Ana', 'ana@example.com', 'active', 'x', 'x'),
      ('ion', 'Ion', 'ion@example.com', 'active', 'x', 'x');
  `);
  app = buildApp({ db, logger: false });
});

const phone =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
const mac =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

const as = (token: string, agent: string) => ({
  cookie: `__Host-session=${token}`,
  "user-agent": agent,
});

test("tells browsers and systems apart", () => {
  expect(deviceOf(phone)).toEqual({ browser: "Chrome", system: "Android" });
  expect(deviceOf(mac)).toEqual({ browser: "Safari", system: "Mac" });
  expect(
    deviceOf(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36 Edg/129.0",
    ),
  ).toEqual({ browser: "Edge", system: "Windows" });
  expect(deviceOf(null)).toEqual({ browser: null, system: null });
});

test("a person sees where they're logged in, and logs out another place", async () => {
  const onPhone = createSession(db, "ana");
  const onMac = createSession(db, "ana");
  const other = createSession(db, "ion");
  // Each session learns its browser when used.
  await app.inject({ url: "/api/me", headers: as(onMac, mac) });
  await app.inject({ url: "/api/me", headers: as(other, mac) });
  const list = async () =>
    (
      await app.inject({ url: "/api/me/sessions", headers: as(onPhone, phone) })
    ).json<SessionInfo[]>();

  const sessions = await list();
  expect(sessions).toHaveLength(2);
  expect(sessions).toContainEqual(
    expect.objectContaining({
      browser: "Chrome",
      system: "Android",
      current: true,
    }),
  );
  const mine = sessions.find((s) => !s.current);
  expect(mine).toMatchObject({ browser: "Safari", system: "Mac" });

  // Not this device's own, nor someone else's.
  const current = sessions.find((s) => s.current);
  const ionId = (
    await app.inject({ url: "/api/me/sessions", headers: as(other, mac) })
  ).json<SessionInfo[]>()[0]?.id;
  for (const id of [current?.id, ionId])
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: `/api/me/sessions/${id}`,
          headers: as(onPhone, phone),
        })
      ).statusCode,
    ).toBe(404);

  const out = await app.inject({
    method: "DELETE",
    url: `/api/me/sessions/${mine?.id}`,
    headers: as(onPhone, phone),
  });
  expect(out.statusCode).toBe(204);
  expect(await list()).toHaveLength(1);
  expect(
    (await app.inject({ url: "/api/me", headers: as(onMac, mac) })).json(),
  ).toMatchObject({ user: null });
  expect((await app.inject({ url: "/api/me/sessions" })).statusCode).toBe(401);
});
