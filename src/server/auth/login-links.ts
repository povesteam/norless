import { createHash, randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { createSession, loginWithEmail, setSessionCookie } from "./auth.js";
import type { Db } from "../db/db.js";
import type { Mailer } from "../mail.js";

const LIFETIME = 15 * 60_000;
/** Links one address can ask for in 15 minutes, and all addresses in an hour. */
const PER_ADDRESS = 3;
const PER_HOUR = 200;

const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");

/** A new login link's token for the address, valid once for `lifetime` milliseconds. */
export function createLoginLink(
  db: Db,
  email: string,
  next: string,
  { lifetime = LIFETIME, now = Date.now() } = {},
): string {
  const token = randomBytes(32).toString("base64url");
  db.prepare(
    "INSERT INTO login_links (token_hash, email, next, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
  ).run(
    hash(token),
    email,
    next,
    new Date(now).toISOString(),
    new Date(now + lifetime).toISOString(),
  );
  return token;
}

/** An invitation: a login link that lasts 48 hours, since it may wait a while to be read. */
export const INVITATION_LIFETIME = 48 * 3_600_000;

const texts = {
  en: {
    subject: "Your Norless login link",
    body: "Open this link to log in to Norless. It works once, for 15 minutes:",
    ignore: "If you didn't ask for it, you can ignore this email.",
  },
  ro: {
    subject: "Linkul tău de autentificare în Norless",
    body: "Deschide acest link ca să intri în Norless. Merge o singură dată, timp de 15 minute:",
    ignore: "Dacă nu l-ai cerut tu, poți ignora acest email.",
  },
  uk: {
    subject: "Ваше посилання для входу в Norless",
    body: "Відкрийте це посилання, щоб увійти в Norless. Воно діє один раз, 15 хвилин:",
    ignore: "Якщо ви його не просили, просто проігноруйте цей лист.",
  },
};

/**
 * Login by email link. Anyone can ask, and gets the same answer whether or not the
 * address can log in. The link opens a page whose button logs in, so mail scanners
 * that open links don't use it up. Links are kept only as hashes, work once, and
 * expire after 15 minutes.
 */
export function attachLoginLinks(
  app: FastifyInstance,
  { db, mailer, origin }: { db: Db; mailer: Mailer; origin: string },
) {
  const sent: number[] = [];
  app.post<{ Body: { email: string; next?: string; language?: string } }>(
    "/api/auth/email-link",
    {
      schema: {
        body: {
          type: "object",
          required: ["email"],
          properties: {
            email: {
              type: "string",
              pattern: "^[^@\\\\s]+@[^@\\\\s]+$",
              maxLength: 320,
            },
            next: { type: "string", maxLength: 500 },
            language: { type: "string", maxLength: 10 },
          },
        },
      },
    },
    async (request, reply) => {
      const email = request.body.email.trim().toLowerCase();
      // Only paths on this site, so a link can't send anyone elsewhere.
      const next = request.body.next ?? "/";
      const safeNext =
        next.startsWith("/") && !next.startsWith("//") ? next : "/";
      const now = Date.now();
      while (sent.length && (sent[0] ?? 0) < now - 3_600_000) sent.shift();
      const recent = db
        .prepare(
          "SELECT count(*) FROM login_links WHERE email = ? AND created_at > ?",
        )
        .pluck()
        .get(email, new Date(now - LIFETIME).toISOString()) as number;
      if (recent >= PER_ADDRESS || sent.length >= PER_HOUR)
        return reply
          .code(429)
          .send({ error: "Too many links; try again later" });

      const token = createLoginLink(db, email, safeNext, { now });
      sent.push(now);
      const text =
        texts[request.body.language as keyof typeof texts] ?? texts.en;
      const ok = await mailer({
        to: email,
        subject: text.subject,
        text: `${text.body}\n\n${origin}/login/link/${token}\n\n${text.ignore}\n`,
      });
      return ok
        ? reply.code(204).send()
        : reply.code(502).send({ error: "The email wasn't sent" });
    },
  );

  // The page's button: uses the link up and logs in, or says it no longer works.
  app.post<{ Body: { token: string } }>(
    "/api/auth/email-link/use",
    {
      schema: {
        body: {
          type: "object",
          required: ["token"],
          properties: { token: { type: "string", maxLength: 100 } },
        },
      },
    },
    async (request, reply) => {
      const at = new Date().toISOString();
      const link = db
        .prepare(
          `UPDATE login_links SET used_at = ? WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?
           RETURNING email, next`,
        )
        .get(at, hash(request.body.token), at) as
        { email: string; next: string } | undefined;
      if (!link) return reply.code(410).send({ error: "expired" });
      const login = loginWithEmail(db, link.email);
      if (!login) return reply.code(403).send({ error: "not-invited" });
      setSessionCookie(reply, createSession(db, login.userId));
      return { next: link.next };
    },
  );

  // Links a day past their expiry are of no use to anyone.
  const removeOld = () =>
    db
      .prepare("DELETE FROM login_links WHERE expires_at < ?")
      .run(new Date(Date.now() - 86_400_000).toISOString());
  removeOld();
  const cleanup = setInterval(removeOld, 3_600_000);
  cleanup.unref();
  app.addHook("onClose", async () => clearInterval(cleanup));
}
