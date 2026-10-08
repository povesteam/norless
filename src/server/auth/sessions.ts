import type { FastifyInstance } from "fastify";
import type { Db } from "../db/db.js";

/**
 * A browser and its system, from a User-Agent: enough for a person to tell their devices
 * apart ("Chrome on Android"). Edge, Opera and Samsung Internet say Chrome too, and
 * Chrome says Safari, so they're asked first.
 */
export function deviceOf(agent: string | null) {
  const test = (pattern: RegExp) => !!agent && pattern.test(agent);
  const browser = test(/Edg(A|iOS)?\//)
    ? "Edge"
    : test(/OPR\/|Opera/)
      ? "Opera"
      : test(/SamsungBrowser\//)
        ? "Samsung Internet"
        : test(/Firefox\/|FxiOS\//)
          ? "Firefox"
          : test(/Chrome\/|CriOS\//)
            ? "Chrome"
            : test(/Safari\//)
              ? "Safari"
              : null;
  const system = test(/iPhone/)
    ? "iPhone"
    : test(/iPad/)
      ? "iPad"
      : test(/Android/)
        ? "Android"
        : test(/CrOS/)
          ? "ChromeOS"
          : test(/Windows/)
            ? "Windows"
            : test(/Macintosh|Mac OS X/)
              ? "Mac"
              : test(/Linux/)
                ? "Linux"
                : null;
  return { browser, system };
}

/** One place a person is logged in, for My account. */
export type SessionInfo = {
  /** The first 16 characters of the session's hash: enough to name it, not to use it. */
  id: string;
  browser: string | null;
  system: string | null;
  /** When it was last used, else when it began. */
  seenAt: string;
  /** The session of the device asking. */
  current: boolean;
};

const ID = 16;

/** Where a person is logged in, and logging out one of those places from another. */
export function attachSessionList(app: FastifyInstance, db: Db) {
  app.get("/api/me/sessions", async (request, reply) => {
    const user = request.user;
    if (!user) return reply.code(401).send({ error: "Log in first" });
    const rows = db
      .prepare(
        `SELECT id, user_agent AS userAgent, coalesce(seen_at, created_at) AS seenAt
         FROM sessions WHERE user_id = ? AND expires_at > ? ORDER BY seenAt DESC`,
      )
      .all(user.id, new Date().toISOString()) as {
      id: string;
      userAgent: string | null;
      seenAt: string;
    }[];
    return rows.map((row): SessionInfo => ({
      id: row.id.slice(0, ID),
      ...deviceOf(row.userAgent),
      seenAt: row.seenAt,
      current: row.id === user.sessionId,
    }));
  });

  // Not this device's own: that's Log out.
  app.delete<{ Params: { id: string } }>(
    "/api/me/sessions/:id",
    async (request, reply) => {
      const user = request.user;
      if (!user) return reply.code(401).send({ error: "Log in first" });
      const { changes } = db
        .prepare(
          "DELETE FROM sessions WHERE user_id = ? AND substr(id, 1, ?) = ? AND id <> ?",
        )
        .run(user.id, ID, request.params.id, user.sessionId);
      return changes > 0
        ? reply.code(204).send()
        : reply.code(404).send({ error: "No such session" });
    },
  );
}
