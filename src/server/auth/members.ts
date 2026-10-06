import { forgetAvatar } from "./avatars.js";
import type { FastifyInstance, FastifyReply } from "fastify";
import { requireRole } from "./auth.js";
import type { Db } from "../db/db.js";
import { createLoginLink, INVITATION_LIFETIME } from "./login-links.js";
import type { Mailer } from "../mail.js";
import { newId } from "../ids.js";

export const roles = ["owner", "editor", "team"] as const;
export type Role = (typeof roles)[number];

/** A user's roles in a community; none unless they're an active member. */
export function memberRoles(
  db: Db,
  communityId: string,
  userId: string,
): Role[] {
  const roles = db
    .prepare(
      "SELECT roles FROM members WHERE community_id = ? AND user_id = ? AND status = 'active' AND deleted_at IS NULL",
    )
    .pluck()
    .get(communityId, userId) as string | undefined;
  return roles ? (JSON.parse(roles) as Role[]) : [];
}

/** Whether the user is an active member, with or without roles: members see names and who is online. */
export const isMember = (db: Db, communityId: string, userId: string) =>
  db
    .prepare(
      "SELECT 1 FROM members WHERE community_id = ? AND user_id = ? AND status = 'active' AND deleted_at IS NULL",
    )
    .get(communityId, userId) !== undefined;

/** Whether the roles allow an action; owners may do everything. */
export const allows = (roles: Role[], role: Role) =>
  roles.includes(role) || roles.includes("owner");

/**
 * Invites a person to a community with these roles; their first login with this
 * email accepts it. An existing user with the email, such as an imported one, is the
 * one invited, and an active member just gets the new roles.
 */
export function invite(
  db: Db,
  communityId: string,
  address: string,
  memberRoles: Role[],
  now = new Date(),
) {
  const email = address.trim().toLowerCase();
  const at = now.toISOString();
  db.transaction(() => {
    let userId = db
      .prepare("SELECT id FROM users WHERE email = ?")
      .pluck()
      .get(email) as string | undefined;
    if (!userId) {
      userId = newId();
      db.prepare(
        "INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES (?, ?, ?, 'invited', ?, ?)",
      ).run(userId, email.replace(/@.*/, ""), email, at, at);
    }
    db.prepare(
      `INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'invited', ?, ?)
       ON CONFLICT (community_id, user_id) DO UPDATE SET
         roles = excluded.roles,
         status = CASE WHEN status = 'active' THEN 'active' ELSE 'invited' END,
         deleted_at = NULL,
         updated_at = excluded.updated_at`,
    ).run(newId(), communityId, userId, JSON.stringify(memberRoles), at, at);
  })();
}

export type MemberRow = {
  id: string;
  name: string;
  email: string | null;
  roles: Role[];
  status: "imported" | "invited" | "active";
  /** Was an admin in the old app. */
  wasAdmin: boolean;
  /** When the account was created, in the old app for imported people. */
  createdAt: string;
  lastActiveAt: string | null;
};

/** The community's members, invitations and imported accounts, not removed ones. */
export function listMembers(db: Db, communityId: string): MemberRow[] {
  return (
    db
      .prepare(
        `SELECT m.id, u.display_name AS name, u.email, m.roles, m.status, m.was_admin AS wasAdmin,
           coalesce(u.legacy_created_at, u.created_at) AS createdAt, u.last_login_at AS lastActiveAt
         FROM members m JOIN users u ON u.id = m.user_id
         WHERE m.community_id = ? AND m.status <> 'removed' AND m.deleted_at IS NULL
           AND u.device_of IS NULL
         ORDER BY u.display_name COLLATE NOCASE`,
      )
      .all(communityId) as (Omit<MemberRow, "roles" | "wasAdmin"> & {
      roles: string;
      wasAdmin: number;
    })[]
  ).map((m) => ({
    ...m,
    roles: JSON.parse(m.roles) as Role[],
    wasAdmin: m.wasAdmin === 1,
  }));
}

/** Whether taking `memberId`'s owner role away would leave the community without an owner. */
function isLastOwner(db: Db, communityId: string, memberId: string) {
  const owners = db
    .prepare(
      `SELECT id FROM members WHERE community_id = ? AND status = 'active' AND deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM json_each(roles) WHERE value = 'owner')`,
    )
    .pluck()
    .all(communityId) as string[];
  return owners.length === 1 && owners[0] === memberId;
}

export type MemberChange = "ok" | "not-found" | "last-owner";

/**
 * Someone deletes their own account: their name, email and preferences go, with their
 * memberships and sessions; what they added and their usage events stay, without them. A community's last
 * owner has to hand it over first.
 */
