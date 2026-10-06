import type { FastifyInstance } from "fastify";
import type { Db } from "../db/db.js";
import { newId } from "../ids.js";
import { ConverterAway, shrink } from "../converter.js";
import { fetchPublic } from "../songs/link-preview.js";

/*
 * Avatars: a person's photo, kept by Norless as a 256-pixel square
 * JPEG in `images`, so nobody's browser contacts Google to show it. It comes from their
 * Google account at each Google login and every week, unless
 * they uploaded their own or chose initials.
 */

const SIZE = 256;
const WEEK = 7 * 24 * 3_600_000;
type Fetch = typeof fetchPublic;

/** Lets go of the person's avatar, and where it came from becomes `source`. */
function replace(
  db: Db,
  userId: string,
  avatar: string | null,
  source: string,
) {
  const before = db
    .prepare("SELECT avatar FROM users WHERE id = ?")
    .pluck()
    .get(userId) as string | null | undefined;
  db.prepare("UPDATE users SET avatar = ?, avatar_source = ? WHERE id = ?").run(
    avatar,
    source,
    userId,
  );
  if (before && before !== avatar)
    db.prepare("DELETE FROM images WHERE id = ?").run(before);
}

/** Keeps a picture as the person's avatar; null when it isn't a picture. */
async function keep(
  db: Db,
  userId: string,
  picture: Buffer,
  type: string,
  source: "google" | "own",
) {
  const small = await shrink(picture, type, { square: SIZE });
  if (!small) return null;
  // Google's same picture again, a week later, stays as it is.
  const current = db
    .prepare(
      "SELECT users.avatar, images.data FROM users JOIN images ON images.id = users.avatar WHERE users.id = ?",
    )
    .get(userId) as { avatar: string; data: Buffer } | undefined;
  if (source === "google" && current?.data.equals(small)) {
    replace(db, userId, current.avatar, source);
    return current.avatar;
  }
  const id = newId();
  db.transaction(() => {
    db.prepare(
      "INSERT INTO images (id, content_type, data, created_at, created_by) VALUES (?, 'image/jpeg', ?, ?, ?)",
    ).run(id, small, new Date().toISOString(), userId);
    replace(db, userId, id, source);
  })();
  return id;
}

/** Copies Google's photo from `address` as the avatar, and notes when it looked. */
async function copyFrom(
  db: Db,
  userId: string,
  address: string,
  { fetch = fetchPublic, timeoutMs }: { fetch?: Fetch; timeoutMs: number },
) {
  // Google sends a 96-pixel photo; "=s256-c" asks for a 256-pixel square.
  const got = await fetch(address.replace(/=s\d+(-c)?$/, `=s${SIZE}-c`), {
    maxBytes: 2_000_000,
    timeoutMs,
  });
  db.prepare("UPDATE users SET google_picture_at = ? WHERE id = ?").run(
    new Date().toISOString(),
    userId,
  );
  return got ? keep(db, userId, got.body, got.type, "google") : null;
}

/** Whether Google's photo is the avatar: chosen, or nothing chosen yet. */
const takesGoogle = (db: Db, userId: string) => {
  const source = db
    .prepare("SELECT avatar_source FROM users WHERE id = ?")
    .pluck()
    .get(userId);
  return source !== "own" && source !== "initials";
};

/**
 * At a Google login: keeps where Google's photo is, and copies it unless they chose
 * their own or initials.
 */
export async function copyGooglePhoto(
  db: Db,
  userId: string,
  picture: unknown,
) {
  if (typeof picture !== "string") return;
  db.prepare("UPDATE users SET google_picture = ? WHERE id = ?").run(
    picture,
    userId,
  );
  if (!takesGoogle(db, userId)) return;
  // The login waits for it, so not for long; without the converter, next week's copy.
  await copyFrom(db, userId, picture, { timeoutMs: 2000 }).catch(
    (error: unknown) => {
      if (!(error instanceof ConverterAway)) throw error;
    },
  );
}

/**
 * Google's photo again for those who use it and whose copy is a week old, so a changed
 * photo arrives without a login.
 */
export async function refreshGooglePhotos(
  db: Db,
  { now = new Date(), fetch }: { now?: Date; fetch?: Fetch } = {},
) {
  const due = db
    .prepare(
      `SELECT id, google_picture FROM users
       WHERE google_picture IS NOT NULL AND deleted_at IS NULL
         AND (avatar_source IS NULL OR avatar_source = 'google')
         AND (google_picture_at IS NULL OR google_picture_at < ?)`,
    )
    .all(new Date(now.getTime() - WEEK).toISOString()) as {
    id: string;
    google_picture: string;
  }[];
  for (const user of due)
    await copyFrom(db, user.id, user.google_picture, {
      fetch,
      timeoutMs: 10_000,
    }).catch(() => null);
}

/** A deleted account's photo goes with it, and where Google's was. */
export const forgetAvatar = (db: Db, userId: string) => {
  replace(db, userId, null, "initials");
  db.prepare(
    "UPDATE users SET google_picture = NULL, google_picture_at = NULL WHERE id = ?",
  ).run(userId);
};

export function attachAvatars(app: FastifyInstance, db: Db) {
  // Every 6 hours, and when the server starts: the photos a week old.
  const refresh = () =>
    void refreshGooglePhotos(db).catch((error: unknown) =>
      app.log.warn({ error }, "Google photos not refreshed"),
    );
  const timer = setInterval(refresh, 6 * 3_600_000);
  timer.unref();
  app.addHook("onReady", async () => refresh());
  app.addHook("onClose", async () => clearInterval(timer));

  // My account: an uploaded photo (made small by the browser first), initials, or
  // Google's photo again, at once when Norless knows where it is, else at the next
  // Google login.
  app.put<{ Body: { photo?: string; use?: "google" | "initials" } }>(
    "/api/me/avatar",
    {
      bodyLimit: 3_000_000,
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          minProperties: 1,
          maxProperties: 1,
          properties: {
            photo: {
              type: "string",
              maxLength: 2_800_000,
              pattern: "^data:image/(jpeg|png|webp);base64,",
            },
            use: { enum: ["google", "initials"] },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user;
      if (!user) return reply.code(401).send({ error: "Log in first" });
      // A laptop or a guest logged in from someone's phone isn't them.
      if (user.device)
        return reply.code(403).send({ error: "Only on your own account" });
      const { photo, use } = request.body;
      if (photo) {
        const comma = photo.indexOf(",");
        const avatar = await keep(
          db,
          user.id,
          Buffer.from(photo.slice(comma + 1), "base64"),
          photo.slice("data:".length, photo.indexOf(";")),
          "own",
        ).catch((error: unknown) => {
          if (error instanceof ConverterAway) return undefined;
          throw error;
        });
        if (avatar === undefined)
          return reply
            .code(503)
            .send({ error: "Pictures can't be read now: try again soon" });
        if (!avatar) return reply.code(400).send({ error: "Not a picture" });
        return { avatar };
      }
      const google = db
        .prepare("SELECT google_picture FROM users WHERE id = ?")
        .pluck()
        .get(user.id) as string | null;
      if (use === "google" && google) {
        const avatar = await copyFrom(db, user.id, google, {
          timeoutMs: 5000,
        }).catch(() => null);
        if (avatar) return { avatar };
      }
      db.transaction(() => replace(db, user.id, null, use ?? "initials"))();
      return { avatar: null };
    },
  );
}
