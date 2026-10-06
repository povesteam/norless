import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { type Theme, themeProblems } from "../shared/theme.js";
import { requireRole } from "./auth/auth.js";
import type { Db } from "./db/db.js";
import type { Community } from "./songs/search.js";

const hex = { type: "string", pattern: "^#[0-9a-fA-F]{6}$" } as const;

/** PUT …/theme: owners set the community's colors, font and logo; low contrast is refused. */
export function attachTheme(
  app: FastifyInstance,
  {
    db,
    findCommunity,
  }: { db: Db; findCommunity: (slug: string) => Community | undefined },
) {
  app.put<{ Params: { slug: string }; Body: Theme }>(
    "/api/communities/:slug/theme",
    {
      // A logo of up to about 200 KB and a font file of up to about 300 KB.
      bodyLimit: 800_000,
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            color: hex,
            tint: hex,
            font: { type: "string", maxLength: 60 },
            fontFile: {
              type: "string",
              maxLength: 420_000,
              pattern: "^data:font/(woff2|woff);base64,",
            },
            // The page sends back the file's address to keep the file as it is.
            fontFileUrl: { type: "string", maxLength: 200 },
            logo: {
              type: "string",
              maxLength: 280_000,
              pattern: "^data:image/(png|jpeg|webp|svg\\+xml);base64,",
            },
          },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, "owner");
      if (!userId) return reply;
      const { fontFileUrl, ...given } = request.body;
      const theme = Object.fromEntries(
        Object.entries(given).filter(([, v]) => v !== ""),
      ) as Theme;
      if (fontFileUrl && !theme.fontFile) {
        const kept = themeOf(db, community.id).fontFile;
        if (kept) theme.fontFile = kept;
      }
      const problems = themeProblems(theme);
      if (problems.length)
        return reply.code(400).send({ error: "Too little contrast", problems });
      db.prepare(
        "UPDATE communities SET theme = ?, updated_at = ?, updated_by = ? WHERE id = ?",
      ).run(
        JSON.stringify(theme),
        new Date().toISOString(),
        userId,
        community.id,
      );
      return reply.code(204).send();
    },
  );

  // The community's font file, served by Norless itself so no other site sees who reads.
  app.get<{ Params: { slug: string } }>(
    "/api/communities/:slug/font",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      const file = community && themeOf(db, community.id).fontFile;
      const match =
        file && /^data:(font\/(?:woff2|woff));base64,(.*)$/.exec(file);
      if (!match) return reply.code(404).send({ error: "Not found" });
      return reply
        .header("content-type", match[1] ?? "font/woff2")
        .header("cache-control", "public, max-age=31536000, immutable")
        .send(Buffer.from(match[2] ?? "", "base64"));
    },
  );
}

/** The stored theme, with the font file. */
export const themeOf = (db: Db, communityId: string) =>
  JSON.parse(
    db
      .prepare("SELECT theme FROM communities WHERE id = ?")
      .pluck()
      .get(communityId) as string,
  ) as Theme;

/** The theme for the page: the font file's address instead of the file. */
export function publicTheme(theme: Theme, slug: string): Theme {
  const { fontFile, ...rest } = theme;
  if (!fontFile) return rest;
  const version = createHash("sha256")
    .update(fontFile)
    .digest("hex")
    .slice(0, 12);
  return { ...rest, fontFileUrl: `/api/communities/${slug}/font?v=${version}` };
}
