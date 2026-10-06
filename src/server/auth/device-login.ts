import { randomBytes, randomInt } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { createSession, type SessionUser, setSessionCookie } from "./auth.js";
import type { Db } from "../db/db.js";
import { newId } from "../ids.js";
import type { Client, Live } from "../live/live.js";
import { allows, memberRoles } from "./members.js";
import { deviceOf } from "../live/presence.js";
import type { Community } from "../songs/search.js";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** How long a login page's code works, renewed while the page waits. */
export const PENDING_MS = 5 * MINUTE;
/**
 * A code counts as shown while its login page asked within this time (it asks every 2
 * seconds): a closed page's code can't be guessed and approved.
 */
export const SHOWN_MS = 10_000;
/** A laptop's session at most; the browser closing ends it sooner. */
export const LAPTOP_MS = 12 * HOUR;
export const GUEST_MS = 4 * HOUR;

export type DeviceKind = "laptop" | "guest";

/** What the member's page shows of their guest pass, as the guest opens and accepts it. */
export type GuestPassState =
  | { state: "waiting" | "opened" }
  | { state: "accepted"; name: string; until: string };
type How = "me" | DeviceKind;

/** A device waiting on the login page, until a member approves it from their phone. */
type Pending = {
  token: string;
  number: number;
  expires: number;
  address: string;
  /** The community its login page came from. */
  community: string | null;
  /** A computer's login page is offered to the team's phones nearby; a phone's isn't. */
  nearby: boolean;
  approved?: { userId: string; how: How };
  /** When its login page last asked, i.e. was still showing the code. */
  seen: number;
  /** A phone opened the code: the login page shows the number to compare. */
  opened?: boolean;
};

/** What the team's phones on the same address are offered. */
export type NearbyLogin = { code: string; number: number; expiresAt: string };

/** A laptop or guest a member logged in, while its session lasts. */
export type ApprovedDevice = {
  id: string;
  name: string;
  kind: DeviceKind;
  community: string;
  expiresAt: string;
};

const names = {
  en: { laptop: "Laptop ({by})", guest: "{name} (guest of {by})" },
  ro: { laptop: "Laptop ({by})", guest: "{name} (invitat de {by})" },
  uk: { laptop: "Ноутбук ({by})", guest: "{name} (гість: {by})" },
};

/**
 * The user a laptop or a guest's phone logs in as: its own, with the team role in the
 * community, named after who approved it. The same laptop or guest of the same member
 * gets the same one again, with its preferences.
 */
export function deviceUser(
  db: Db,
  {
    approver,
    communityId,
    kind,
    guest = "",
    language,
    now = new Date(),
  }: {
    approver: { id: string; displayName: string };
    communityId: string;
    kind: DeviceKind;
    guest?: string;
    language?: string;
    now?: Date;
  },
) {
  const words = names[language as keyof typeof names] ?? names.en;
  const name = words[kind]
    .replace("{by}", approver.displayName)
    .replace("{name}", guest);
  const at = now.toISOString();
  return db.transaction(() => {
    const known = db
      .prepare(
        `SELECT u.id FROM users u JOIN members m ON m.user_id = u.id
         WHERE u.device_of = ? AND u.device_kind = ? AND u.display_name = ? AND u.status = 'active'
           AND m.community_id = ?`,
      )
      .pluck()
      .get(approver.id, kind, name, communityId) as string | undefined;
    if (known) return known;
    const id = newId();
    db.prepare(
      `INSERT INTO users (id, display_name, status, device_of, device_kind, created_at, updated_at)
       VALUES (?, ?, 'active', ?, ?, ?, ?)`,
    ).run(id, name, approver.id, kind, at, at);
    db.prepare(
      `INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at, created_by, updated_by)
       VALUES (?, ?, ?, '["team"]', 'active', ?, ?, ?, ?)`,
    ).run(newId(), communityId, id, at, at, approver.id, approver.id);
    return id;
  })();
}

