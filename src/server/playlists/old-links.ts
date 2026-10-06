import type { FastifyInstance } from "fastify";
import type { Db } from "../db/db.js";
import { legacyId } from "../import/mapping.js";

/** The old app's hosts: the database each served, as the import names its rows, and its language. */
const oldHosts: Record<string, { sources: string[]; language: string }> = {
  "app.norless.com": { sources: ["shared"], language: "ro" },
  // A playlist that differed between the databases was imported twice, the UA one apart.
  "app-ua.norless.com": { sources: ["ua", "shared"], language: "uk" },
};

/**
 * Where a link of the old app goes in this one: the imported community, an old
 * playlist to its imported copy (else the list of playlists), and the old output page
 * to the projector. Links from the Ukrainian app open in Ukrainian. Null for other hosts.
 */
export function oldLinkTarget(
  db: Db,
  host: string,
  url: string,
): string | null {
  const old = oldHosts[host.toLowerCase()];
  if (!old) return null;
  const community = db
    .prepare(
      "SELECT id, slug FROM communities WHERE imported_at IS NOT NULL AND deleted_at IS NULL ORDER BY created_at LIMIT 1",
    )
    .get() as { id: string; slug: string } | undefined;
  if (!community) return null;
  const base = `/${community.slug}`;
  const path = url.split(/[?#]/)[0] ?? "/";
  if (path.startsWith("/template/output.html"))
    return `${base}/projector/${old.language}`;
  const playlist = /^\/playlist\/([^/]+)/.exec(path)?.[1];
  if (playlist) {
    const exists = db.prepare(
      "SELECT 1 FROM playlists WHERE id = ? AND community_id = ? AND deleted_at IS NULL",
    );
    const id = old.sources
      .map((source) =>
        legacyId(source, "playlists", decodeURIComponent(playlist)),
      )
      .find((id) => exists.get(id, community.id));
    return `${base}/playlists${id ? `/${id}` : ""}?lang=${old.language}`;
  }
  return `${base}?lang=${old.language}`;
}

/** Sends every request for the old app's hosts to the same place here, for good. */
export function attachOldLinks(
  app: FastifyInstance,
  { db, origin }: { db: Db; origin: string },
) {
  app.addHook("onRequest", async (request, reply) => {
    const target = oldLinkTarget(db, request.hostname, request.url);
    if (target) return reply.redirect(origin + target, 301);
  });
}
