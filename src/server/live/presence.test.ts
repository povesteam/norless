import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { OnlineMember, ServerMessage } from "../../shared/live.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import { attachLive } from "./live.js";
import { attachPresence } from "./presence.js";

let db: Db;
let app: FastifyInstance;
let address: string;

beforeEach(async () => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('ana', 'Ana', 'ana@example.com', 'active', '2026-01-01', '2026-01-01'),
      ('ion', 'Ion', 'ion@example.com', 'active', '2026-01-01', '2026-01-01'),
      ('st', 'St', 'st@example.com', 'active', '2026-01-01', '2026-01-01');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m1', 'c', 'ana', '["team"]', 'active', '2026-01-01', '2026-01-01'),
      -- Members see who is online with or without a role.
      ('m2', 'c', 'ion', '[]', 'active', '2026-01-01', '2026-01-01');
  `);
  app = Fastify();
  attachPresence(attachLive(app, { db }), db);
  address = await app.listen({ port: 0, host: "127.0.0.1" });
});

afterEach(() => app.close());

const laptop = "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_0) Chrome/140";
const phone =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) Mobile/15E148";

async function online(user: string | null, userAgent = laptop) {
  const ws = new WebSocket(`${address.replace("http", "ws")}/api/live`, {
    headers: {
      "user-agent": userAgent,
      ...(user ? { cookie: `__Host-session=${createSession(db, user)}` } : {}),
    },
  } as unknown as string[]);
  const lists: OnlineMember[][] = [];
  ws.addEventListener("message", (e) => {
    const message = JSON.parse(String(e.data)) as ServerMessage;
    if (message.type === "event") lists.push(message.data as OnlineMember[]);
  });
  await new Promise((resolve) => ws.addEventListener("open", resolve));
  ws.send(JSON.stringify({ type: "subscribe", topic: "presence:unu-unu" }));
  return { ws, lists, latest: () => lists.at(-1) };
}

test("members see who is online, with each person's devices", async () => {
  const ana = await online("ana");
  await online("ion", phone);
  await online("ana", phone);

  await vi.waitFor(() =>
    expect(ana.latest()).toEqual([
      {
        userId: "ana",
        name: "Ana",
        avatar: null,
        devices: ["computer", "phone"],
        views: [],
      },
      {
        userId: "ion",
        name: "Ion",
        avatar: null,
        devices: ["phone"],
        views: [],
      },
    ]),
  );
});

test("a member's stage view shows in presence, without following it, and goes with its device", async () => {
  const ana = await online("ana");
  const guitar = {
    view: "musicians",
    layout: "bar-grid",
    languages: ["ro"],
    textSize: 1.2,
    dark: true,
    device: "phone",
    profile: {
      plays: ["guitar"],
      shapes: ["G"],
      naming: "letters",
      colors: false,
    },
  };
  // The musicians view on Ion's phone reports what it shows; it isn't in the app's frame.
  const ws = new WebSocket(`${address.replace("http", "ws")}/api/live`, {
    headers: {
      "user-agent": phone,
      cookie: `__Host-session=${createSession(db, "ion")}`,
    },
  } as unknown as string[]);
  await new Promise((resolve) => ws.addEventListener("open", resolve));
  ws.send(
    JSON.stringify({ type: "stage-view", community: "unu-unu", view: guitar }),
  );
  await vi.waitFor(() =>
    expect(ana.latest()?.find((p) => p.name === "Ion")).toMatchObject({
      devices: ["phone"],
      views: [{ ...guitar, id: expect.any(Number) }],
    }),
  );
  // A visitor's report counts for nothing.
  const visitor = await online(null);
  visitor.ws.send(
    JSON.stringify({ type: "stage-view", community: "unu-unu", view: guitar }),
  );
  ws.close();
  await vi.waitFor(() =>
    expect(ana.latest()).toEqual([expect.objectContaining({ name: "Ana" })]),
  );
});

test("closing the app goes offline", async () => {
  const ana = await online("ana");
  const ion = await online("ion", phone);
  await vi.waitFor(() => expect(ana.latest()).toHaveLength(2));

  ion.ws.close();
  await vi.waitFor(() =>
    expect(ana.latest()).toEqual([expect.objectContaining({ name: "Ana" })]),
  );
});

test("visitors and non-members neither see nor appear", async () => {
  const ana = await online("ana");
  const visitor = await online(null);
  const stranger = await online("st");
  await vi.waitFor(() => expect(ana.latest()).toHaveLength(1));

  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(visitor.lists).toEqual([]);
  expect(stranger.lists).toEqual([]);
  expect(ana.latest()).toEqual([expect.objectContaining({ name: "Ana" })]);
});
