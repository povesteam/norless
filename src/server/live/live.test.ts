import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, expect, test } from "vitest";
import type { ServerMessage } from "../../shared/live.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import { attachLive, type Live } from "./live.js";

let app: FastifyInstance;
let live: Live;
let db: Db;

async function start(options?: { heartbeatMs: number; timeoutMs: number }) {
  db = openDatabase(":memory:");
  migrate(db);
  app = Fastify();
  live = attachLive(app, { db, ...options });
  return app.listen({ port: 0, host: "127.0.0.1" });
}

afterEach(() => app.close());

/** A client that records what it receives. */
async function connect(
  address: string,
  path = "/api/live",
  headers: Record<string, string> = {},
) {
  const ws = new WebSocket(`${address.replace("http", "ws")}${path}`, {
    headers,
  } as unknown as string[]); // Node's WebSocket also takes headers
  const received: ServerMessage[] = [];
  ws.addEventListener("message", (e) =>
    received.push(JSON.parse(String(e.data)) as ServerMessage),
  );
  const closed = new Promise<void>((resolve) =>
    ws.addEventListener("close", () => resolve()),
  );
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  const send = (message: unknown) =>
    ws.send(typeof message === "string" ? message : JSON.stringify(message));
  return { ws, received, closed, send };
}

// Messages from one client arrive in order, so a round trip means earlier ones were handled.
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

test("events reach only the topic's subscribers", async () => {
  const address = await start();
  const a = await connect(address);
  const b = await connect(address);
  a.send({ type: "subscribe", topic: "playlist:1" });
  b.send({ type: "subscribe", topic: "playlist:2" });
  await settle();

  live.publish("playlist:1", { title: "Duminică" });
  await settle();

  expect(a.received).toEqual([
    { type: "event", topic: "playlist:1", data: { title: "Duminică" } },
  ]);
  expect(b.received).toEqual([]);
});

test("unsubscribing stops events", async () => {
  const address = await start();
  const a = await connect(address);
  a.send({ type: "subscribe", topic: "room:1" });
  a.send({ type: "unsubscribe", topic: "room:1" });
  await settle();

  live.publish("room:1", "slide");
  await settle();

  expect(a.received).toEqual([]);
});

test("ignores malformed messages and keeps the connection", async () => {
  const address = await start();
  const a = await connect(address);
  for (const message of ["not json", "null", "[]", { type: "subscribe" }])
    a.send(message);
  a.send({ type: "subscribe", topic: "x".repeat(201) });
  a.send({ type: "subscribe", topic: "song:1" });
  await settle();

  live.publish("x".repeat(201), 1);
  live.publish("song:1", 2);
  await settle();

  expect(a.received).toEqual([{ type: "event", topic: "song:1", data: 2 }]);
});

test("follows at most 100 topics per connection", async () => {
  const address = await start();
  const a = await connect(address);
  for (let i = 0; i <= 100; i++) a.send({ type: "subscribe", topic: `t${i}` });
  await settle();

  live.publish("t99", "in");
  live.publish("t100", "out");
  await settle();

  expect(a.received.map((m) => m.type === "event" && m.data)).toEqual(["in"]);
});

test("closes connections that send more than 64 KiB", async () => {
  const address = await start();
  const a = await connect(address);
  a.send("x".repeat(65 * 1024));

  await a.closed;
});

test("pings, and closes connections that stop answering", async () => {
  const address = await start({ heartbeatMs: 30, timeoutMs: 100 });
  const silent = await connect(address);
  const answering = await connect(address);
  answering.ws.addEventListener("message", () =>
    answering.send({ type: "pong" }),
  );

  await silent.closed;
  expect(silent.received).toContainEqual({ type: "ping" });
  expect(answering.ws.readyState).toBe(WebSocket.OPEN);
});

test("refuses other paths", async () => {
  const address = await start();

  await expect(connect(address, "/api/other")).rejects.toBeDefined();
});

test("refuses connections from other sites", async () => {
  const address = await start();

  await expect(
    connect(address, "/api/live", { origin: "https://evil.example" }),
  ).rejects.toBeDefined();
  await connect(address, "/api/live", { origin: address });
});

test("knows the session's user, for guarded topics and other messages", async () => {
  const address = await start();
  db.exec(
    "INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES ('ana', 'Ana', 'ana@example.com', 'active', '2026-01-01', '2026-01-01')",
  );
  live.onSubscribe("members:", (_, client) => client.user !== null);
  const seen: string[] = [];
  live.onMessage("hello", (client) =>
    seen.push(client.user?.displayName ?? "visitor"),
  );
  const closed: string[] = [];
  live.onClose((client) => closed.push(client.user?.displayName ?? "visitor"));

  const ana = await connect(address, "/api/live", {
    cookie: `__Host-session=${createSession(db, "ana")}`,
  });
  const visitor = await connect(address);
  for (const client of [ana, visitor]) {
    client.send({ type: "subscribe", topic: "members:c" });
    client.send({ type: "hello" });
  }
  await settle();
  live.publish("members:c", "online");
  await settle();

  expect(ana.received).toEqual([
    { type: "event", topic: "members:c", data: "online" },
  ]);
  expect(visitor.received).toEqual([]);
  expect(seen.sort()).toEqual(["Ana", "visitor"]);
  ana.ws.close();
  await ana.closed;
  await settle();
  expect(closed).toEqual(["Ana"]);
});
