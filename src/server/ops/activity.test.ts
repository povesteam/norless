import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { PlaylistActivity, ServerMessage } from "../../shared/live.js";
import { attachActivity } from "./activity.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import { attachLive } from "../live/live.js";

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
      ('ioana', 'Ioana', 'ioana@example.com', 'active', '2026-01-01', '2026-01-01'),
      ('ion', 'Ion', 'ion@example.com', 'active', '2026-01-01', '2026-01-01'),
      ('st', 'St', 'st@example.com', 'active', '2026-01-01', '2026-01-01');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m1', 'c', 'ioana', '["team"]', 'active', '2026-01-01', '2026-01-01'),
      ('m2', 'c', 'ion', '[]', 'active', '2026-01-01', '2026-01-01');
    INSERT INTO playlists (id, community_id, title, created_at, updated_at) VALUES
      ('p', 'c', 'Duminică', '2026-01-01', '2026-01-01');
  `);
  app = Fastify();
  attachActivity(attachLive(app, { db }), db);
  address = await app.listen({ port: 0, host: "127.0.0.1" });
});

afterEach(() => app.close());

async function open(user: string | null) {
  const ws = new WebSocket(`${address.replace("http", "ws")}/api/live`, {
    headers: user
      ? { cookie: `__Host-session=${createSession(db, user)}` }
      : {},
  } as unknown as string[]);
  const events: PlaylistActivity[] = [];
  ws.addEventListener("message", (e) => {
    const message = JSON.parse(String(e.data)) as ServerMessage;
    if (message.type === "event") events.push(message.data as PlaylistActivity);
  });
  await new Promise((resolve) => ws.addEventListener("open", resolve));
  const send = (message: object) => ws.send(JSON.stringify(message));
  send({ type: "subscribe", topic: "activity:p" });
  return { ws, events, send, latest: () => events.at(-1) };
}

const names = (activity?: PlaylistActivity) =>
  activity?.viewers.map((v) => v.name);

test("members see who has the playlist open, and who drags what", async () => {
  const ioana = await open("ioana");
  const ion = await open("ion");
  await vi.waitFor(() => expect(names(ion.latest())).toEqual(["Ioana", "Ion"]));

  ioana.send({ type: "dragging", playlist: "p", entry: "e1", index: 2 });
  await vi.waitFor(() =>
    expect(ion.latest()?.drags).toEqual([
      { userId: "ioana", name: "Ioana", entry: "e1", index: 2 },
    ]),
  );
  ioana.send({ type: "dragging", playlist: "p", entry: "e1", index: null });
  await vi.waitFor(() => expect(ion.latest()?.drags).toEqual([]));

  // Leaving the playlist, not only closing the tab, takes Ioana off.
  ioana.send({ type: "unsubscribe", topic: "activity:p" });
  await vi.waitFor(() => expect(names(ion.latest())).toEqual(["Ion"]));
});

test("only the team's drags count, and visitors and strangers can't follow", async () => {
  const ion = await open("ion");
  const visitor = await open(null);
  const stranger = await open("st");
  await vi.waitFor(() => expect(names(ion.latest())).toEqual(["Ion"]));

  ion.send({ type: "dragging", playlist: "p", entry: "e1", index: 0 });
  ion.send({ type: "subscribe", topic: "activity:missing" });
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(ion.latest()?.drags).toEqual([]);
  expect(visitor.events).toEqual([]);
  expect(stranger.events).toEqual([]);
});

test("a dropped connection ends its drag", async () => {
  const ioana = await open("ioana");
  const ion = await open("ion");
  await vi.waitFor(() => expect(names(ion.latest())).toEqual(["Ioana", "Ion"]));
  ioana.send({ type: "dragging", playlist: "p", entry: "e1", index: 1 });
  await vi.waitFor(() => expect(ion.latest()?.drags).toHaveLength(1));

  ioana.ws.close();
  await vi.waitFor(() =>
    expect(ion.latest()).toEqual({
      viewers: [{ userId: "ion", name: "Ion", avatar: null }],
      drags: [],
    }),
  );
});
