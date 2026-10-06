import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireRole } from "../auth/auth.js";
import type { Db } from "../db/db.js";
import type { Community } from "../songs/search.js";
import { newId } from "../ids.js";

/** A web page the room's projectors can show full screen, e.g. a start page. */
export type Page = {
  id: string;
  name: string;
  url: string;
  /** The projector shows a QR code with the follow-along link in a corner of it. */
  qr: boolean;
};

export function listPages(db: Db, communityId: string): Page[] {
  return db
    .prepare(
      `SELECT id, name, url, show_qr = 1 AS qr FROM pages WHERE community_id = ? AND deleted_at IS NULL
       ORDER BY position, created_at`,
    )
    .all(communityId)
    .map((row) => {
      const page = row as Omit<Page, "qr"> & { qr: number };
      return { ...page, qr: page.qr === 1 };
    });
}

/** Whether an address is on this network or this machine, which the server must not fetch. */
export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const a = address.toLowerCase();
    if (a.startsWith("::ffff:")) return isPrivateAddress(a.slice(7));
    return a === "::1" || a === "::" || /^f[cd]/.test(a) || /^fe[89ab]/.test(a);
  }
  const [x = 0, y = 0] = address.split(".").map(Number);
  return (
    x === 10 ||
    x === 127 ||
    x === 0 ||
    (x === 169 && y === 254) ||
    (x === 172 && y >= 16 && y <= 31) ||
    (x === 192 && y === 168) ||
    (x === 100 && y >= 64 && y <= 127)
  );
}

/** Whether these response headers let any site show the page in a frame. */
export function framingAllowed(
  frameOptions: string | null,
  contentSecurityPolicy: string | null,
): boolean {
  if (/deny|sameorigin/i.test(frameOptions ?? "")) return false;
  const ancestors = /frame-ancestors([^;]*)/i.exec(
    contentSecurityPolicy ?? "",
  )?.[1];
  return ancestors === undefined || /\*|https:/.test(ancestors);
}

/**
 * Whether a page lets other sites show it inside a frame, from its X-Frame-Options and
 * Content-Security-Policy headers; null when it can't be checked. Addresses on the
 * server's own network aren't fetched.
 */
export async function checkEmbedding(url: string): Promise<boolean | null> {
  try {
    const { hostname } = new URL(url);
    // ponytail: fetch resolves the name again, so a fast-changing DNS answer could slip
    // past this; owners only, and only the headers are read.
    const { address } = await lookup(hostname);
    if (isPrivateAddress(address)) return null;
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    await response.body?.cancel();
    return framingAllowed(
      response.headers.get("x-frame-options"),
      response.headers.get("content-security-policy"),
    );
  } catch {
    return null;
  }
}

const pageSchema = {
  type: "object",
  required: ["name", "url"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 100 },
    url: { type: "string", maxLength: 2000 },
  },
} as const;

