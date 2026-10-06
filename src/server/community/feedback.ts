import type { FastifyInstance, FastifyReply } from "fastify";
import { deviceTypes } from "../../shared/preferences.js";
import { requireRole } from "../auth/auth.js";
import type { Db } from "../db/db.js";
import type { Mailer } from "../mail.js";
import { isMember } from "../auth/members.js";
import type { Community } from "../songs/search.js";
import { newId } from "../ids.js";

export type Feedback = {
  id: string;
  text: string;
  page: string;
  deviceType: string;
  /** Who sent it; null once they emptied their name. */
  from: string | null;
  createdAt: string;
  archivedAt: string | null;
  /** On the app team's list: the community it came from. */
  community?: string;
};

const texts = {
  en: {
    subject: "Norless: an idea from {name}",
    body: "{name} sent this from {page} ({device}):",
    reply:
      "Reply to this email to answer them. Every idea is also listed on {ideas}",
  },
  ro: {
    subject: "Norless: o idee de la {name}",
    body: "{name} a trimis asta din {page} ({device}):",
    reply:
      "Răspunde la acest email ca să-i scrii. Toate ideile sunt și pe {ideas}",
  },
  uk: {
    subject: "Norless: ідея від {name}",
    body: "{name} надіслав(-ла) це зі сторінки {page} ({device}):",
    reply:
      "Дайте відповідь на цей лист, щоб написати автору. Усі ідеї також є на {ideas}",
  },
};

// One message per member per 10 seconds.
const PAUSE_MS = 10_000;

const columns = `f.id, f.text, f.page, f.device_type AS deviceType,
  nullif(u.display_name, '') AS "from", f.created_at AS createdAt,
  f.archived_at AS archivedAt`;

/**
 * Members send ideas and feedback, to the community's owners or to the Norless app team
 * (`appTeam`, their email addresses); they're kept, and emailed to them with the sender
 * as Reply-To. Each list them and archives the handled ones.
 */
