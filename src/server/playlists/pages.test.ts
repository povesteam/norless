import { beforeEach, describe, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import { framingAllowed, isPrivateAddress } from "./pages.js";

let db: Db;
let sessions: Record<string, string>;

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('owner', 'Ow', 'ow@example.com', 'active', '2026-01-01', '2026-01-01'),
      ('team', 'Te', 'te@example.com', 'active', '2026-01-01', '2026-01-01'),
      ('ed', 'Ed', 'ed@example.com', 'active', '2026-01-01', '2026-01-01');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m1', 'c', 'owner', '["owner"]', 'active', '2026-01-01', '2026-01-01'),
      ('m2', 'c', 'team', '["team"]', 'active', '2026-01-01', '2026-01-01'),
      ('m3', 'c', 'ed', '["editor"]', 'active', '2026-01-01', '2026-01-01');
  `);
  sessions = {
    owner: createSession(db, "owner"),
    team: createSession(db, "team"),
    ed: createSession(db, "ed"),
  };
});

// Pages whose address has "framed" can be shown in a frame; the network isn't used.
const app = () =>
  buildApp({
    db,
    logger: false,
    embedding: async (url) => url.includes("framed"),
  });
const call = (
  as: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  payload?: object,
) =>
  app().inject({
    method,
    url: `/api/communities/unu-unu${path}`,
    headers: { cookie: `__Host-session=${sessions[as]}` },
    payload,
  });
const names = async () =>
  (await call("team", "GET", "/pages"))
    .json<{ name: string }[]>()
    .map((p) => p.name);

describe("pages", () => {
  test("owners keep https pages in order; a page that can't be framed is flagged", async () => {
    const start = await call("owner", "POST", "/pages", {
      name: "Start",
      url: "https://example.com/framed/start",
    });
    expect(start.json()).toMatchObject({ embeddable: true });
    const end = await call("owner", "POST", "/pages", {
      name: "Final",
      url: "https://example.com/end",
    });
    expect(end.json()).toMatchObject({ embeddable: false });
    expect(
      (
        await call("owner", "POST", "/pages", {
          name: "Plain",
          url: "http://example.com",
        })
      ).statusCode,
    ).toBe(400);
    expect(await names()).toEqual(["Start", "Final"]);

    const finalId = end.json<{ id: string }>().id;
    await call("owner", "POST", `/pages/${finalId}/move`, { by: -1 });
    expect(await names()).toEqual(["Final", "Start"]);
    await call("owner", "PUT", `/pages/${finalId}`, {
      name: "Anunțuri",
      url: "https://example.com/framed/end",
    });
    await call("owner", "DELETE", `/pages/${start.json<{ id: string }>().id}`);
    expect(await names()).toEqual(["Anunțuri"]);
  });

  test("the team sees pages and owners change them", async () => {
    expect((await call("ed", "GET", "/pages")).statusCode).toBe(403);
    expect(
      (
        await call("team", "POST", "/pages", {
          name: "x",
          url: "https://example.com",
        })
      ).statusCode,
    ).toBe(403);
  });

  test("a projected page stays until cleared, blanked or an entry goes live", async () => {
    const { id } = (
      await call("owner", "POST", "/pages", {
        name: "Start",
        url: "https://example.com/framed",
      })
    ).json<{ id: string }>();
    const live = async (action: object) =>
      (await call("team", "POST", "/live", action)).json<{
        page: { name: string } | null;
      }>();
    expect((await live({ type: "page", pageId: id })).page?.name).toBe("Start");
    expect((await live({ type: "blank", blank: true })).page).toBeNull();
    expect((await live({ type: "page", pageId: id })).page?.name).toBe("Start");
    expect((await live({ type: "page", pageId: null })).page).toBeNull();
    expect((await live({ type: "page", pageId: "missing" })).page).toBeNull();
  });
});

test("only frames that any site may show count as embeddable", () => {
  expect(framingAllowed(null, null)).toBe(true);
  expect(framingAllowed("DENY", null)).toBe(false);
  expect(framingAllowed("sameorigin", null)).toBe(false);
  expect(
    framingAllowed(null, "default-src 'self'; frame-ancestors 'self'"),
  ).toBe(false);
  expect(framingAllowed(null, "frame-ancestors *")).toBe(true);
  expect(framingAllowed(null, "frame-ancestors https:")).toBe(true);
  expect(framingAllowed(null, "default-src 'self'")).toBe(true);
});

test("addresses on the server's own network aren't fetched", () => {
  for (const address of [
    "10.0.0.1",
    "127.0.0.1",
    "192.168.1.5",
    "172.20.0.1",
    "169.254.1.1",
    "::1",
    "fd00::1",
    "::ffff:10.0.0.1",
  ])
    expect(isPrivateAddress(address)).toBe(true);
  for (const address of ["93.184.216.34", "172.32.0.1", "2606:4700::1"])
    expect(isPrivateAddress(address)).toBe(false);
});

test("owners put the follow-along QR code on a page", async () => {
  const { id } = (
    await call("owner", "POST", "/pages", {
      name: "Start",
      url: "https://example.com/framed/start",
    })
  ).json<{ id: string }>();
  expect(
    (await call("team", "PUT", `/pages/${id}/qr`, { qr: true })).statusCode,
  ).toBe(403);
  expect(
    (await call("owner", "PUT", `/pages/${id}/qr`, { qr: true })).statusCode,
  ).toBe(204);
  expect((await call("team", "GET", "/pages")).json()).toMatchObject([
    { name: "Start", qr: true },
  ]);
});