export function deleteAccount(
  db: Db,
  userId: string,
  now = new Date(),
): "ok" | "last-owner" {
  const at = now.toISOString();
  return db.transaction(() => {
    const memberships = db
      .prepare(
        "SELECT id, community_id AS communityId FROM members WHERE user_id = ? AND status <> 'removed'",
      )
      .all(userId) as { id: string; communityId: string }[];
    if (memberships.some((m) => isLastOwner(db, m.communityId, m.id)))
      return "last-owner";
    db.prepare(
      "UPDATE members SET status = 'removed', roles = '[]', updated_at = ?, updated_by = ? WHERE user_id = ? AND status <> 'removed'",
    ).run(at, userId, userId);
    db.prepare(
      `UPDATE users SET display_name = '', email = NULL, legacy_ids = '[]', preferences = '{}',
         status = 'deleted', updated_at = ?, deleted_at = ? WHERE id = ?`,
    ).run(at, at, userId);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
    forgetAvatar(db, userId);
    // What they wrote to the owners goes with them.
    db.prepare("DELETE FROM feedback WHERE created_by = ?").run(userId);
    // So do their likes and dislikes, with the reasons.
    db.prepare("DELETE FROM song_opinions WHERE user_id = ?").run(userId);
    // And the features they asked for.
    db.prepare("DELETE FROM feature_requests WHERE user_id = ?").run(userId);
    // Their schedule's personal parts go; their slots open again.
    for (const table of [
      "away_dates",
      "notifications",
      "push_subscriptions",
      "role_people",
    ])
      db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
    db.prepare(
      "UPDATE slots SET user_id = NULL, status = 'open' WHERE user_id = ?",
    ).run(userId);
    // The laptops and guests they logged in go too: they carry their name.
    const devices = db
      .prepare(
        "SELECT id FROM users WHERE device_of = ? AND status <> 'deleted'",
      )
      .pluck()
      .all(userId) as string[];
    for (const device of devices) {
      db.prepare(
        "UPDATE members SET status = 'removed', roles = '[]', updated_at = ? WHERE user_id = ?",
      ).run(at, device);
      db.prepare(
        "UPDATE users SET display_name = '', status = 'deleted', updated_at = ?, deleted_at = ? WHERE id = ?",
      ).run(at, at, device);
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(device);
    }
    // How they used the app is kept, without them.
    db.prepare("UPDATE usage_events SET user_id = NULL WHERE user_id = ?").run(
      userId,
    );
    // So are the changes they made, without who made them.
    for (const id of [userId, ...devices])
      db.prepare("UPDATE changes SET user_id = NULL WHERE user_id = ?").run(id);
    return "ok" as const;
  })();
}

export function changeRoles(
  db: Db,
  communityId: string,
  memberId: string,
  memberRoles: Role[],
  { userId, now = new Date() }: { userId: string; now?: Date },
): MemberChange {
  return db.transaction((): MemberChange => {
    if (
      !memberRoles.includes("owner") &&
      isLastOwner(db, communityId, memberId)
    )
      return "last-owner";
    const changed = db
      .prepare(
        "UPDATE members SET roles = ?, updated_at = ?, updated_by = ? WHERE id = ? AND community_id = ? AND status <> 'removed'",
      )
      .run(
        JSON.stringify(memberRoles),
        now.toISOString(),
        userId,
        memberId,
        communityId,
      );
    return changed.changes > 0 ? "ok" : "not-found";
  })();
}

/**
 * Removes a member. An imported person who never logged in to the new app is deleted:
 * their name and email go, and what they made stays without a name.
 */
export function removeMember(
  db: Db,
  communityId: string,
  memberId: string,
  { userId, now = new Date() }: { userId: string; now?: Date },
): MemberChange {
  const at = now.toISOString();
  return db.transaction((): MemberChange => {
    const member = db
      .prepare(
        `SELECT m.user_id AS userId, u.status FROM members m JOIN users u ON u.id = m.user_id
         WHERE m.id = ? AND m.community_id = ? AND m.status <> 'removed'`,
      )
      .get(memberId, communityId) as
      { userId: string; status: string } | undefined;
    if (!member) return "not-found";
    if (isLastOwner(db, communityId, memberId)) return "last-owner";
    db.prepare(
      "UPDATE members SET status = 'removed', roles = '[]', updated_at = ?, updated_by = ? WHERE id = ?",
    ).run(at, userId, memberId);
    if (member.status === "imported") {
      db.prepare(
        "UPDATE users SET display_name = '', email = NULL, legacy_ids = '[]', status = 'deleted', updated_at = ? WHERE id = ?",
      ).run(at, member.userId);
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(member.userId);
    }
    return "ok";
  })();
}

