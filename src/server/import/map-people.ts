import type { Document } from "bson";
import {
  RO,
  UA,
  iso,
  legacyId,
  str,
  type Mapping,
  type Row,
} from "./mapping.js";

/** People: merged by email. Only username, emails, dates and admin flags are read. */
export function mapPeople(
  { get, note, rows, at, imported, community }: Mapping,
  congregations: Document[],
) {
  const userIdByOld = new Map<string, string>();
  const users = new Map<string, Row>();
  const legacyIds = new Map<string, string[]>();
  for (const db of [RO, UA]) {
    for (const user of get(db, "users")) {
      const emails = Array.isArray(user.emails)
        ? (user.emails as { address?: unknown }[])
        : [];
      const email = str(emails[0]?.address).trim().toLowerCase();
      if (!email) {
        note("usersWithoutEmail", String(user._id));
        continue;
      }
      if (emails.length > 1 && db === RO)
        note("usersWithSeveralEmails", String(user._id));
      const id = legacyId("shared", "users", email);
      userIdByOld.set(String(user._id), id);
      const created = iso(user.createdAt);
      const lastLogin = iso(
        (user.status as Document | undefined)?.lastLogin?.date,
      );
      const existing = users.get(id);
      if (existing) {
        legacyIds.get(id)?.push(`${db}:${user._id}`);
        if (
          created &&
          (!existing.legacy_created_at ||
            created < String(existing.legacy_created_at))
        )
          existing.legacy_created_at = created;
        if (
          lastLogin &&
          (!existing.last_login_at ||
            lastLogin > String(existing.last_login_at))
        )
          existing.last_login_at = lastLogin;
        continue;
      }
      legacyIds.set(id, [`${db}:${user._id}`]);
      users.set(id, {
        id,
        display_name: str(user.username) || email.replace(/@.*/, ""),
        email,
        status: "imported",
        legacy_created_at: created,
        last_login_at: lastLogin,
        created_at: created ?? at,
        deleted_at: null,
        ...imported,
      });
    }
  }
  const userOf = (oldId: unknown) =>
    typeof oldId === "string" ? (userIdByOld.get(oldId) ?? null) : null;

  const admins = new Set<string>();
  const creators = new Set<string>();
  for (const c of congregations) {
    const creator = userOf(c.creator);
    if (creator) creators.add(creator);
    for (const [oldId, right] of Object.entries(
      (c.rights ?? {}) as Record<string, { right?: string }>,
    )) {
      const userId = userOf(oldId);
      if (userId && right.right === "admin") admins.add(userId);
    }
  }
  for (const [userId, user] of users) {
    rows.users.push({
      ...user,
      legacy_ids: JSON.stringify(legacyIds.get(userId) ?? []),
    });
    rows.members.push({
      id: legacyId("shared", "members", userId),
      user_id: userId,
      roles: "[]",
      status: "imported",
      was_admin: admins.has(userId) ? 1 : 0,
      was_creator: creators.has(userId) ? 1 : 0,
      ...community,
      ...imported,
    });
  }
  return userOf;
}
