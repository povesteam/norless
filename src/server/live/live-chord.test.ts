import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { WebSocket as WsClient } from "ws";
import type { ServerMessage } from "../../shared/live.js";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import type { LiveChord } from "./live-chord.js";

let db: Db;
let app: ReturnType<typeof buildApp>;
const sessions: Record<string, string> = {};

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', 'x', 'x');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('ana', 'Ana', 'ana@example.com', 'active', 'x', 'x'),
      ('ion', 'Ion', 'ion@example.com', 'active', 'x', 'x'),
      ('eva', 'Eva', 'eva@example.com', 'active', 'x', 'x');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m1', 'c', 'ana', '["team"]', 'active', 'x', 'x'),
      ('m2', 'c', 'ion', '["team"]', 'active', 'x', 'x'),
      ('m3', 'c', 'eva', '[]', 'active', 'x', 'x');
  `);
  for (const user of ["ana", "ion", "eva"])
    sessions[user] = createSession(db, user);
  app = buildApp({ db, logger: false });
});
afterEach(async () => {
  await app.close();
});

const share = (as: string | null, body: object) =>
  app.inject({
    method: "POST",
    url: "/api/communities/unu-unu/live/chord",
    headers: as ? { cookie: `__Host-session=${sessions[as]}` } : {},
    payload: body,
  });

test("the team shares chords; members follow the best source's", async () => {
  const address = await app.listen({ port: 0, host: "127.0.0.1" });
  const ws = new WsClient(`${address.replace("http", "ws")}/api/live`, {
    headers: { cookie: `__Host-session=${sessions.eva}` },
  });
  const events: ServerMessage[] = [];
  ws.on("message", (data) =>
    events.push(JSON.parse(String(data)) as ServerMessage),
  );
  await new Promise((resolve) => ws.on("open", resolve));
  ws.send(JSON.stringify({ type: "subscribe", topic: "live-chord:unu-unu" }));
  const last = () =>
    events.filter((e) => e.type === "event").at(-1)?.data as
      LiveChord | null | undefined;
  // Nobody shares yet.
  await vi.waitFor(() => expect(events.length).toBeGreaterThan(0));
  expect(last()).toBeNull();

  // A microphone, then a MIDI piano: the piano wins.
  await share("ion", { sharing: true, source: "mic", chord: "Am" });
  await vi.waitFor(() =>
    expect(last()).toEqual({ chord: "Am", source: "mic", name: "Ion" }),
  );
  await share("ana", { sharing: true, source: "midi", chord: "C" });
  await vi.waitFor(() =>
    expect(last()).toEqual({ chord: "C", source: "midi", name: "Ana" }),
  );
  await share("ion", { sharing: true, source: "mic", chord: "F" });
  expect(last()?.chord).toBe("C");
  // Nothing heard is no chord, not an empty one.
  await share("ion", { sharing: true, source: "mic", chord: null });
  await share("ion", { sharing: true, source: "mic", chord: "F" });
  // The piano stops: the microphone's shows again.
  await share("ana", { sharing: false });
  await vi.waitFor(() =>
    expect(last()).toEqual({ chord: "F", source: "mic", name: "Ion" }),
  );
  ws.close();
});

test("only the team shares, and only members follow", async () => {
  expect((await share(null, { sharing: true })).statusCode).toBe(401);
  expect((await share("eva", { sharing: true })).statusCode).toBe(403);
  expect(
    (await share("ana", { sharing: true, source: "drum" })).statusCode,
  ).toBe(400);
  expect(
    (await share("ana", { sharing: true, room: "nosuchroom12" })).statusCode,
  ).toBe(404);
});