const invitations = {
  en: {
    subject: "{name} invited you to {community} on Norless",
    body: "{name} invited you to {community} on Norless. Open this link to log in; it works once, within 48 hours:",
    later: "After that, log in at {login} with this email address.",
  },
  ro: {
    subject: "{name} te-a invitat în {community} pe Norless",
    body: "{name} te-a invitat în {community} pe Norless. Deschide acest link ca să intri; merge o singură dată, timp de 48 de ore:",
    later: "După aceea, intră pe {login} cu această adresă de email.",
  },
  uk: {
    subject: "{name} запросив(-ла) вас до {community} у Norless",
    body: "{name} запросив(-ла) вас до {community} у Norless. Відкрийте це посилання, щоб увійти; воно діє один раз, протягом 48 годин:",
    later: "Потім входьте на {login} з цією адресою email.",
  },
};

/** Member management, for owners only. */
export function attachMembers(
  app: FastifyInstance,
  {
    db,
    findCommunity,
    mail,
  }: {
    db: Db;
    findCommunity: (
      slug: string,
    ) => { id: string; slug: string; name: string } | undefined;
    /** Sends invitations with a login link, when email is set up. */
    mail?: { mailer: Mailer; origin: string };
  },
) {
  type Params = { slug: string; id: string };
  const rolesSchema = {
    type: "array",
    minItems: 1,
    uniqueItems: true,
    items: { type: "string", enum: roles },
  };
  const answer = (result: MemberChange, reply: FastifyReply) =>
    result === "ok"
      ? reply.code(204).send()
      : result === "not-found"
        ? reply.code(404).send({ error: "Not found" })
        : reply.code(409).send({ error: "last-owner" });

  app.get<{ Params: { slug: string } }>(
    "/api/communities/:slug/members",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      if (!requireRole(db, request, reply, community.id, "owner")) return reply;
      return listMembers(db, community.id);
    },
  );

  // Invites a new person, or an imported one (matched by email).
  app.post<{
    Params: { slug: string };
    Body: { email: string; roles: Role[]; language?: string };
  }>(
    "/api/communities/:slug/members",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "roles"],
          additionalProperties: false,
          properties: {
            email: {
              type: "string",
              minLength: 3,
              maxLength: 320,
              pattern: "^[^@\\s]+@[^@\\s]+$",
            },
            roles: rolesSchema,
            language: { type: "string", maxLength: 10 },
          },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      if (!requireRole(db, request, reply, community.id, "owner")) return reply;
      const email = request.body.email.trim().toLowerCase();
      invite(db, community.id, email, request.body.roles);
      // The email has a login link; without it, the first login accepts the invitation.
      if (!mail) return { emailed: false };
      const token = createLoginLink(db, email, `/${community.slug}`, {
        lifetime: INVITATION_LIFETIME,
      });
      const text =
        invitations[request.body.language as keyof typeof invitations] ??
        invitations.en;
      const values = {
        name: request.user?.displayName ?? "",
        community: community.name,
      };
      const fill = (template: string) =>
        template.replace(
          /\{(\w+)\}/g,
          (_, key: keyof typeof values) => values[key],
        );
      const emailed = await mail.mailer({
        to: email,
        subject: fill(text.subject),
        text: `${fill(text.body)}\n\n${mail.origin}/login/link/${token}\n\n${text.later.replace("{login}", `${mail.origin}/login`)}\n`,
      });
      return { emailed };
    },
  );

  app.patch<{ Params: Params; Body: { roles: Role[] } }>(
    "/api/communities/:slug/members/:id",
    {
      schema: {
        body: {
          type: "object",
          required: ["roles"],
          additionalProperties: false,
          properties: { roles: rolesSchema },
        },
      },
    },
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, "owner");
      if (!userId) return reply;
      return answer(
        changeRoles(db, community.id, request.params.id, request.body.roles, {
          userId,
        }),
        reply,
      );
    },
  );

  app.delete<{ Params: Params }>(
    "/api/communities/:slug/members/:id",
    async (request, reply) => {
      const community = findCommunity(request.params.slug);
      if (!community) return reply.code(404).send({ error: "Not found" });
      const userId = requireRole(db, request, reply, community.id, "owner");
      if (!userId) return reply;
      return answer(
        removeMember(db, community.id, request.params.id, { userId }),
        reply,
      );
    },
  );
}
