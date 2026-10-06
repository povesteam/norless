import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ServerMessage } from "../../shared/live.js";
import { buildApp } from "../app.js";
import { createSession } from "./auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import type { NearbyLogin } from "./device-login.js";

let db: Db;
let sessions: Record<string, string>;

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro","uk"]', 'Europe/Bucharest', 'x', 'x');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('pavel', 'Pavel', 'pavel@example.com', 'active', 'x', 'x'),
      ('maria', 'Maria', 'maria@example.com', 'active', 'x', 'x'),
      ('ana', 'Ana', 'ana@example.com', 'active', 'x', 'x'),
      ('ion', 'Ion', 'ion@example.com', 'active', 'x', 'x');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m-pavel', 'c', 'pavel', '["owner"]', 'active', 'x', 'x'),
      ('m-maria', 'c', 'maria', '["editor","team"]', 'active', 'x', 'x'),
      ('m-ana', 'c', 'ana', '["editor"]', 'active', 'x', 'x');
  `);
  sessions = Object.fromEntries(
    ["pavel", "maria", "ana", "ion"].map((p) => [p, createSession(db, p)]),
  );
});
afterEach(() => vi.useRealTimers());

const iPhone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile";
const server = () => buildApp({ db, logger: false, trustProxy: true });
type Server = ReturnType<typeof server>;
const call = (
  app: Server,
  method: "GET" | "POST" | "DELETE",
  url: string,
  {
    as,
    cookie,
    payload,
    from = "203.0.113.5",
    agent,
  }: {
    as?: string;
    cookie?: string;
    payload?: object;
    from?: string;
    agent?: string;
  } = {},
) =>
  app.inject({
    method,
    url,
    headers: {
      "x-forwarded-for": from,
      ...(agent && { "user-agent": agent }),
      ...(as || cookie
        ? { cookie: cookie ?? `__Host-session=${sessions[as ?? ""]}` }
        : {}),
    },
    payload,
  });

/** The laptop's login page asks for a code. */
async function laptop(app: Server, community?: string, from?: string) {
  const response = await call(app, "POST", "/api/device-login", {
    payload: community ? { community } : {},
    from,
  });
  expect(response.statusCode).toBe(200);
  return response.json<{ code: string; number: number; token: string }>();
}
const wait = (app: Server, token: string) =>
  call(app, "POST", "/api/device-login/wait", { payload: { token } });
const approve = (
  app: Server,
  as: string,
  code: string,
  payload: Record<string, unknown>,
) => call(app, "POST", `/api/device-login/${code}/approve`, { as, payload });
const cookieOf = (response: { headers: Record<string, unknown> }) =>
  String(response.headers["set-cookie"]).split(";")[0] ?? "";

test("a member approves the laptop's code with its number, and the laptop is logged in as them, once", async () => {
  const app = server();
  const { code, number, token } = await laptop(app, "unu-unu");
  expect(number).toBeGreaterThanOrEqual(10);
  expect(number).toBeLessThan(100);
  expect((await wait(app, token)).statusCode).toBe(202);

  // The phone sees the same number and the community.
  expect(
    (await call(app, "GET", `/api/device-login/${code}`, { as: "ana" })).json(),
  ).toEqual({ number, community: "unu-unu" });
  expect(
    (await approve(app, "ana", code, { number, as: "me" })).statusCode,
  ).toBe(204);

  const loggedIn = await wait(app, token);
  expect(loggedIn.statusCode).toBe(204);
  expect(String(loggedIn.headers["set-cookie"])).toMatch(/Max-Age=2592000/);
  const me = await call(app, "GET", "/api/me", { cookie: cookieOf(loggedIn) });
  expect(me.json().user).toMatchObject({ id: "ana", device: null });

  // Used once.
  expect((await wait(app, token)).statusCode).toBe(410);
  expect(
    (await approve(app, "ana", code, { number, as: "me" })).statusCode,
  ).toBe(404);
});

test("a wrong number, an unknown or run-out code, and visitors are refused", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-04T08:00:00Z"));
  const app = server();
  const { code, number, token } = await laptop(app);
  expect(
    (
      await approve(app, "ana", code, {
        number: number === 99 ? 98 : number + 1,
        as: "me",
      })
    ).statusCode,
  ).toBe(409);
  expect(
    (
      await call(app, "POST", `/api/device-login/${code}/approve`, {
        payload: { number, as: "me" },
      })
    ).statusCode,
  ).toBe(401);
  expect((await call(app, "GET", `/api/device-login/${code}`)).statusCode).toBe(
    401,
  );
  expect(
    (await approve(app, "ana", "000000", { number, as: "me" })).statusCode,
  ).toBe(404);

  // Waiting renews the code; only a code its page still shows can be approved, so a
  // closed page's code can't be guessed; 5 minutes without waiting, it runs out.
  vi.setSystemTime(new Date("2026-10-04T08:04:00Z"));
  expect((await wait(app, token)).statusCode).toBe(202);
  vi.setSystemTime(new Date("2026-10-04T08:04:20Z"));
  expect(
    (await approve(app, "ana", code, { number, as: "me" })).statusCode,
  ).toBe(404);
  expect((await wait(app, token)).statusCode).toBe(202);
  expect(
    (await approve(app, "ana", code, { number, as: "me" })).statusCode,
  ).toBe(204);
  const other = await laptop(app);
  vi.setSystemTime(new Date("2026-10-04T08:14:00Z"));
  expect(
    (await approve(app, "ana", other.code, { number: other.number, as: "me" }))
      .statusCode,
  ).toBe(404);
  expect((await wait(app, other.token)).statusCode).toBe(410);
});

test("as the community's laptop: the team role only, shown as Laptop (Maria), for 12 hours with a cookie that ends with the browser", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-04T08:00:00Z"));
  const app = server();
  const { code, number, token } = await laptop(app, "unu-unu");
  // Ana is an editor, not on the team.
  expect(
    (
      await approve(app, "ana", code, {
        number,
        as: "laptop",
        community: "unu-unu",
      })
    ).statusCode,
  ).toBe(403);
  expect(
    (
      await approve(app, "maria", code, {
        number,
        as: "laptop",
        community: "unu-unu",
        language: "ro",
      })
    ).statusCode,
  ).toBe(204);
  const loggedIn = await wait(app, token);
  expect(String(loggedIn.headers["set-cookie"])).not.toMatch(/Max-Age/);
  const cookie = cookieOf(loggedIn);
  const me = (await call(app, "GET", "/api/me", { cookie })).json<{
    user: { displayName: string; device: string };
    memberships: { community: string; roles: string[] }[];
  }>();
  expect(me.user).toMatchObject({
    displayName: "Laptop (Maria)",
    device: "laptop",
  });
  expect(me.memberships).toEqual([{ community: "unu-unu", roles: ["team"] }]);

  // Playlists yes, songs no, though Maria edits songs.
  const playlist = await call(
    app,
    "POST",
    "/api/communities/unu-unu/playlists",
    {
      cookie,
      payload: { title: "Duminică" },
    },
  );
  expect(playlist.statusCode).toBe(201);
  expect(
    (
      await call(app, "POST", "/api/communities/unu-unu/songs", {
        cookie,
        payload: { versions: [{ language: "ro", title: "T", text: "x" }] },
      })
    ).statusCode,
  ).toBe(403);
  expect(
    db
      .prepare(
        "SELECT u.display_name FROM playlists p JOIN users u ON u.id = p.created_by WHERE p.id = ?",
      )
      .pluck()
      .get(playlist.json<{ id: string }>().id),
  ).toBe("Laptop (Maria)");
  // A laptop doesn't show among the members, and can't approve another one.
  const members = (
    await call(app, "GET", "/api/communities/unu-unu/members", { as: "pavel" })
  ).json<{ name: string }[]>();
  expect(members.map((m) => m.name)).not.toContain("Laptop (Maria)");
  const next = await laptop(app, "unu-unu");
  expect(
    (
      await call(app, "POST", `/api/device-login/${next.code}/approve`, {
        cookie,
        payload: { number: next.number, as: "me" },
      })
    ).statusCode,
  ).toBe(401);

  // Not renewed, and over after 12 hours.
  vi.setSystemTime(new Date("2026-10-04T19:59:00Z"));
  expect(
    (await call(app, "GET", "/api/me", { cookie })).json().user,
  ).not.toBeNull();
  vi.setSystemTime(new Date("2026-10-04T20:01:00Z"));
  expect(
    (await call(app, "GET", "/api/me", { cookie })).json().user,
  ).toBeNull();

  // Next Sunday, Maria's laptop is the same one again.
  const again = await laptop(app, "unu-unu");
  await approve(app, "maria", again.code, {
    number: again.number,
    as: "laptop",
    community: "unu-unu",
  });
  await wait(app, again.token);
  expect(
    db
      .prepare("SELECT count(*) FROM users WHERE device_of = 'maria'")
      .pluck()
      .get(),
  ).toBe(1);
});

test("Maria sees and ends the laptops she logged in; deleting her account ends them", async () => {
  const app = server();
  const { code, number, token } = await laptop(app);
  await approve(app, "maria", code, {
    number,
    as: "laptop",
    community: "unu-unu",
  });
  const cookie = cookieOf(await wait(app, token));
  const devices = (
    await call(app, "GET", "/api/me/devices", { as: "maria" })
  ).json<{ id: string; name: string; kind: string; community: string }[]>();
  expect(devices).toMatchObject([
    { name: "Laptop (Maria)", kind: "laptop", community: "unu-unu" },
  ]);
  expect(
    (await call(app, "GET", "/api/me/devices", { as: "pavel" })).json(),
  ).toEqual([]);
  // Only hers to end.
  expect(
    (
      await call(app, "DELETE", `/api/me/devices/${devices[0]?.id}`, {
        as: "pavel",
      })
    ).statusCode,
  ).toBe(404);
  expect(
    (
      await call(app, "DELETE", `/api/me/devices/${devices[0]?.id}`, {
        as: "maria",
      })
    ).statusCode,
  ).toBe(204);
  expect(
    (await call(app, "GET", "/api/me", { cookie })).json().user,
  ).toBeNull();

  const second = await laptop(app);
  await approve(app, "maria", second.code, {
    number: second.number,
    as: "laptop",
    community: "unu-unu",
  });
  const secondCookie = cookieOf(await wait(app, second.token));
  expect(
    (await call(app, "DELETE", "/api/me", { as: "maria" })).statusCode,
  ).toBe(204);
  expect(
    (await call(app, "GET", "/api/me", { cookie: secondCookie })).json().user,
  ).toBeNull();
  expect(
    db
      .prepare("SELECT display_name FROM users WHERE device_of = 'maria'")
      .pluck()
      .all(),
  ).toEqual([""]);
});

test("a guest musician: approved from the guest's QR, or with the band member's guest QR; 4 hours, named after both", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-04T08:00:00Z"));
  const app = server();
  // Maria scans the QR on Vlad's phone.
  const { code, number, token } = await laptop(app);
  expect(
    (
      await approve(app, "maria", code, {
        number,
        as: "guest",
        community: "unu-unu",
      })
    ).statusCode,
  ).toBe(400);
  await approve(app, "maria", code, {
    number,
    as: "guest",
    community: "unu-unu",
    guest: "Vlad",
  });
  const loggedIn = await wait(app, token);
  expect(String(loggedIn.headers["set-cookie"])).toMatch(/Max-Age=14400/);
  expect(
    (await call(app, "GET", "/api/me", { cookie: cookieOf(loggedIn) })).json()
      .user,
  ).toMatchObject({ displayName: "Vlad (guest of Maria)", device: "guest" });

  // Or Vlad scans the guest QR on Maria's phone.
  expect(
    (
      await call(app, "POST", "/api/communities/unu-unu/guest-passes", {
        as: "ana",
        payload: { guest: "Dan" },
      })
    ).statusCode,
  ).toBe(403);
  const pass = await call(
    app,
    "POST",
    "/api/communities/unu-unu/guest-passes",
    {
      as: "maria",
      payload: { guest: "Dan", language: "ro" },
    },
  );
  expect(pass.statusCode).toBe(201);
  const passCode = pass.json<{ code: string }>().code;
  const opened = (
    await call(app, "GET", `/api/guest-passes/${passCode}`)
  ).json<{
    claim: string;
  }>();
  expect(opened).toEqual({
    name: "Dan (invitat de Maria)",
    community: "unu-unu",
    claim: expect.any(String),
  });
  // The first phone claims it: another phone finds it gone, a reload with the claim doesn't.
  expect(
    (await call(app, "GET", `/api/guest-passes/${passCode}`)).statusCode,
  ).toBe(404);
  expect(
    (
      await call(
        app,
        "GET",
        `/api/guest-passes/${passCode}?claim=${opened.claim}`,
      )
    ).statusCode,
  ).toBe(200);
  expect(
    (await call(app, "POST", `/api/guest-passes/${passCode}`, { payload: {} }))
      .statusCode,
  ).toBe(404);
  const guest = await call(app, "POST", `/api/guest-passes/${passCode}`, {
    payload: { claim: opened.claim },
  });
  expect(guest.json()).toEqual({ community: "unu-unu" });
  const guestCookie = cookieOf(guest);
  expect(
    (await call(app, "GET", "/api/me", { cookie: guestCookie })).json()
      .memberships,
  ).toEqual([{ community: "unu-unu", roles: ["team"] }]);
  // Once.
  expect(
    (
      await call(app, "POST", `/api/guest-passes/${passCode}`, {
        payload: { claim: opened.claim },
      })
    ).statusCode,
  ).toBe(404);
  vi.setSystemTime(new Date("2026-10-04T12:01:00Z"));
  expect(
    (await call(app, "GET", "/api/me", { cookie: guestCookie })).json().user,
  ).toBeNull();
});

test("the team's phones on the laptop's address are offered its login; other addresses and other members aren't", async () => {
  const app = server();
  const address = await app.listen({ port: 0, host: "127.0.0.1" });
  try {
    const phone = async (user: string, from: string, agent = iPhone) => {
      const ws = new WebSocket(`${address.replace("http", "ws")}/api/live`, {
        headers: {
          cookie: `__Host-session=${sessions[user]}`,
          "x-forwarded-for": from,
          "user-agent": agent,
        },
      } as unknown as string[]);
      const offers: NearbyLogin[][] = [];
      ws.addEventListener("message", (e) => {
        const message = JSON.parse(String(e.data)) as ServerMessage;
        if (message.type === "event")
          offers.push(message.data as NearbyLogin[]);
      });
      await new Promise((resolve) => ws.addEventListener("open", resolve));
      ws.send(
        JSON.stringify({ type: "subscribe", topic: "device-logins:unu-unu" }),
      );
      return { ws, latest: () => offers.at(-1) };
    };
    const church = "198.51.100.7";
    const maria = await phone("maria", church);
    const away = await phone("maria", "192.0.2.1");
    const ana = await phone("ana", church);
    // An operator's laptop isn't interrupted.
    const desk = await phone("maria", church, "Mozilla/5.0 (Macintosh)");
    await vi.waitFor(() => expect(maria.latest()).toEqual([]));

    // A phone's login page isn't offered: it's someone logging in on their own phone.
    await call(app, "POST", "/api/device-login", {
      payload: { community: "unu-unu" },
      from: church,
      agent: iPhone,
    });
    const { code, number } = await laptop(app, "unu-unu", church);
    await vi.waitFor(() =>
      expect(maria.latest()).toMatchObject([{ code, number }]),
    );
    expect(maria.latest()).toHaveLength(1);
    await approve(app, "maria", code, { number, as: "me" });
    await vi.waitFor(() => expect(maria.latest()).toEqual([]));
    expect(away.latest()).toEqual([]);
    expect(desk.latest()).toEqual([]);
    // Ana isn't on the team: she can't follow the offers.
    expect(ana.latest()).toBeUndefined();
    for (const p of [maria, away, ana, desk]) p.ws.close();
  } finally {
    await app.close();
  }
});
