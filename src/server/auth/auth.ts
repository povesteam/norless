import { createHash, randomBytes } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Db } from "../db/db.js";
import {
  deviceTypes,
  guitarShapes,
  instruments,
  noteNamings,
  type Preferences,
} from "../../shared/preferences.js";
import { allows, deleteAccount, memberRoles, type Role } from "./members.js";
import { newId } from "../ids.js";

export type SessionUser = {
  sessionId: string;
  id: string;
  displayName: string;
  email: string | null;
  /** Their photo, an image id. */
  avatar: string | null;
  /** A device logged in from a member's phone, whose session ends on time. */
  device: "laptop" | "guest" | null;
};

declare module "fastify" {
  interface FastifyRequest {
    /** The logged-in user, or null. Set for /api/ requests. */
    user: SessionUser | null;
  }
}

const COOKIE = "__Host-session";
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const LIFETIME = 30 * DAY;

/** Whether the dev login is on: DEV_LOGIN=1, never with NODE_ENV=production. */
export function devLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.DEV_LOGIN !== "1") return false;
  if (env.NODE_ENV === "production")
    throw new Error("DEV_LOGIN=1 is not allowed with NODE_ENV=production");
  return true;
}

/**
 * Logs in a person whose email address was verified (by Google, an email link, or
 * the dev login). Their pending invitations are accepted, and an unknown address
 * gets a new user without memberships. Returns null for an imported person who
 * wasn't invited yet: they can't log in until the owner invites them.
 */
export function loginWithEmail(
  db: Db,
  address: string,
  { displayName, now = new Date() }: { displayName?: string; now?: Date } = {},
): { userId: string } | null {
  const email = address.trim().toLowerCase();
  const at = now.toISOString();
  return db.transaction(() => {
    const user = db
      .prepare("SELECT id, status FROM users WHERE email = ?")
      .get(email) as { id: string; status: string } | undefined;
    if (!user) {
      const id = newId();
      db.prepare(
        "INSERT INTO users (id, display_name, email, status, last_login_at, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?, ?)",
      ).run(id, displayName ?? email.replace(/@.*/, ""), email, at, at, at);
      return { userId: id };
    }

    const invited = db
      .prepare(
        "SELECT count(*) FROM members WHERE user_id = ? AND status IN ('invited', 'active') AND deleted_at IS NULL",
      )
      .pluck()
      .get(user.id) as number;
    if (user.status === "imported" && invited === 0) return null;

    db.prepare(
      "UPDATE members SET status = 'active', updated_at = ? WHERE user_id = ? AND status = 'invited'",
    ).run(at, user.id);
    db.prepare(
      "UPDATE users SET status = 'active', last_login_at = ?, updated_at = ? WHERE id = ?",
    ).run(at, at, user.id);
    return { userId: user.id };
  })();
}

/**
 * Lets the request go on only for a member of the community with the role; owners
 * have every role. Returns the user's id, or answers 401 (not logged in) or 403 and
 * returns null.
 */
export function requireRole(
  db: Db,
  request: FastifyRequest,
  reply: FastifyReply,
  communityId: string,
  role: Role | Role[], // any of them
): string | null {
  if (!request.user) {
    void reply.code(401).send({ error: "Log in first" });
    return null;
  }
  const wanted = [role].flat();
  const roles = memberRoles(db, communityId, request.user.id);
  if (wanted.some((r) => allows(roles, r))) return request.user.id;
  void reply.code(403).send({ error: `Needs the ${wanted.join(" or ")} role` });
  return null;
}

const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/** Starts a session, for 30 days unless said otherwise, and returns the token for the cookie. */
export function createSession(
  db: Db,
  userId: string,
  now = new Date(),
  lifetime = LIFETIME,
) {
  const token = randomBytes(32).toString("base64url");
  db.prepare(
    "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
  ).run(
    hash(token),
    userId,
    now.toISOString(),
    new Date(now.getTime() + lifetime).toISOString(),
  );
  return token;
}

/** Sets the session cookie; with `maxAge` null, it ends when the browser closes. */
export function setSessionCookie(
  reply: FastifyReply,
  token: string,
  maxAge: number | null = LIFETIME,
) {
  const age = maxAge === null ? "" : ` Max-Age=${Math.round(maxAge / 1000)};`;
  reply.header(
    "set-cookie",
    `${COOKIE}=${token};${age} Path=/; HttpOnly; Secure; SameSite=Lax`,
  );
}

