import { createHash, generateKeyPairSync, sign } from "node:crypto";
import Fastify from "fastify";
import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { type Db, migrate, openDatabase } from "../db/db.js";

// A fake OpenID provider: discovery, its key, and a token endpoint that checks PKCE.
const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const provider = Fastify();
let issuer = "";
const codes = new Map<
  string,
  { challenge: string; nonce: string; claims: object }
>();
const b64 = (data: string | Buffer) => Buffer.from(data).toString("base64url");
const jwt = (payload: object) => {
  const head = `${b64(JSON.stringify({ alg: "RS256", kid: "k1", typ: "JWT" }))}.${b64(JSON.stringify(payload))}`;
  return `${head}.${b64(sign("sha256", Buffer.from(head), privateKey))}`;
};
provider.get("/.well-known/openid-configuration", async () => ({
  issuer,
  authorization_endpoint: `${issuer}/authorize`,
  token_endpoint: `${issuer}/token`,
  jwks_uri: `${issuer}/jwks`,
  response_types_supported: ["code"],
  subject_types_supported: ["public"],
  id_token_signing_alg_values_supported: ["RS256"],
  code_challenge_methods_supported: ["S256"],
}));
provider.get("/jwks", async () => ({
  keys: [
    {
      ...publicKey.export({ format: "jwk" }),
      kid: "k1",
      alg: "RS256",
      use: "sig",
    },
  ],
}));
provider.post<{ Body: Record<string, string> }>(
  "/token",
  async (request, reply) => {
    const issued = codes.get(request.body.code ?? "");
    const verifier = request.body.code_verifier ?? "";
    if (
      !issued ||
      b64(createHash("sha256").update(verifier).digest()) !== issued.challenge
    )
      return reply.code(400).send({ error: "invalid_grant" });
    const now = Math.floor(Date.now() / 1000);
    return {
      access_token: "at",
      token_type: "Bearer",
      expires_in: 3600,
      id_token: jwt({
        iss: issuer,
        aud: "client-1",
        iat: now,
        exp: now + 600,
        nonce: issued.nonce,
        ...issued.claims,
      }),
    };
  },
);
provider.addContentTypeParser(
  "application/x-www-form-urlencoded",
  { parseAs: "string" },
  (_request, body, done) =>
    done(null, Object.fromEntries(new URLSearchParams(String(body)))),
);

beforeAll(async () => {
  await provider.listen({ port: 0, host: "127.0.0.1" });
  const address = provider.server.address();
  if (typeof address !== "object" || !address) throw new Error("No address");
  issuer = `http://127.0.0.1:${address.port}`;
});
afterAll(() => provider.close());

let db: Db;
let app: ReturnType<typeof buildApp>;
beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', 'x', 'x');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('ana', 'Ana', 'ana@example.com', 'active', 'x', 'x'),
      ('old', 'Old', 'old@example.com', 'imported', 'x', 'x');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m-ana', 'c', 'ana', '["team"]', 'active', 'x', 'x'),
      ('m-old', 'c', 'old', '[]', 'imported', 'x', 'x');
  `);
  app = buildApp({
    db,
    logger: false,
    origin: "https://norless.test",
    google: {
      clientId: "client-1",
      clientSecret: "secret",
      issuer: new URL(issuer),
      insecure: true,
    },
  });
});

/** Starts a login, and has the provider send back a code for these claims. */
async function loginAs(claims: object, next = "/unu-unu/playlists") {
  const start = await app.inject({
    url: `/api/auth/google?next=${encodeURIComponent(next)}`,
  });
  const to = new URL(start.headers.location as string);
  const cookie = String(start.headers["set-cookie"]).split(";")[0] ?? "";
  const state = to.searchParams.get("state") ?? "";
  codes.set("code-1", {
    challenge: to.searchParams.get("code_challenge") ?? "",
    nonce: to.searchParams.get("nonce") ?? "",
    claims,
  });
  return { to, state, cookie };
}
const back = (state: string, cookie: string) =>
  app.inject({
    url: `/api/auth/google/callback?code=code-1&state=${state}`,
    headers: { cookie },
  });

test("a verified Google email logs in and goes back where it started", async () => {
  const { to, state, cookie } = await loginAs({
    sub: "g1",
    email: "Ana@Example.com",
    email_verified: true,
    name: "Ana",
  });
  expect(to.origin + to.pathname).toBe(`${issuer}/authorize`);
  expect(to.searchParams.get("redirect_uri")).toBe(
    "https://norless.test/api/auth/google/callback",
  );
  expect(to.searchParams.get("code_challenge_method")).toBe("S256");

  const done = await back(state, cookie);
  expect(done.statusCode).toBe(302);
  expect(done.headers.location).toBe("/unu-unu/playlists");
  expect(String(done.headers["set-cookie"])).toMatch(/__Host-session=[\w-]/);
});

test("an unverified email, someone else's login link, or an uninvited import doesn't log in", async () => {
  const unverified = await loginAs({
    sub: "g2",
    email: "ana@example.com",
    email_verified: false,
  });
  expect(
    (await back(unverified.state, unverified.cookie)).headers.location,
  ).toBe("/login?google=unverified");

  // The callback without this browser's cookie, as from a link someone else made.
  const other = await loginAs({
    sub: "g1",
    email: "ana@example.com",
    email_verified: true,
  });
  expect((await back(other.state, "")).headers.location).toBe(
    "/login?google=expired",
  );

  const imported = await loginAs({
    sub: "g3",
    email: "old@example.com",
    email_verified: true,
  });
  expect((await back(imported.state, imported.cookie)).headers.location).toBe(
    "/login?google=not-invited",
  );
  expect((await app.inject({ url: "/api/auth/methods" })).json()).toMatchObject(
    { google: true },
  );
});

test("Sign in with Google on the login page: a token for this client with this browser's nonce", async () => {
  const start = await app.inject({ url: "/api/auth/google/one-tap" });
  const { clientId, nonce } = start.json<{ clientId: string; nonce: string }>();
  expect(clientId).toBe("client-1");
  const cookie = String(start.headers["set-cookie"]).split(";")[0] ?? "";
  const now = Math.floor(Date.now() / 1000);
  const token = (claims: object) =>
    jwt({
      iss: issuer,
      aud: "client-1",
      iat: now,
      exp: now + 600,
      sub: "g1",
      email: "ana@example.com",
      email_verified: true,
      nonce,
      ...claims,
    });
  const signIn = (credential: string, cookies = cookie) =>
    app.inject({
      method: "POST",
      url: "/api/auth/google/one-tap",
      headers: { cookie: cookies },
      payload: { credential, next: "/unu-unu/playlists" },
    });

  // Another site's token, another nonce, or no cookie: refused.
  expect((await signIn(token({ aud: "someone-else" }))).json()).toEqual({
    error: "failed",
  });
  expect((await signIn(token({ nonce: "other" }))).json()).toEqual({
    error: "expired",
  });
  expect((await signIn(token({}), "")).statusCode).toBe(400);
  expect((await signIn(token({ email: "old@example.com" }))).json()).toEqual({
    error: "not-invited",
  });

  const done = await signIn(token({}));
  expect(done.statusCode).toBe(200);
  expect(done.json()).toEqual({ next: "/unu-unu/playlists" });
  expect(String(done.headers["set-cookie"])).toMatch(/__Host-session=[\w-]/);
});
