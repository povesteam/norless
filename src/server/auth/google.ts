import type { FastifyInstance } from "fastify";
import { createRemoteJWKSet, type JWTPayload, jwtVerify } from "jose";
import * as oidc from "openid-client";
import { createSession, loginWithEmail, setSessionCookie } from "./auth.js";
import { copyGooglePhoto } from "./avatars.js";
import type { Db } from "../db/db.js";

/** How long a login started at Google may take to come back. */
const LIFETIME = 10 * 60_000;
const COOKIE = "__Host-google";
/** The nonce a login page's Sign in with Google must carry. */
const NONCE = "__Host-google-nonce";

const cookieOf = (header: string | undefined, cookie = COOKIE) =>
  header
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === cookie)?.[1];

/** Only paths on this site, so a login can't send anyone elsewhere. */
const onSite = (next: string) =>
  next.startsWith("/") && !next.startsWith("//") ? next : "/";

/**
 * Login with Google: OpenID Connect's code flow with PKCE. The verified email from the
 * ID token goes through loginWithEmail, like an email link. The state is also kept in a
 * short cookie, so a login link made by someone else can't log this browser in.
 */
export function attachGoogle(
  app: FastifyInstance,
  {
    db,
    origin,
    clientId,
    clientSecret,
    issuer = new URL("https://accounts.google.com"),
    insecure = false,
  }: {
    db: Db;
    origin: string;
    clientId: string;
    clientSecret: string;
    issuer?: URL;
    /** Tests only: a fake provider over plain http. */
    insecure?: boolean;
  },
) {
  const redirectUri = `${origin}/api/auth/google/callback`;
  let found: Promise<oidc.Configuration> | null = null;
  const configuration = () =>
    (found ??= oidc
      .discovery(
        issuer,
        clientId,
        clientSecret,
        undefined,
        insecure ? { execute: [oidc.allowInsecureRequests] } : undefined,
      )
      .catch((error: unknown) => {
        found = null; // tried again on the next login
        throw error;
      }));
  // ponytail: in memory, so a restart sends logins in progress back to the login page.
  const pending = new Map<
    string,
    { verifier: string; nonce: string; next: string; expires: number }
  >();

  app.get<{ Querystring: { next?: string } }>(
    "/api/auth/google",
    async (request, reply) => {
      const next = request.query.next ?? "/";
      const now = Date.now();
      for (const [state, login] of pending)
        if (login.expires < now) pending.delete(state);
      if (pending.size > 10_000)
        return reply.code(503).send({ error: "Try again later" });
      const verifier = oidc.randomPKCECodeVerifier();
      const state = oidc.randomState();
      const nonce = oidc.randomNonce();
      pending.set(state, {
        verifier,
        nonce,
        next: onSite(next),
        expires: now + LIFETIME,
      });
      const url = oidc.buildAuthorizationUrl(await configuration(), {
        redirect_uri: redirectUri,
        scope: "openid email profile",
        state,
        nonce,
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
        code_challenge_method: "S256",
        prompt: "select_account",
      });
      return reply
        .header(
          "set-cookie",
          `${COOKIE}=${state}; Max-Age=${LIFETIME / 1000}; Path=/; HttpOnly; Secure; SameSite=Lax`,
        )
        .redirect(url.href);
    },
  );

  app.get<{ Querystring: { state?: string } }>(
    "/api/auth/google/callback",
    async (request, reply) => {
      const state = request.query.state ?? "";
      const login = pending.get(state);
      pending.delete(state);
      reply.header(
        "set-cookie",
        `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`,
      );
      if (
        !login ||
        login.expires < Date.now() ||
        cookieOf(request.headers.cookie) !== state
      )
        return reply.redirect("/login?google=expired");
      let claims: oidc.IDToken | undefined;
      try {
        const tokens = await oidc.authorizationCodeGrant(
          await configuration(),
          new URL(request.url, origin),
          {
            pkceCodeVerifier: login.verifier,
            expectedState: state,
            expectedNonce: login.nonce,
            idTokenExpected: true,
          },
        );
        claims = tokens.claims();
      } catch (error) {
        request.log.warn({ error }, "Google login failed");
        return reply.redirect("/login?google=failed");
      }
      const outcome = await logIn(claims ?? {}, request.log);
      if ("error" in outcome)
        return reply.redirect(`/login?google=${outcome.error}`);
      setSessionCookie(reply, createSession(db, outcome.userId));
      return reply.redirect(login.next);
    },
  );

  /** Logs in the verified email Google vouched for, as an email link would. */
  async function logIn(
    claims: JWTPayload,
    log: { warn: (data: object, message: string) => void },
  ): Promise<{ userId: string } | { error: "unverified" | "not-invited" }> {
    if (typeof claims.email !== "string" || claims.email_verified !== true)
      return { error: "unverified" };
    const user = loginWithEmail(db, claims.email, {
      displayName: typeof claims.name === "string" ? claims.name : undefined,
    });
    if (!user) return { error: "not-invited" };
    // A photo that can't be copied never stops the login.
    await copyGooglePhoto(db, user.userId, claims.picture).catch(
      (error: unknown) => log.warn({ error }, "Google photo not copied"),
    );
    return { userId: user.userId };
  }

  // Sign in with Google on the login page: Google's script hands
  // the page an ID token, checked here with the provider's keys, for this client, and
  // with the nonce this browser was given, so a token taken elsewhere can't be replayed.
  let keys: ReturnType<typeof createRemoteJWKSet> | null = null;
  app.get("/api/auth/google/one-tap", async (_request, reply) => {
    const nonce = oidc.randomNonce();
    return reply
      .header(
        "set-cookie",
        `${NONCE}=${nonce}; Max-Age=${LIFETIME / 1000}; Path=/; HttpOnly; Secure; SameSite=Lax`,
      )
      .send({ clientId, nonce });
  });
  app.post<{ Body: { credential: string; next?: string } }>(
    "/api/auth/google/one-tap",
    {
      schema: {
        body: {
          type: "object",
          required: ["credential"],
          properties: {
            credential: { type: "string", maxLength: 8192 },
            next: { type: "string", maxLength: 2000 },
          },
        },
      },
    },
    async (request, reply) => {
      const nonce = cookieOf(request.headers.cookie, NONCE);
      reply.header(
        "set-cookie",
        `${NONCE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`,
      );
      if (!nonce) return reply.code(400).send({ error: "expired" });
      let claims: JWTPayload;
      try {
        const metadata = (await configuration()).serverMetadata();
        keys ??= createRemoteJWKSet(new URL(metadata.jwks_uri ?? ""));
        ({ payload: claims } = await jwtVerify(request.body.credential, keys, {
          // Google's tokens name their issuer either way.
          issuer: [metadata.issuer, "accounts.google.com"],
          audience: clientId,
        }));
      } catch (error) {
        request.log.warn({ error }, "Google sign-in failed");
        return reply.code(400).send({ error: "failed" });
      }
      if (claims.nonce !== nonce)
        return reply.code(400).send({ error: "expired" });
      const outcome = await logIn(claims, request.log);
      if ("error" in outcome) return reply.code(403).send(outcome);
      setSessionCookie(reply, createSession(db, outcome.userId));
      return { next: onSite(request.body.next ?? "/") };
    },
  );
}