function clearSessionCookie(reply: FastifyReply) {
  reply.header(
    "set-cookie",
    `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`,
  );
}

function readToken(cookieHeader: string | undefined): string | null {
  for (const part of cookieHeader?.split(";") ?? []) {
    const [name, value] = part.trim().split("=");
    if (name === COOKIE && value) return value;
  }
  return null;
}

/** Whether a browser request comes from this site; requests without Origin aren't from another site's page. */
export function sameOrigin(headers: IncomingHttpHeaders): boolean {
  if (headers.origin === undefined) return true;
  try {
    const { protocol, host } = new URL(headers.origin);
    return new URL(`${protocol}//${headers.host}`).host === host;
  } catch {
    return false;
  }
}

type SessionRow = SessionUser & {
  expiresAt: string;
  seenAt: string | null;
  userAgent: string | null;
};

const findSession = (db: Db, token: string, now: number) =>
  db
    .prepare(
      `SELECT s.id AS sessionId, s.expires_at AS expiresAt, s.seen_at AS seenAt,
         s.user_agent AS userAgent, u.id, u.display_name AS displayName, u.email,
         u.avatar, u.device_kind AS device
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ? AND u.status <> 'deleted'`,
    )
    .get(hash(token), new Date(now).toISOString()) as SessionRow | undefined;

/** The user of a request's session cookie, or null. */
export function userFromCookie(
  db: Db,
  cookieHeader: string | undefined,
): SessionUser | null {
  const token = readToken(cookieHeader);
  const row = token ? findSession(db, token, Date.now()) : undefined;
  if (!row) return null;
  const { sessionId, id, displayName, email, avatar, device } = row;
  return { sessionId, id, displayName, email, avatar, device };
}

/**
 * Reads the session cookie on every API request into `request.user`, renews the
 * session at most once a day, and refuses changes from other sites.
 */
