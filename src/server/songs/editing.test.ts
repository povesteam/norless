import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import {
  EDIT_LOCK_MS,
  type SectionEdit,
  type ServerMessage,
} from "../../shared/live.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import { attachEditing } from "./editing.js";
import { attachLive } from "../live/live.js";

let db: Db;
let app: FastifyInstance;
let address: string;
let clock: number;

beforeEach(async () => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('ana', 'Ana', 'ana@example.com', 'active', '2026-01-01', '2026-01-01'),
      ('ion', 'Ion', 'ion@example.com', 'active', '2026-01-01', '2026-01-01'),
      ('mu', 'Mu', 'mu@example.com', 'active', '2026-01-01', '2026-01-01');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m1', 'c', 'ana', '["editor"]', 'active', '2026-01-01', '2026-01-01'),
      ('m2', 'c', 'ion', '["owner"]', 'active', '2026-01-01', '2026-01-01'),
      ('m3', 'c', 'mu', '["team"]', 'active', '2026-01-01', '2026-01-01');
    INSERT INTO songs (id, community_id, created_at, updated_at) VALUES ('s', 'c', '2026-01-01', '2026-01-01');
  `);
  clock = Date.parse("2026-10-01T10:00:00Z");
  app = Fastify();
  attachEditing(attachLive(app, { db }), db, () => clock);
  address = await app.listen({ port: 0, host: "127.0.0.1" });
});

afterEach(() => app.close());

/** A connection as a user (or a visitor), following the song's editing topic. */
async function join(user: string | null) {
  const ws = new WebSocket(`${address.replace("http", "ws")}/api/live`, {
    headers: user
      ? { cookie: `__Host-session=${createSession(db, user)}` }
      : {},
  } as unknown as string[]);
  const states: SectionEdit[][] = [];
  ws.addEventListener("message", (e) => {
    const message = JSON.parse(String(e.data)) as ServerMessage;
    if (message.type === "event") states.push(message.data as SectionEdit[]);
  });
  await new Promise((resolve) => ws.addEventListener("open", resolve));
  ws.send(JSON.stringify({ type: "subscribe", topic: "editing:s" }));
  const edit = (section: number, draft: string | null) =>
    ws.send(
      JSON.stringify({
        type: "editing",
        song: "s",
        language: "ro",
        section,
        draft,
      }),
    );
  const latest = () =>
    states.at(-1)?.map((e) => `${e.name}:${e.section}:${e.draft}`);
  return { ws, states, edit, latest };
}

test("members see who edits which section, and the draft as it's typed", async () => {
  const ana = await join("ana");
  const ion = await join("ion");
  await vi.waitFor(() => expect(ion.states).toHaveLength(1)); // the current state on subscribe

  ana.edit(1, "R:\nRefre");
  ana.edit(1, "R:\nRefren");
  await vi.waitFor(() => expect(ion.latest()).toEqual(["Ana:1:R:\nRefren"]));

  ana.edit(1, null);
  await vi.waitFor(() => expect(ion.latest()).toEqual([]));
});

test("a song has one editor, until 5 minutes without typing", async () => {
  const ana = await join("ana");
  const ion = await join("ion");
  ana.edit(1, "Ana's draft");
  await vi.waitFor(() => expect(ion.latest()).toEqual(["Ana:1:Ana's draft"]));

  // Another section of the same song is taken too.
  ion.edit(2, "Another section");
  await vi.waitFor(() => expect(ion.states.length).toBeGreaterThan(1));
  expect(ana.latest()).toEqual(["Ana:1:Ana's draft"]);

  clock += EDIT_LOCK_MS;
  ion.edit(2, "Taken over");
  await vi.waitFor(() => expect(ana.latest()).toEqual(["Ion:2:Taken over"]));
});

test("closing the connection ends its edits", async () => {
  const ana = await join("ana");
  const ion = await join("ion");
  ana.edit(0, "Draft");
  await vi.waitFor(() => expect(ion.latest()).toEqual(["Ana:0:Draft"]));

  ana.ws.close();
  await vi.waitFor(() => expect(ion.latest()).toEqual([]));
});

test("visitors can't follow it; the team, who edit chords, hold it too", async () => {
  const visitor = await join(null);
  const team = await join("mu");
  const ion = await join("ion");
  await vi.waitFor(() => expect(team.states).toHaveLength(1));

  team.edit(-1, "");
  await vi.waitFor(() => expect(ion.latest()).toEqual(["Mu:-1:"]));
  expect(visitor.states).toEqual([]);
});
