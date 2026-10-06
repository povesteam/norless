import { beforeEach, expect, test } from "vitest";
import type { UsageBatch } from "../../shared/usage.js";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";

let db: Db;
let sessions: Record<"ana" | "ion", string>;

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro","uk"]', 'Europe/Bucharest', 'x', 'x');
    INSERT INTO users (id, display_name, email, status, preferences, created_at, updated_at) VALUES
      ('ana', 'Ana', 'ana@example.com', 'active', '{}', 'x', 'x'),
      ('ion', 'Ion', 'ion@example.com', 'active', '{"countUsage":false}', 'x', 'x');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m-ana', 'c', 'ana', '["team"]', 'active', 'x', 'x'),
      ('m-ion', 'c', 'ion', '["team"]', 'active', 'x', 'x');
  `);
  sessions = { ana: createSession(db, "ana"), ion: createSession(db, "ion") };
});

const send = (as: "ana" | "ion" | null, payload: UsageBatch) =>
  buildApp({ db, logger: false }).inject({
    method: "POST",
    url: "/api/usage",
    headers: as ? { cookie: `__Host-session=${sessions[as]}` } : {},
    payload,
  });

const events = () =>
  db
    .prepare(
      "SELECT at, community_id, user_id, device_type, layout, feature, detail FROM usage_events ORDER BY at, rowid",
    )
    .all();

test("a member's events are kept with them, their community and when they happened", async () => {
  const before = Date.now();
  const response = await send("ana", {
    deviceType: "laptop",
    events: [
      {
        feature: "live.go",
        community: "unu-unu",
        ago: 5000,
        detail: { via: "double-click" },
      },
      {
        feature: "layout.shown",
        community: "unu-unu",
        layout: "controller",
        ago: 0,
        detail: { view: "controlling" },
      },
    ],
  });
  expect(response.statusCode).toBe(204);
  const [go, shown] = events() as [{ at: string }, { at: string }];
  expect(go).toMatchObject({
    community_id: "c",
    user_id: "ana",
    device_type: "laptop",
    layout: null,
    feature: "live.go",
    detail: '{"via":"double-click"}',
  });
  expect(Date.parse(go.at)).toBeGreaterThanOrEqual(before - 5000);
  expect(Date.parse(go.at)).toBeLessThan(Date.parse(shown.at));
  expect(shown).toMatchObject({ layout: "controller", user_id: "ana" });
});

test("a member who switched counting off is counted without their id", async () => {
  await send("ion", {
    deviceType: "phone",
    events: [
      {
        feature: "live.next",
        community: "unu-unu",
        ago: 0,
        detail: { via: "button" },
      },
    ],
  });
  expect(events()).toMatchObject([{ feature: "live.next", user_id: null }]);
});

test("a visitor's events carry no member, and none outside a community", async () => {
  expect(
    (
      await send(null, {
        deviceType: "phone",
        events: [
          { feature: "error.shown", ago: 0, detail: { page: "/login" } },
        ],
      })
    ).statusCode,
  ).toBe(204);
  expect(events()).toMatchObject([
    { feature: "error.shown", user_id: null, community_id: null },
  ]);
});

test("unknown names and ways are refused, and nothing of the batch is kept", async () => {
  const known = {
    feature: "live.blank",
    ago: 0,
    detail: { via: "key" },
  } as const;
  expect(
    (
      await send("ana", {
        deviceType: "laptop",
        events: [known, { feature: "live.teleport" as "live.go", ago: 0 }],
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await send("ana", {
        deviceType: "laptop",
        events: [
          known,
          { feature: "live.go", ago: 0, detail: { via: "mind" } },
        ],
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await send("ana", {
        deviceType: "laptop",
        events: [{ feature: "live.go", ago: 0 }],
      })
    ).statusCode,
  ).toBe(400);
  expect(events()).toEqual([]);
});

const appTeam = (as: "ana" | "ion" | null, url: string) =>
  buildApp({ db, logger: false, appTeam: ["ana@example.com"] }).inject({
    method: "GET",
    url,
    headers: as ? { cookie: `__Host-session=${sessions[as]}` } : {},
  });
const insert = (
  at: string,
  feature: string,
  via: string | null,
  { user = "ana" }: { user?: string | null } = {},
) =>
  db
    .prepare(
      "INSERT INTO usage_events (id, at, community_id, user_id, device_type, feature, detail) VALUES (?, ?, 'c', ?, 'laptop', ?, ?)",
    )
    .run(
      `${at}-${feature}-${via}`,
      at,
      user,
      feature,
      via ? JSON.stringify({ via }) : null,
    );

test("only the app team reads usage", async () => {
  for (const url of [
    "/api/app-usage",
    "/api/app-usage/timeline?feature=live.go",
    "/api/app-usage/events",
    "/api/app-usage/events.csv",
  ]) {
    expect((await appTeam(null, url)).statusCode).toBe(401);
    // An owner or any other member isn't the app team.
    expect((await appTeam("ion", url)).statusCode).toBe(403);
    expect((await appTeam("ana", url)).statusCode).toBe(200);
  }
});

test("lists the ways not used for 30 days, leaving out those of features switched off", async () => {
  const recent = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const old = new Date(Date.now() - 40 * 86_400_000).toISOString();
  insert(recent, "live.go", "double-click");
  insert(old, "live.go", "go-button");
  type Overview = {
    communities: {
      unused: { feature: string; via: string | null; lastAt: string | null }[];
    }[];
  };
  const unused = async () => {
    const { communities } = (
      await appTeam("ana", "/api/app-usage")
    ).json<Overview>();
    return communities[0];
  };
  const classic = await unused();
  const ways = classic?.unused.map((u) => `${u.feature} ${u.via}`);
  expect(ways).not.toContain("live.go double-click");
  expect(ways).toContain("live.go enter");
  expect(ways).toContain("error.shown null");
  // Part buttons come with the laptop layouts, switched off.
  expect(ways).not.toContain("live.go part");
  expect(classic?.unused).toContainEqual({
    feature: "live.go",
    via: "go-button",
    lastAt: old,
  });

  db.prepare(
    `UPDATE communities SET switches = '{"appFrame":true,"layouts":true}'`,
  ).run();
  const operator = (await unused())?.unused.map((u) => `${u.feature} ${u.via}`);
  expect(operator).toContain("live.go part");
});

test("a feature's timeline per day and per week, by way", async () => {
  // Saturday and Sunday of one week, then Monday of the next.
  insert("2026-10-03T18:00:00.000Z", "live.go", "double-click");
  insert("2026-10-04T08:00:00.000Z", "live.go", "double-click");
  insert("2026-10-04T08:05:00.000Z", "live.go", "enter");
  insert("2026-10-05T08:00:00.000Z", "live.go", "enter");
  insert("2026-10-05T08:00:00.000Z", "live.next", "clicker");
  expect(
    (
      await appTeam("ana", "/api/app-usage/timeline?feature=live.go&by=day")
    ).json(),
  ).toEqual([
    { period: "2026-10-03", via: "double-click", count: 1 },
    { period: "2026-10-04", via: "double-click", count: 1 },
    { period: "2026-10-04", via: "enter", count: 1 },
    { period: "2026-10-05", via: "enter", count: 1 },
  ]);
  expect(
    (
      await appTeam("ana", "/api/app-usage/timeline?feature=live.go&by=week")
    ).json(),
  ).toEqual([
    { period: "2026-09-28", via: "double-click", count: 2 },
    { period: "2026-09-28", via: "enter", count: 1 },
    { period: "2026-10-05", via: "enter", count: 1 },
  ]);
});

test("one service's events in order with who, and every event as CSV", async () => {
  insert("2026-10-04T07:59:00.000Z", "live.go", "enter");
  insert("2026-10-04T08:00:00.000Z", "live.go", "double-click");
  insert("2026-10-04T08:01:00.000Z", "search.pick", "song", { user: null });
  insert("2026-10-04T10:00:00.000Z", "live.blank", "key");
  const events = (
    await appTeam(
      "ana",
      "/api/app-usage/events?community=unu-unu&from=2026-10-04T08:00:00.000Z&to=2026-10-04T09:30:00.000Z",
    )
  ).json<{ feature: string; via: string; name: string | null }[]>();
  expect(events.map((e) => [e.feature, e.via, e.name])).toEqual([
    ["live.go", "double-click", "Ana"],
    ["search.pick", "song", null],
  ]);

  const csv = await appTeam("ana", "/api/app-usage/events.csv");
  expect(csv.headers["content-type"]).toContain("text/csv");
  const lines = csv.body.trim().split("\n");
  expect(lines[0]).toBe(
    "at,community,userId,deviceType,layout,feature,via,detail",
  );
  expect(lines).toHaveLength(5);
  expect(lines[2]).toBe(
    '2026-10-04T08:00:00.000Z,unu-unu,ana,laptop,,live.go,double-click,"{""via"":""double-click""}"',
  );
});