export function attachSessions(
  app: FastifyInstance,
  db: Db,
  {
    devLogin = false,
    emailLogin = false,
    googleLogin = false,
    devMail = false,
    appTeam = [] as string[],
  } = {},
) {
  app.decorateRequest("user", null);

  const renew = db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?");
  // Where and when it's used, for the list on My account; at most once an hour.
  const seen = db.prepare(
    "UPDATE sessions SET seen_at = ?, user_agent = ? WHERE id = ?",
  );

  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/api/")) return;
    if (
      request.method !== "GET" &&
      request.method !== "HEAD" &&
      !sameOrigin(request.headers)
    )
      return reply.code(403).send({ error: "Cross-site request" });

    const token = readToken(request.headers.cookie);
    if (!token) return;
    const now = Date.now();
    const row = findSession(db, token, now);
    if (!row) return clearSessionCookie(reply);
    const { expiresAt, seenAt, userAgent, ...user } = row;
    request.user = user;
    const agent = request.headers["user-agent"]?.slice(0, 400) ?? null;
    if (
      !seenAt ||
      now - Date.parse(seenAt) > HOUR ||
      (agent && agent !== userAgent)
    )
      seen.run(new Date(now).toISOString(), agent, user.sessionId);
    // A device's session ends on time.
    if (!user.device && Date.parse(expiresAt) - now < LIFETIME - DAY) {
      renew.run(new Date(now + LIFETIME).toISOString(), user.sessionId);
      setSessionCookie(reply, token);
    }
  });

  const removeExpired = () =>
    db
      .prepare("DELETE FROM sessions WHERE expires_at <= ?")
      .run(new Date().toISOString());
  removeExpired();
  const cleanup = setInterval(removeExpired, DAY);
  cleanup.unref();
  app.addHook("onClose", async () => clearInterval(cleanup));

  app.get("/api/me", async (request) => {
    if (!request.user) return { user: null, memberships: [], preferences: {} };
    const { id, displayName, email, avatar, device } = request.user;
    const memberships = (
      db
        .prepare(
          `SELECT c.slug AS community, m.roles FROM members m JOIN communities c ON c.id = m.community_id
           WHERE m.user_id = ? AND m.status = 'active' AND c.deleted_at IS NULL`,
        )
        .all(id) as { community: string; roles: string }[]
    ).map((m) => ({ ...m, roles: JSON.parse(m.roles) as string[] }));
    const stored = db
      .prepare(
        "SELECT preferences, avatar_source AS avatarSource FROM users WHERE id = ?",
      )
      .get(id) as { preferences: string; avatarSource: string | null };
    const preferences = JSON.parse(stored.preferences) as Preferences;
    // The Norless app team reads the ideas sent to it.
    const team = !!email && appTeam.includes(email.toLowerCase());
    return {
      user: {
        id,
        displayName,
        email,
        avatar,
        avatarSource: stored.avatarSource,
        device,
      },
      memberships,
      preferences,
      appTeam: team,
    };
  });

  // Anyone logged in can delete their own account, member or not.
  app.delete("/api/me", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "Log in first" });
    if (deleteAccount(db, request.user.id) === "last-owner")
      return reply
        .code(409)
        .send({ error: "Make someone else an owner first" });
    return reply.code(204).send();
  });

  const device = {
    type: "object",
    additionalProperties: false,
    properties: {
      layouts: {
        type: "object",
        maxProperties: 50,
        additionalProperties: { type: "string", maxLength: 50 },
      },
      stageScheme: { type: "string", enum: ["light", "dark", "system"] },
      textSize: { type: "number", minimum: 0.5, maximum: 3 },
    },
  } as const;
  // Merges into the logged-in person's preferences (a JSON merge patch), so a device
  // sending what it knew doesn't erase what another device saved meanwhile.
  app.put<{ Body: Preferences }>(
    "/api/me/preferences",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            ...Object.fromEntries(deviceTypes.map((d) => [d, device])),
            seenSwitches: {
              type: "object",
              additionalProperties: {
                type: "array",
                uniqueItems: true,
                maxItems: 200,
                items: { type: "string", maxLength: 40 },
              },
            },
            countUsage: { type: "boolean" },
            musician: {
              type: "object",
              additionalProperties: false,
              properties: {
                instruments: {
                  type: "array",
                  uniqueItems: true,
                  items: { type: "string", enum: [...instruments] },
                },
                // null takes it away, as a merge patch does.
                main: { enum: [...instruments, null] },
                shapes: {
                  type: "array",
                  uniqueItems: true,
                  items: { type: "string", enum: [...guitarShapes] },
                },
                noteNames: { enum: [...noteNamings, null] },
                plainChords: { type: "boolean" },
              },
            },
            hints: {
              type: "array",
              maxItems: 20,
              items: { type: "string", maxLength: 30 },
            },
          },
        },
      },
    },
    async (request, reply) => {
      if (!request.user) return reply.code(401).send({ error: "Log in first" });
      db.prepare(
        "UPDATE users SET preferences = json_patch(preferences, ?), updated_at = ? WHERE id = ?",
      ).run(
        JSON.stringify(request.body),
        new Date().toISOString(),
        request.user.id,
      );
      return reply.code(204).send();
    },
  );

  // In development, the same ways in as in production, with stand-ins: a pretend Google
  // that lists the accounts, and emails shown instead of sent.
  app.get("/api/auth/methods", async () => ({
    dev: devLogin,
    email: emailLogin,
    google: googleLogin || devLogin,
    fakeGoogle: devLogin && !googleLogin,
    devMail: devLogin && devMail,
  }));

  // Development only: the accounts the pretend Google offers to choose from.
  if (devLogin)
    app.get("/api/auth/dev-accounts", async () =>
      db
        .prepare(
          `SELECT display_name AS name, email FROM users
           WHERE email IS NOT NULL AND status <> 'deleted' AND device_of IS NULL
           ORDER BY display_name COLLATE NOCASE LIMIT 50`,
        )
        .all(),
    );

  // Development and end-to-end tests only: logs in any email without verifying it.
  if (devLogin)
    app.post<{ Body: { email: string } }>(
      "/api/auth/dev-login",
      {
        schema: {
          body: {
            type: "object",
            required: ["email"],
            properties: {
              email: { type: "string", minLength: 3, maxLength: 320 },
            },
          },
        },
      },
      async (request, reply) => {
        const login = loginWithEmail(db, request.body.email);
        if (!login) return reply.code(403).send({ error: "not-invited" });
        setSessionCookie(reply, createSession(db, login.userId));
        return reply.code(204).send();
      },
    );

  app.post("/api/auth/logout", async (request, reply) => {
    if (request.user)
      db.prepare("DELETE FROM sessions WHERE id = ?").run(
        request.user.sessionId,
      );
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  // Ends every other session of the user; this one stays.
  app.post("/api/auth/logout-everywhere", async (request, reply) => {
    if (!request.user) return reply.code(401).send({ error: "Log in first" });
    db.prepare("DELETE FROM sessions WHERE user_id = ? AND id <> ?").run(
      request.user.id,
      request.user.sessionId,
    );
    return reply.code(204).send();
  });
}
