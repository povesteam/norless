import { randomBytes, randomInt } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  type Screen,
  type ScreenSettings,
  type ScreenType,
  screenTypes,
  type ScreenView,
} from "../../shared/screens.js";
import { requireRole } from "../auth/auth.js";
import type { Db } from "../db/db.js";
import type { Client, Live } from "./live.js";
import { defaultRoom } from "./live-state.js";
import type { Community } from "../songs/search.js";
import { newId } from "../ids.js";
import { shortCode } from "../playlists/short-codes.js";

type ScreenInput = Omit<Screen, "id" | "secret">;

const newSecret = () => randomBytes(18).toString("base64url");

/** How long a pairing code shows before the device asks for a new one. */
const PAIRING_MS = 5 * 60_000;

/** A screen's secret, or the token of a device paired with it. */
const byKey = `(s.secret = ? OR s.id IN (
  SELECT screen_id FROM screen_devices WHERE token = ? AND deleted_at IS NULL))`;

/** A device paired as one of the room's screens. */
export type PairedDevice = {
  id: string;
  screenId: string;
  pairedAt: string;
  /** Who paired it, by name. */
  pairedBy: string | null;
};

type Row = {
  id: string;
  name: string;
  type: ScreenType;
  languages: string;
  layout: string | null;
  settings: string;
  secret: string;
};
const toScreen = (row: Row): Screen => ({
  id: row.id,
  name: row.name,
  type: row.type,
  languages: JSON.parse(row.languages) as string[],
  layout: row.layout,
  settings: JSON.parse(row.settings) as ScreenSettings,
  secret: row.secret,
});

export function listScreens(db: Db, communityId: string): Screen[] {
  return (
    db
      .prepare(
        `SELECT id, name, type, languages, layout, settings, secret FROM screens
         WHERE community_id = ? AND deleted_at IS NULL ORDER BY position, created_at`,
      )
      .all(communityId) as Row[]
  ).map(toScreen);
}

/**
 * A screen by its secret or a paired device's token, with its community; null for an
 * old or unknown one.
 */
export function screenBySecret(db: Db, secret: string): ScreenView | null {
  const row = db
    .prepare(
      `SELECT s.id, s.name, s.type, s.languages, s.layout, s.settings, s.secret,
         c.slug, c.languages AS community_languages
       FROM screens s JOIN communities c ON c.id = s.community_id
       WHERE ${byKey} AND s.deleted_at IS NULL AND c.deleted_at IS NULL`,
    )
    .get(secret, secret) as
    (Row & { slug: string; community_languages: string }) | undefined;
  if (!row) return null;
  const { id, name, type, languages, layout, settings } = toScreen(row);
  return {
    id,
    name,
    type,
    languages,
    layout,
    settings,
    community: {
      slug: row.slug,
      languages: JSON.parse(row.community_languages) as string[],
    },
  };
}

const settingsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    split: { enum: ["rows", "columns"] },
    background: { type: "string", maxLength: 30 },
    backgroundImage: {
      type: "string",
      maxLength: 2000,
      pattern: "^(https://.*)?$",
    },
    imageOpacity: { type: "number", minimum: 0, maximum: 1 },
    textColor: { type: "string", maxLength: 30 },
    font: { type: "string", maxLength: 100 },
    clock: { type: "boolean" },
    sectionStyles: {
      type: "object",
      additionalProperties: false,
      properties: Object.fromEntries(
        [
          "verse",
          "refrain",
          "bridge",
          "pre-chorus",
          "intro",
          "ending",
          "other",
        ].map((type) => [
          type,
          {
            type: "object",
            additionalProperties: false,
            properties: {
              italic: { type: "boolean" },
              bold: { type: "boolean" },
            },
          },
        ]),
      ),
    },
    overlayBackground: { enum: ["transparent", "green", "black"] },
  },
} as const;
const screenSchema = {
  type: "object",
  required: ["name", "type", "languages"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 100 },
    type: { enum: screenTypes },
    languages: {
      type: "array",
      minItems: 1,
      maxItems: 2,
      uniqueItems: true,
      items: { type: "string", maxLength: 10 },
    },
    layout: { anyOf: [{ type: "null" }, { type: "string", maxLength: 50 }] },
    settings: settingsSchema,
  },
} as const;