const isHttps = (url: string) => {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Page routes: owners keep the list in the settings, the team sees it to project the
 * pages. A save answers whether the page can be shown in a frame.
 */
export function attachPages(
  app: FastifyInstance,
  {
    db,
    findCommunity,
    embedding = checkEmbedding,
  }: {
    db: Db;
    findCommunity: (slug: string) => Community | undefined;
    embedding?: (url: string) => Promise<boolean | null>;
  },
) {
  type Params = { slug: string; id: string };
  type Input = { name: string; url: string };
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
    return userId ? { communityId: community.id, userId } : null;
  };
  const exists = (communityId: string, id: string) =>
    db
      .prepare(
        "SELECT 1 FROM pages WHERE id = ? AND community_id = ? AND deleted_at IS NULL",
      )
      .get(id, communityId) !== undefined;

  app.get<{ Params: { slug: string } }>(
    "/api/communities/:slug/pages",
    async (request, reply) => {
      const who = authorize(request, reply, "team");
      if (!who) return reply;
      return listPages(db, who.communityId);
    },
  );

  app.post<{ Params: { slug: string }; Body: Input }>(
    "/api/communities/:slug/pages",
    { schema: { body: pageSchema } },
    async (request, reply) => {
      const who = authorize(request, reply, "owner");
      if (!who) return reply;
      const { name, url } = request.body;
      if (!isHttps(url))
        return reply.code(400).send({ error: "Only https addresses" });
      const id = newId();
      const at = new Date().toISOString();
      const last = db
        .prepare(
          "SELECT max(position) FROM pages WHERE community_id = ? AND deleted_at IS NULL",
        )
        .pluck()
        .get(who.communityId) as number | null;
      db.prepare(
        `INSERT INTO pages (id, community_id, name, url, position, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        who.communityId,
        name.trim(),
        url,
        (last ?? 0) + 1,
        at,
        at,
        who.userId,
        who.userId,
      );
      return reply.code(201).send({ id, embeddable: await embedding(url) });
    },
  );

  app.put<{ Params: Params; Body: Input }>(
    "/api/communities/:slug/pages/:id",
    { schema: { body: pageSchema } },
    async (request, reply) => {
      const who = authorize(request, reply, "owner");
      if (!who) return reply;
      if (!exists(who.communityId, request.params.id))
        return reply.code(404).send({ error: "Not found" });
      const { name, url } = request.body;
      if (!isHttps(url))
        return reply.code(400).send({ error: "Only https addresses" });
      db.prepare(
        "UPDATE pages SET name = ?, url = ?, updated_at = ?, updated_by = ? WHERE id = ?",
      ).run(
        name.trim(),
        url,
        new Date().toISOString(),
        who.userId,
        request.params.id,
      );
      return { embeddable: await embedding(url) };
    },
  );

  // The QR code with the follow-along link on a page.
  app.put<{ Params: Params; Body: { qr: boolean } }>(
    "/api/communities/:slug/pages/:id/qr",
    {
      schema: {
        body: {
          type: "object",
          required: ["qr"],
          additionalProperties: false,
          properties: { qr: { type: "boolean" } },
        },
      },
    },
    async (request, reply) => {
      const who = authorize(request, reply, "owner");
      if (!who) return reply;
      if (!exists(who.communityId, request.params.id))
        return reply.code(404).send({ error: "Not found" });
      db.prepare(
        "UPDATE pages SET show_qr = ?, updated_at = ?, updated_by = ? WHERE id = ?",
      ).run(
        request.body.qr ? 1 : 0,
        new Date().toISOString(),
        who.userId,
        request.params.id,
      );
      return reply.code(204).send();
    },
  );

  // Moves a page one place up or down.
  app.post<{ Params: Params; Body: { by: -1 | 1 } }>(
    "/api/communities/:slug/pages/:id/move",
    {
      schema: {
        body: {
          type: "object",
          required: ["by"],
          properties: { by: { enum: [-1, 1] } },
        },
      },
    },
    async (request, reply) => {
      const who = authorize(request, reply, "owner");
      if (!who) return reply;
      const pages = listPages(db, who.communityId);
      const from = pages.findIndex((p) => p.id === request.params.id);
      if (from < 0) return reply.code(404).send({ error: "Not found" });
      const [page] = pages.splice(from, 1);
      if (page)
        pages.splice(
          Math.min(Math.max(from + request.body.by, 0), pages.length),
          0,
          page,
        );
      const at = new Date().toISOString();
      const set = db.prepare(
        "UPDATE pages SET position = ?, updated_at = ?, updated_by = ? WHERE id = ?",
      );
      db.transaction(() =>
        pages.forEach((p, i) => set.run(i + 1, at, who.userId, p.id)),
      )();
      return reply.code(204).send();
    },
  );

  app.delete<{ Params: Params }>(
    "/api/communities/:slug/pages/:id",
    async (request, reply) => {
      const who = authorize(request, reply, "owner");
      if (!who) return reply;
      const at = new Date().toISOString();
      const { changes } = db
        .prepare(
          `UPDATE pages SET deleted_at = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND community_id = ? AND deleted_at IS NULL`,
        )
        .run(at, at, who.userId, request.params.id, who.communityId);
      if (changes === 0) return reply.code(404).send({ error: "Not found" });
      return reply.code(204).send();
    },
  );
}