export function attachFeedback(
  app: FastifyInstance,
  {
    db,
    findCommunity,
    mail,
    appTeam = [],
  }: {
    db: Db;
    findCommunity: (slug: string) => Community | undefined;
    mail?: { mailer: Mailer; origin: string };
    appTeam?: string[];
  },
) {
  const inAppTeam = (email: string | null | undefined) =>
    !!email && appTeam.includes(email.toLowerCase());
  app.post<{
    Params: { slug: string };
    Body: {
      text: string;
      page: string;
      deviceType: string;
      language?: string;
      to?: "owners" | "app";
    };
  }>(
    "/api/communities/:slug/feedback",
    {
      schema: {
        body: {
          type: "object",
          required: ["text", "page", "deviceType"],
          additionalProperties: false,
          properties: {
            text: { type: "string", maxLength: 5000 },
            page: { type: "string", maxLength: 500 },
            deviceType: { type: "string", enum: [...deviceTypes] },
            language: { type: "string", maxLength: 10 },
            to: { type: "string", enum: ["owners", "app"] },
          },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const user = request.user;
      if (!user) return reply.code(401).send({ error: "Log in first" });
      if (!isMember(db, community.id, user.id))
        return reply.code(403).send({ error: "Members only" });
      const text = request.body.text.trim();
      if (!text) return reply.code(400).send({ error: "The text is empty" });
      const now = new Date();
      const last = db
        .prepare(
          "SELECT max(created_at) FROM feedback WHERE created_by = ? AND community_id = ?",
        )
        .pluck()
        .get(user.id, community.id) as string | null;
      if (last && now.getTime() - Date.parse(last) < PAUSE_MS)
        return reply.code(429).send({ error: "Wait a moment" });

      const { page, deviceType, to = "owners" } = request.body;
      const at = now.toISOString();
      db.prepare(
        `INSERT INTO feedback (id, community_id, text, page, device_type, sent_to, created_at, updated_at, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        newId(),
        community.id,
        text,
        page,
        deviceType,
        to,
        at,
        at,
        user.id,
        user.id,
      );

      if (mail) {
        const sender = db
          .prepare("SELECT display_name AS name, email FROM users WHERE id = ?")
          .get(user.id) as { name: string; email: string | null };
        const recipients =
          to === "app"
            ? appTeam
            : (db
                .prepare(
                  `SELECT u.email FROM members m JOIN users u ON u.id = m.user_id
                   WHERE m.community_id = ? AND m.status = 'active' AND u.email IS NOT NULL
                     AND EXISTS (SELECT 1 FROM json_each(m.roles) WHERE value = 'owner')`,
                )
                .pluck()
                .all(community.id) as string[]);
        const words =
          texts[request.body.language as keyof typeof texts] ?? texts.en;
        const fill = (s: string) =>
          s
            .replaceAll("{name}", sender.name)
            .replace("{page}", `${mail.origin}${page}`)
            .replace("{device}", deviceType)
            .replace(
              "{ideas}",
              to === "app"
                ? `${mail.origin}/app-ideas`
                : `${mail.origin}/${request.params.slug}/ideas`,
            );
        // Not awaited: the message is kept whether or not the email goes out.
        for (const recipient of recipients)
          void mail.mailer({
            to: recipient,
            subject: fill(words.subject),
            text: `${fill(words.body)}\n\n${text}\n\n${fill(words.reply)}\n`,
            ...(sender.email ? { replyTo: sender.email } : {}),
          });
      }
      return reply.code(201).send();
    },
  );

  app.get<{ Params: { slug: string }; Querystring: { archived?: boolean } }>(
    "/api/communities/:slug/feedback",
    {
      schema: {
        querystring: {
          type: "object",
          properties: { archived: { type: "boolean" } },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      if (!requireRole(db, request, reply, community.id, "owner")) return reply;
      const archived = request.query.archived ?? false;
      return db
        .prepare(
          `SELECT ${columns}
           FROM feedback f JOIN users u ON u.id = f.created_by
           WHERE f.community_id = ? AND f.sent_to = 'owners' AND f.deleted_at IS NULL
             AND (f.archived_at IS NOT NULL) = ?
           ORDER BY f.created_at DESC`,
        )
        .all(community.id, archived ? 1 : 0) as Feedback[];
    },
  );

  app.patch<{
    Params: { slug: string; id: string };
    Body: { archived: boolean };
  }>(
    "/api/communities/:slug/feedback/:id",
    {
      schema: {
        body: {
          type: "object",
          required: ["archived"],
          additionalProperties: false,
          properties: { archived: { type: "boolean" } },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, "owner");
      if (!userId) return reply;
      const at = new Date().toISOString();
      const changed = db
        .prepare(
          `UPDATE feedback SET archived_at = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND community_id = ? AND sent_to = 'owners' AND deleted_at IS NULL`,
        )
        .run(
          request.body.archived ? at : null,
          at,
          userId,
          request.params.id,
          community.id,
        ).changes;
      if (!changed) return reply.code(404).send({ error: "Not found" });
      return reply.code(204).send();
    },
  );

  // The app team's list: ideas for Norless itself, from every community.
  const appTeamOnly = (
    request: { user: { email: string | null } | null },
    reply: FastifyReply,
  ) => {
    if (!request.user) return reply.code(401).send({ error: "Log in first" });
    if (!inAppTeam(request.user.email))
      return reply.code(403).send({ error: "For the Norless app team" });
    return null;
  };
  app.get<{ Querystring: { archived?: boolean } }>(
    "/api/app-feedback",
    {
      schema: {
        querystring: {
          type: "object",
          properties: { archived: { type: "boolean" } },
        },
      },
    },
    async (request, reply) => {
      if (appTeamOnly(request, reply)) return reply;
      return db
        .prepare(
          `SELECT ${columns}, c.name AS community
           FROM feedback f JOIN users u ON u.id = f.created_by
             JOIN communities c ON c.id = f.community_id
           WHERE f.sent_to = 'app' AND f.deleted_at IS NULL
             AND (f.archived_at IS NOT NULL) = ?
           ORDER BY f.created_at DESC`,
        )
        .all(request.query.archived ? 1 : 0) as Feedback[];
    },
  );
  app.patch<{ Params: { id: string }; Body: { archived: boolean } }>(
    "/api/app-feedback/:id",
    {
      schema: {
        body: {
          type: "object",
          required: ["archived"],
          additionalProperties: false,
          properties: { archived: { type: "boolean" } },
        },
      },
    },
    async (request, reply) => {
      if (appTeamOnly(request, reply)) return reply;
      const at = new Date().toISOString();
      const changed = db
        .prepare(
          `UPDATE feedback SET archived_at = ?, updated_at = ?, updated_by = ?
           WHERE id = ? AND sent_to = 'app' AND deleted_at IS NULL`,
        )
        .run(
          request.body.archived ? at : null,
          at,
          request.user?.id ?? null,
          request.params.id,
        ).changes;
      if (!changed) return reply.code(404).send({ error: "Not found" });
      return reply.code(204).send();
    },
  );
}