/** Logs the request's browser in as a device user, for its time. */
function logInDevice(
  db: Db,
  reply: Parameters<typeof setSessionCookie>[0],
  userId: string,
  kind: DeviceKind,
) {
  const lifetime = kind === "laptop" ? LAPTOP_MS : GUEST_MS;
  const token = createSession(db, userId, new Date(), lifetime);
  // A laptop's cookie ends with its browser; a guest's phone keeps it its 4 hours.
  setSessionCookie(reply, token, kind === "laptop" ? null : lifetime);
}

const sixDigits = () => String(randomInt(1_000_000)).padStart(6, "0");

/**
 * Logging a device in from a logged-in phone: the login page shows a
 * code (as a QR) and a number; a member opens the code on their phone, sees the same
 * number, and logs the device in as themselves, as the community's laptop, or as a
 * guest musician. The team's phones on the same address are offered it without
 * scanning. Guest passes go the other way: a band member shows a QR that logs the
 * guest's phone in.
 */
export function attachDeviceLogin(
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
  // ponytail: in memory, so a restart asks for a new code; capped against floods.
  const pending = new Map<string, Pending>();
  // A pass is claimed by the first phone that opens it; the member's page follows it on
  // `guest-pass:<code>` (live-updates spec).
  const passes = new Map<
    string,
    {
      userId: string;
      slug: string;
      expires: number;
      approverId: string;
      claim: string | null;
    }
  >();
  const passState = (code: string, state: GuestPassState) =>
    live.publish(`guest-pass:${code}`, state);
  live.onSubscribe("guest-pass:", (topic, client) => {
    const code = topic.slice("guest-pass:".length);
    const pass = passes.get(code);
    if (!pass || client.user?.id !== pass.approverId) return false;
    client.send({
      type: "event",
      topic,
      data: {
        state: pass.claim ? "opened" : "waiting",
      } satisfies GuestPassState,
    });
    return true;
  });
  const sweep = (now = Date.now()) => {
    for (const [code, p] of pending) if (p.expires <= now) pending.delete(code);
    for (const [code, p] of passes) if (p.expires <= now) passes.delete(code);
  };

  // The nearby offer: the team's phones following `device-logins:<slug>`, by address.
  const watching = new Map<Client, string>();
  // Only phones are offered: an operator's laptop isn't interrupted mid-service.
  const offersFor = (slug: string, client: Client): NearbyLogin[] =>
    [...pending]
      .filter(
        ([, p]) =>
          deviceOf(client.userAgent) === "phone" &&
          p.nearby &&
          !p.approved &&
          p.expires > Date.now() &&
          p.community === slug &&
          p.address === client.address,
      )
      .map(([code, p]) => ({
        code,
        number: p.number,
        expiresAt: new Date(p.expires).toISOString(),
      }));
  const tell = (client: Client, slug: string) =>
    client.send({
      type: "event",
      topic: `device-logins:${slug}`,
      data: offersFor(slug, client),
    });
  const tellNearby = (p: Pending) => {
    for (const [client, slug] of watching)
      if (slug === p.community && client.address === p.address)
        tell(client, slug);
  };
  live.onSubscribe("device-logins:", (topic, client) => {
    const slug = topic.slice("device-logins:".length);
    const community = findCommunity(slug);
    const { user } = client;
    if (
      !community ||
      !user ||
      user.device ||
      !allows(memberRoles(db, community.id, user.id), "team")
    )
      return false;
    watching.set(client, slug);
    tell(client, slug);
    return true;
  });
  live.onUnsubscribe("device-logins:", (_topic, client) =>
    watching.delete(client),
  );
  live.onClose((client) => watching.delete(client));

  // The login page asks for a code, and waits.
  app.post<{ Body: { community?: string } }>(
    "/api/device-login",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: { community: { type: "string", maxLength: 100 } },
        },
      },
    },
    async (request, reply) => {
      sweep();
      if (pending.size >= 1000)
        return reply.code(503).send({ error: "Try again later" });
      let code: string;
      do code = sixDigits();
      while (pending.has(code) || passes.has(code));
      const slug = request.body.community;
      const p: Pending = {
        token: randomBytes(24).toString("base64url"),
        number: randomInt(10, 100),
        expires: Date.now() + PENDING_MS,
        address: request.ip,
        community: slug && findCommunity(slug) ? slug : null,
        nearby: deviceOf(request.headers["user-agent"] ?? "") === "computer",
        seen: Date.now(),
      };
      pending.set(code, p);
      tellNearby(p);
      return { code, number: p.number, token: p.token };
    },
  );

  // Asked every few seconds: still waiting (and the code renewed), or approved and
  // logged in, or gone.
  app.post<{ Body: { token: string } }>(
    "/api/device-login/wait",
    {
      schema: {
        body: {
          type: "object",
          required: ["token"],
          properties: { token: { type: "string", maxLength: 64 } },
        },
      },
    },
    async (request, reply) => {
      const now = Date.now();
      const found = [...pending].find(
        ([, p]) => p.token === request.body.token && p.expires > now,
      );
      if (!found) return reply.code(410).send({ error: "Ask for a new code" });
      const [code, p] = found;
      p.seen = now;
      if (!p.approved) {
        p.expires = now + PENDING_MS;
        return reply.code(202).send({ waiting: true, opened: !!p.opened });
      }
      pending.delete(code);
      const { userId, how } = p.approved;
      if (how === "me") setSessionCookie(reply, createSession(db, userId));
      else logInDevice(db, reply, userId, how);
      return reply.code(204).send();
    },
  );

  const person = (request: FastifyRequest): SessionUser | null =>
    request.user && !request.user.device ? request.user : null;
  /** The code's login, while its page still shows it and nobody approved it. */
  const shown = (code: string) => {
    const p = pending.get(code);
    const now = Date.now();
    return p && !p.approved && p.expires > now && now - p.seen < SHOWN_MS
      ? p
      : undefined;
  };

  // The phone that opened the code: the number to compare, and the community.
  app.get<{ Params: { code: string } }>(
    "/api/device-login/:code",
    async (request, reply) => {
      if (!person(request))
        return reply.code(401).send({ error: "Log in first" });
      const p = shown(request.params.code);
      if (!p)
        return reply.code(404).send({ error: "No device shows this code" });
      p.opened = true;
      return { number: p.number, community: p.community };
    },
  );

  app.post<{
    Params: { code: string };
    Body: {
      number: number;
      as: How;
      community?: string;
      guest?: string;
      language?: string;
    };
  }>(
    "/api/device-login/:code/approve",
    {
      schema: {
        body: {
          type: "object",
          required: ["number", "as"],
          additionalProperties: false,
          properties: {
            number: { type: "integer" },
            as: { type: "string", enum: ["me", "laptop", "guest"] },
            community: { type: "string", maxLength: 100 },
            guest: { type: "string", minLength: 1, maxLength: 60 },
            language: { type: "string", maxLength: 10 },
          },
        },
      },
    },
    async (request, reply) => {
      const user = person(request);
      if (!user) return reply.code(401).send({ error: "Log in first" });
      const p = shown(request.params.code);
      if (!p)
        return reply.code(404).send({ error: "No device shows this code" });
      if (p.number !== request.body.number)
        return reply.code(409).send({ error: "Not the number on the device" });
      const { as: how, guest, language } = request.body;
      let userId = user.id;
      if (how !== "me") {
        const community = findCommunity(request.body.community ?? "");
        if (!community)
          return reply.code(400).send({ error: "Which community?" });
        if (!allows(memberRoles(db, community.id, user.id), "team"))
          return reply.code(403).send({ error: "Needs the team role" });
        const name = guest?.trim();
        if (how === "guest" && !name)
          return reply.code(400).send({ error: "The guest's name" });
        userId = deviceUser(db, {
          approver: user,
          communityId: community.id,
          kind: how,
          guest: name,
          language,
        });
      }
      p.approved = { userId, how };
      tellNearby(p);
      return reply.code(204).send();
    },
  );

  // A guest pass: a band member's phone shows a QR that logs the guest's phone in.
  app.post<{
    Params: { slug: string };
    Body: { guest: string; language?: string };
  }>(
    "/api/communities/:slug/guest-passes",
    {
      schema: {
        body: {
          type: "object",
          required: ["guest"],
          additionalProperties: false,
          properties: {
            guest: { type: "string", minLength: 1, maxLength: 60 },
            language: { type: "string", maxLength: 10 },
          },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const user = person(request);
      if (!user) return reply.code(401).send({ error: "Log in first" });
      if (!allows(memberRoles(db, community.id, user.id), "team"))
        return reply.code(403).send({ error: "Needs the team role" });
      const guest = request.body.guest.trim();
      if (!guest) return reply.code(400).send({ error: "The guest's name" });
      sweep();
      if (passes.size >= 1000)
        return reply.code(503).send({ error: "Try again later" });
      let code: string;
      do code = sixDigits();
      while (pending.has(code) || passes.has(code));
      const expires = Date.now() + PENDING_MS;
      passes.set(code, {
        userId: deviceUser(db, {
          approver: user,
          communityId: community.id,
          kind: "guest",
          guest,
          language: request.body.language,
        }),
        slug: request.params.slug,
        expires,
        approverId: user.id,
        claim: null,
      });
      return reply
        .code(201)
        .send({ code, expiresAt: new Date(expires).toISOString() });
    },
  );

  // The guest's phone opens the pass, within 5 minutes; the first phone claims it, and
  // only its claim opens it again (a reload) or logs it in.
  app.get<{ Params: { code: string }; Querystring: { claim?: string } }>(
    "/api/guest-passes/:code",
    async (request, reply) => {
      const { code } = request.params;
      const pass = passes.get(code);
      if (
        !pass ||
        pass.expires <= Date.now() ||
        (pass.claim !== null && pass.claim !== request.query.claim)
      )
        return reply.code(404).send({ error: "This pass has run out" });
      if (pass.claim === null) {
        pass.claim = newId();
        passState(code, { state: "opened" });
      }
      const name = db
        .prepare("SELECT display_name FROM users WHERE id = ?")
        .pluck()
        .get(pass.userId) as string;
      return { name, community: pass.slug, claim: pass.claim };
    },
  );
  app.post<{ Params: { code: string }; Body: { claim?: string } }>(
    "/api/guest-passes/:code",
    async (request, reply) => {
      const { code } = request.params;
      const pass = passes.get(code);
      if (
        !pass ||
        pass.expires <= Date.now() ||
        pass.claim === null ||
        pass.claim !== request.body?.claim
      )
        return reply.code(404).send({ error: "This pass has run out" });
      passes.delete(code);
      logInDevice(db, reply, pass.userId, "guest");
      const name = db
        .prepare("SELECT display_name FROM users WHERE id = ?")
        .pluck()
        .get(pass.userId) as string;
      passState(code, {
        state: "accepted",
        name,
        until: new Date(Date.now() + GUEST_MS).toISOString(),
      });
      return { community: pass.slug };
    },
  );

  // My account: the laptops and guests the member logged in, to end one.
  app.get("/api/me/devices", async (request, reply) => {
    const user = person(request);
    if (!user) return reply.code(401).send({ error: "Log in first" });
    return db
      .prepare(
        `SELECT u.id, u.display_name AS name, u.device_kind AS kind, c.slug AS community,
           max(s.expires_at) AS expiresAt
         FROM users u JOIN sessions s ON s.user_id = u.id
           JOIN members m ON m.user_id = u.id JOIN communities c ON c.id = m.community_id
         WHERE u.device_of = ? AND s.expires_at > ?
         GROUP BY u.id ORDER BY expiresAt DESC`,
      )
      .all(user.id, new Date().toISOString()) as ApprovedDevice[];
  });
  app.delete<{ Params: { id: string } }>(
    "/api/me/devices/:id",
    async (request, reply) => {
      const user = person(request);
      if (!user) return reply.code(401).send({ error: "Log in first" });
      const ended = db
        .prepare(
          "DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE id = ? AND device_of = ?)",
        )
        .run(request.params.id, user.id).changes;
      if (!ended) return reply.code(404).send({ error: "Not found" });
      return reply.code(204).send();
    },
  );
}
