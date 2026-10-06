import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, expect, test, vi } from "vitest";
import { openDatabase } from "../../server/db/db";
import { attachLive, type Live } from "../../server/live/live";
import { createLive, type LiveConnection } from "./live";

let server: { app: FastifyInstance; live: Live } | null = null;
let client: LiveConnection | null = null;

async function startServer(port = 0) {
  const app = Fastify();
  const live = attachLive(app, { db: openDatabase(":memory:") });
  await app.listen({ port, host: "127.0.0.1" });
  server = { app, live };
  const address = app.server.address();
  if (typeof address !== "object" || !address) throw new Error("No address");
  return address.port;
}

afterEach(async () => {
  client?.close();
  await server?.app.close();
});

test("receives events, and reconnects and subscribes again after a server restart", async () => {
  const port = await startServer();
  client = createLive(`ws://127.0.0.1:${port}/api/live`, { maxDelayMs: 200 });
  const received: unknown[] = [];
  client.subscribe("room:1", (data) => received.push(data));
  await vi.waitFor(() => expect(client?.status()).toBe("connected"));

  // Nothing tells us when the subscription arrived, so publish until it does.
  await vi.waitFor(() => {
    server?.live.publish("room:1", "before");
    expect(received).toContain("before");
  });

  await server?.app.close();
  await vi.waitFor(() => expect(client?.status()).toBe("reconnecting"));

  await startServer(port);
  await vi.waitFor(() => expect(client?.status()).toBe("connected"));
  await vi.waitFor(() => {
    server?.live.publish("room:1", "after");
    expect(received).toContain("after");
  });
});

test("stops receiving after the last handler unsubscribes", async () => {
  const port = await startServer();
  client = createLive(`ws://127.0.0.1:${port}/api/live`);
  const first: unknown[] = [];
  const unsubscribe = client.subscribe("song:1", (data) => first.push(data));
  const other: unknown[] = [];
  client.subscribe("song:2", (data) => other.push(data));
  await vi.waitFor(() => {
    server?.live.publish("song:2", "ready");
    expect(other).toContain("ready");
  });

  unsubscribe();
  // song:2's round trip shows the unsubscribe arrived first.
  await vi.waitFor(() => {
    server?.live.publish("song:2", "later");
    expect(other).toContain("later");
  });
  server?.live.publish("song:1", "missed");
  await vi.waitFor(() => {
    server?.live.publish("song:2", "last");
    expect(other).toContain("last");
  });

  expect(first).toEqual([]);
});

test("reconnects when the server goes silent", async () => {
  const port = await startServer();
  client = createLive(`ws://127.0.0.1:${port}/api/live`, { timeoutMs: 100 });
  const statuses: string[] = [];
  client.onStatus(() => statuses.push(client?.status() ?? ""));

  // The test server pings only every 25 seconds, so the client gives up first.
  await vi.waitFor(() =>
    expect(statuses.slice(0, 3)).toEqual([
      "connected",
      "reconnecting",
      "connected",
    ]),
  );
});

test("a second handler of a topic starts from its last event", async () => {
  const port = await startServer();
  client = createLive(`ws://127.0.0.1:${port}/api/live`);
  const first: unknown[] = [];
  client.subscribe("live:unu-unu", (data) => first.push(data));
  await vi.waitFor(() => {
    server?.live.publish("live:unu-unu", { slide: 2 });
    expect(first).toContainEqual({ slide: 2 });
  });
  // The server doesn't send the state again for the same tab, so the tab hands it on.
  const second: unknown[] = [];
  client.subscribe("live:unu-unu", (data) => second.push(data));
  await vi.waitFor(() => expect(second[0]).toEqual({ slide: 2 }));
});