/**
 * Screen routes: owners define screens in the settings; the team sees them, to open
 * them; anyone with a screen's secret loads it. A change or a new secret goes out on
 * `screen:<secret>` (of the old secret), so open screens reload or stop.
 */
export function attachScreens(
  app: FastifyInstance,
  {
    db,
    live,
    findCommunity,
  }: {
    db: Db;
    live: Live;
    findCommunity: (slug: string) => Community | undefined;
  },
) {
  type Params = { slug: string; id: string };
  const authorize = (
    request: FastifyRequest,
    reply: FastifyReply,
    role: "owner" | "team",
  ) => {
    const { slug } = request.params as { slug: string };
    const community = findCommunity(slug);
    if (!community) {
      void reply.code(404).send({ error: "Not found" });
      return null;
    }
    const userId = requireRole(db, request, reply, community.id, role);
    return userId ? { community, userId } : null;
  };
  const badLanguages = (community: Community, languages: string[]) =>
    languages.some((l) => !community.languages.includes(l));
  const devicesOf = (screenId: string) =>
    db
      .prepare(
        "SELECT token FROM screen_devices WHERE screen_id = ? AND deleted_at IS NULL",
      )
      .pluck()
      .all(screenId) as string[];
  /** Tells the screen's open links and paired devices. */
  const tell = (screenId: string, secret: string, data: object) => {
    for (const key of [secret, ...devicesOf(screenId)])
      live.publish(`screen:${key}`, data);
  };
  const find = (communityId: string, id: string) =>
    db
      .prepare(
        "SELECT secret FROM screens WHERE id = ? AND community_id = ? AND deleted_at IS NULL",
      )
      .pluck()
      .get(id, communityId) as string | undefined;

  // Which screens are connected now, and since when, for the usual-screen check.
  const connected = new Map<Client, { screenId: string; rowId: string }>();
  db.prepare(
    "UPDATE screen_connections SET disconnected_at = connected_at WHERE disconnected_at IS NULL",
  ).run(); // left open when the server last stopped
  live.onSubscribe("screen:", (topic, client) => {
    const key = topic.slice("screen:".length);
    const screen = db
      .prepare(
        `SELECT s.id, s.community_id FROM screens s WHERE ${byKey} AND s.deleted_at IS NULL`,
      )
      .get(key, key) as { id: string; community_id: string } | undefined;
    if (screen) {
      const rowId = newId();
      db.prepare(
        "INSERT INTO screen_connections (id, community_id, screen_id, connected_at) VALUES (?, ?, ?, ?)",
      ).run(rowId, screen.community_id, screen.id, new Date().toISOString());
      connected.set(client, { screenId: screen.id, rowId });
    }
    return true;
  });
  live.onUnsubscribe("screen:", (_topic, client) => {
    const connection = connected.get(client);
    if (!connection) return;
    db.prepare(
      "UPDATE screen_connections SET disconnected_at = ? WHERE id = ?",
    ).run(new Date().toISOString(), connection.rowId);
    connected.delete(client);
  });

  app.get<{ Params: { secret: string } }>(
    "/api/screens/:secret",
    async (request, reply) =>
      screenBySecret(db, request.params.secret) ??
      reply.code(404).send({ error: "Not found" }),
  );

  app.get<{ Params: { slug: string } }>(
    "/api/communities/:slug/screens",
    async (request, reply) => {
      const who = authorize(request, reply, "team");
      if (!who) return reply;
      // With their short codes, so a screen's link is the same to open or to copy.
      return listScreens(db, who.community.id).map((screen) => ({
        ...screen,
        code: shortCode(db, who.community.id, "screen", screen.secret).code,
      }));
    },
  );

  app.post<{ Params: { slug: string }; Body: ScreenInput }>(
    "/api/communities/:slug/screens",
    { schema: { body: screenSchema } },
    async (request, reply) => {
      const who = authorize(request, reply, "owner");
      if (!who) return reply;
      const { community, userId } = who;
      const input = request.body;
      if (badLanguages(community, input.languages))
        return reply.code(400).send({ error: "Not a community language" });
      const id = newId();
      const at = new Date().toISOString();
      const last = db
        .prepare("SELECT max(position) FROM screens WHERE community_id = ?")
        .pluck()
        .get(community.id) as number | null;
      db.prepare(
        `INSERT INTO screens (id, community_id, room_id, name, type, languages, layout, settings, secret, position, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        community.id,
        defaultRoom(db, community.id).id,
        input.name.trim(),
        input.type,
        JSON.stringify(input.languages),
        input.layout ?? null,
        JSON.stringify(input.settings ?? {}),
        newSecret(),
        (last ?? 0) + 1,
        at,
        at,
        userId,
        userId,
      );
      return reply
        .code(201)
        .send(listScreens(db, community.id).find((s) => s.id === id));
    },
  );

  app.put<{ Params: Params; Body: ScreenInput }>(
    "/api/communities/:slug/screens/:id",
    { schema: { body: screenSchema } },
    async (request, reply) => {
      const who = authorize(request, reply, "owner");
      if (!who) return reply;
      const { community, userId } = who;
      const secret = find(community.id, request.params.id);
      if (!secret) return reply.code(404).send({ error: "Not found" });
      const input = request.body;
      if (badLanguages(community, input.languages))
        return reply.code(400).send({ error: "Not a community language" });
      db.prepare(
        `UPDATE screens SET name = ?, type = ?, languages = ?, layout = ?, settings = ?, updated_at = ?, updated_by = ?
         WHERE id = ?`,
      ).run(
        input.name.trim(),
        input.type,
        JSON.stringify(input.languages),
        input.layout ?? null,
        JSON.stringify(input.settings ?? {}),
        new Date().toISOString(),
        userId,
        request.params.id,
      );
      tell(request.params.id, secret, { changed: true });
      return reply.code(204).send();
    },
  );

  // A new secret: the old link stops working, and screens open with it stop.
  app.post<{ Params: Params }>(
    "/api/communities/:slug/screens/:id/secret",
    async (request, reply) => {
      const who = authorize(request, reply, "owner");
      if (!who) return reply;
      const secret = find(who.community.id, request.params.id);
      if (!secret) return reply.code(404).send({ error: "Not found" });
      const fresh = newSecret();
      db.prepare(
        "UPDATE screens SET secret = ?, updated_at = ?, updated_by = ? WHERE id = ?",
      ).run(fresh, new Date().toISOString(), who.userId, request.params.id);
      live.publish(`screen:${secret}`, { revoked: true });
      return { secret: fresh };
    },
  );

  app.delete<{ Params: Params }>(
    "/api/communities/:slug/screens/:id",
    async (request, reply) => {
      const who = authorize(request, reply, "owner");
      if (!who) return reply;
      const secret = find(who.community.id, request.params.id);
      if (!secret) return reply.code(404).send({ error: "Not found" });
      const at = new Date().toISOString();
      db.prepare(
        "UPDATE screens SET deleted_at = ?, updated_at = ?, updated_by = ? WHERE id = ?",
      ).run(at, at, who.userId, request.params.id);
      tell(request.params.id, secret, { revoked: true });
      return reply.code(204).send();
    },
  );

  // Codes that devices show on the pairing page, until a member types one or it runs
  // out. ponytail: in memory, so after a restart devices ask for a new code; capped so
  // a flood of requests can't grow it.
  const pending = new Map<string, { token: string; expires: number }>();
  app.post<{ Body: { token: string } }>(
    "/api/pairing",
    {
      schema: {
        body: {
          type: "object",
          required: ["token"],
          properties: { token: { type: "string", pattern: "^[\\w-]{24,64}$" } },
        },
      },
    },
    async (request, reply) => {
      const now = Date.now();
      for (const [code, waiting] of pending)
        if (waiting.expires <= now || waiting.token === request.body.token)
          pending.delete(code);
      if (pending.size >= 1000)
        return reply.code(503).send({ error: "Try again later" });
      let code: string;
      do code = String(randomInt(1_000_000)).padStart(6, "0");
      while (pending.has(code));
      const expires = now + PAIRING_MS;
      pending.set(code, { token: request.body.token, expires });
      return { code, expiresAt: new Date(expires).toISOString() };
    },
  );

  const listDevices = (communityId: string) =>
    db
      .prepare(
        `SELECT d.id, d.screen_id AS screenId, d.created_at AS pairedAt, nullif(u.display_name, '') AS pairedBy
         FROM screen_devices d JOIN screens s ON s.id = d.screen_id
         LEFT JOIN users u ON u.id = d.created_by
         WHERE d.community_id = ? AND d.deleted_at IS NULL AND s.deleted_at IS NULL
         ORDER BY d.created_at`,
      )
      .all(communityId) as PairedDevice[];

  app.get<{ Params: { slug: string } }>(
    "/api/communities/:slug/devices",
    async (request, reply) => {
      const who = authorize(request, reply, "team");
      if (!who) return reply;
      return listDevices(who.community.id);
    },
  );

  // The device showing the code becomes the screen; one paired before moves to it.
  app.post<{ Params: Params; Body: { code: string } }>(
    "/api/communities/:slug/screens/:id/devices",
    {
      schema: {
        body: {
          type: "object",
          required: ["code"],
          properties: { code: { type: "string", pattern: "^\\d{6}$" } },
        },
      },
    },
    async (request, reply) => {
      const who = authorize(request, reply, "team");
      if (!who) return reply;
      if (!find(who.community.id, request.params.id))
        return reply.code(404).send({ error: "Not found" });
      const waiting = pending.get(request.body.code);
      if (!waiting || waiting.expires <= Date.now())
        return reply.code(400).send({ error: "No device shows this code" });
      pending.delete(request.body.code);
      const id = newId();
      const at = new Date().toISOString();
      db.transaction(() => {
        db.prepare(
          "UPDATE screen_devices SET deleted_at = ?, updated_at = ?, updated_by = ? WHERE token = ? AND deleted_at IS NULL",
        ).run(at, at, who.userId, waiting.token);
        db.prepare(
          `INSERT INTO screen_devices (id, community_id, screen_id, token, created_at, updated_at, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          who.community.id,
          request.params.id,
          waiting.token,
          at,
          at,
          who.userId,
          who.userId,
        );
      })();
      live.publish(`screen:${waiting.token}`, { changed: true });
      return reply
        .code(201)
        .send(listDevices(who.community.id).find((d) => d.id === id));
    },
  );

  // Unpaired, the device shows the pairing page with a new code.
  app.delete<{ Params: Params }>(
    "/api/communities/:slug/devices/:id",
    async (request, reply) => {
      const who = authorize(request, reply, "team");
      if (!who) return reply;
      const token = db
        .prepare(
          "SELECT token FROM screen_devices WHERE id = ? AND community_id = ? AND deleted_at IS NULL",
        )
        .pluck()
        .get(request.params.id, who.community.id) as string | undefined;
      if (!token) return reply.code(404).send({ error: "Not found" });
      const at = new Date().toISOString();
      db.prepare(
        "UPDATE screen_devices SET deleted_at = ?, updated_at = ?, updated_by = ? WHERE id = ?",
      ).run(at, at, who.userId, request.params.id);
      live.publish(`screen:${token}`, { revoked: true });
      return reply.code(204).send();
    },
  );

  return {
    /** The screens connected right now. */
    connectedScreens: () =>
      new Set([...connected.values()].map((c) => c.screenId)),
  };
}
