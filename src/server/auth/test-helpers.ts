// The "Who can do what" matrix of the members spec, one describe per row, each with
// every kind of person. Rows for features that don't exist yet are todos until they do.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { createSession } from "./auth.js";
import { migrate, openDatabase } from "../db/db.js";

export const db = openDatabase(":memory:");
migrate(db);
db.exec(`
  INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
    ('c', 'unu-unu', 'Unu-Unu', '["ro"]', 'Europe/Bucharest', '2026-01-01', '2026-01-01');
  INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
    ('member', 'Me', 'me@example.com', 'active', '2026-01-01', '2026-01-01'),
    ('team', 'Te', 'te@example.com', 'active', '2026-01-01', '2026-01-01'),
    ('editor', 'Ed', 'ed@example.com', 'active', '2026-01-01', '2026-01-01'),
    ('owner', 'Ow', 'ow@example.com', 'active', '2026-01-01', '2026-01-01'),
    ('stranger', 'St', 'st@example.com', 'active', '2026-01-01', '2026-01-01');
  INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
    ('m-member', 'c', 'member', '[]', 'active', '2026-01-01', '2026-01-01'),
    ('m-team', 'c', 'team', '["team"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-editor', 'c', 'editor', '["editor"]', 'active', '2026-01-01', '2026-01-01'),
    ('m-owner', 'c', 'owner', '["owner"]', 'active', '2026-01-01', '2026-01-01');
  INSERT INTO songs (id, community_id, tags, created_by, created_at, updated_at) VALUES
    ('song', 'c', '[]', 'editor', '2026-01-01', '2026-01-01');
  INSERT INTO song_versions (id, community_id, song_id, language, title, lyrics, created_at, updated_at) VALUES
    ('song-ro', 'c', 'song', 'ro', 'Cântare', '1:\nVers', '2026-01-01', '2026-01-01');
`);

/** The matrix's columns. A stranger is logged in but not a member: a visitor too. */
export const people = [
  "visitor",
  "stranger",
  "member",
  "team",
  "editor",
  "owner",
] as const;
export type Person = (typeof people)[number];
export const sessions: Partial<Record<Person, string>> = {};
beforeAll(() => {
  for (const person of people)
    if (person !== "visitor") sessions[person] = createSession(db, person);
});

// Pages are never fetched to check them.
export const app = buildApp({
  db,
  logger: false,
  embedding: async () => null,
  recordingsDir: mkdtempSync(join(tmpdir(), "norless-permissions-")),
});
export const call = (
  as: Person,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  payload?: object,
) =>
  app.inject({
    method,
    url: `/api/communities/unu-unu${path}`,
    headers:
      as === "visitor" ? {} : { cookie: `__Host-session=${sessions[as]}` },
    payload,
  });

/** Runs `request` as each person; the allowed ones get `ok`, the others are refused. */
export function row(
  allowed: Person[],
  request: (as: Person) => ReturnType<typeof call>,
  ok = [200, 201, 204],
) {
  test.each(people)("%s", async (person) => {
    const { statusCode } = await request(person);
    if (allowed.includes(person)) expect(ok).toContain(statusCode);
    else expect(statusCode).toBe(person === "visitor" ? 401 : 403);
  });
}
