import { beforeEach, expect, test } from "vitest";
import { buildApp } from "../app.js";
import { createSession } from "../auth/auth.js";
import { type Db, migrate, openDatabase } from "../db/db.js";
import type { Feedback } from "./feedback.js";
import { devMailer, type Mail } from "../mail.js";
import { deleteAccount } from "../auth/members.js";

let db: Db;
let mails: Mail[];
const people = ["pavel", "ana", "ion", "stranger"] as const;
let sessions: Record<(typeof people)[number], string>;

beforeEach(() => {
  db = openDatabase(":memory:");
  migrate(db);
  db.exec(`
    INSERT INTO communities (id, slug, name, languages, time_zone, created_at, updated_at) VALUES
      ('c', 'unu-unu', 'Unu-Unu', '["ro","uk"]', 'Europe/Bucharest', 'x', 'x');
    INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES
      ('pavel', 'Pavel', 'pavel@example.com', 'active', 'x', 'x'),
      ('ana', 'Ana', 'ana@example.com', 'active', 'x', 'x'),
      ('ion', 'Ion', 'ion@example.com', 'active', 'x', 'x'),
      ('stranger', 'St', 'st@example.com', 'active', 'x', 'x');
    INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES
      ('m-pavel', 'c', 'pavel', '["owner"]', 'active', 'x', 'x'),
      ('m-ana', 'c', 'ana', '[]', 'active', 'x', 'x'),
      ('m-ion', 'c', 'ion', '["team"]', 'active', 'x', 'x');
  `);
  sessions = Object.fromEntries(
    people.map((p) => [p, createSession(db, p)]),
  ) as typeof sessions;
  mails = [];
});

const app = (mailer = true) => {
  const dev = devMailer();
  return buildApp({
    db,
    logger: false,
    origin: "https://norless.com",
    mailer: mailer
      ? async (mail) => {
          mails.push(mail);
          return dev.send(mail);
        }
      : null,
  });
};
const call = (
  as: (typeof people)[number] | null,
  method: "GET" | "POST" | "PATCH",
  path: string,
  payload?: object,
  server = app(),
) =>
  server.inject({
    method,
    url: `/api/communities/unu-unu/feedback${path}`,
    headers: as ? { cookie: `__Host-session=${sessions[as]}` } : {},
    payload,
  });
const idea = (text: string) => ({
  text,
  page: "/unu-unu/vocals",
  deviceType: "phone",
  language: "en",
});

test("a member's idea is kept and emailed to the owners, who can reply to the sender", async () => {
  expect(
    (
      await call(
        "ana",
        "POST",
        "",
        idea("Could the vocalists view show the next key?"),
      )
    ).statusCode,
  ).toBe(201);
  expect(mails).toEqual([
    {
      to: "pavel@example.com",
      subject: "Norless: an idea from Ana",
      text: expect.stringContaining(
        "Could the vocalists view show the next key?",
      ) as string,
      replyTo: "ana@example.com",
    },
  ]);
  expect(mails[0]?.text).toContain("https://norless.com/unu-unu/vocals");

  const list = (await call("pavel", "GET", "")).json<Feedback[]>();
  expect(list).toMatchObject([
    {
      text: "Could the vocalists view show the next key?",
      from: "Ana",
      page: "/unu-unu/vocals",
      deviceType: "phone",
      archivedAt: null,
    },
  ]);
});

test("without email the idea is still kept", async () => {
  const server = app(false);
  expect(
    (await call("ana", "POST", "", idea("Fără email"), server)).statusCode,
  ).toBe(201);
  expect(
    (await call("pavel", "GET", "", undefined, server)).json<Feedback[]>(),
  ).toHaveLength(1);
});

test("visitors and non-members can't send; empty, long and hurried messages are refused", async () => {
  expect((await call(null, "POST", "", idea("Spam"))).statusCode).toBe(401);
  expect((await call("stranger", "POST", "", idea("Spam"))).statusCode).toBe(
    403,
  );
  expect((await call("ana", "POST", "", idea("   "))).statusCode).toBe(400);
  expect(
    (await call("ana", "POST", "", idea("x".repeat(5001)))).statusCode,
  ).toBe(400);
  expect((await call("ana", "POST", "", idea("Una"))).statusCode).toBe(201);
  expect((await call("ana", "POST", "", idea("Încă una"))).statusCode).toBe(
    429,
  );
});

test("only owners list and archive ideas; archived ones show on request", async () => {
  await call("ana", "POST", "", idea("De arhivat"));
  const [first] = (await call("pavel", "GET", "")).json<Feedback[]>();
  expect((await call("ion", "GET", "")).statusCode).toBe(403);
  expect(
    (await call("ion", "PATCH", `/${first?.id}`, { archived: true }))
      .statusCode,
  ).toBe(403);

  expect(
    (await call("pavel", "PATCH", `/${first?.id}`, { archived: true }))
      .statusCode,
  ).toBe(204);
  expect((await call("pavel", "GET", "")).json()).toEqual([]);
  expect(
    (await call("pavel", "GET", "?archived=true")).json<Feedback[]>(),
  ).toHaveLength(1);
  await call("pavel", "PATCH", `/${first?.id}`, { archived: false });
  expect((await call("pavel", "GET", "")).json<Feedback[]>()).toHaveLength(1);
});

test("deleting an account deletes what it sent", async () => {
  await call("ana", "POST", "", idea("A mea"));
  expect(deleteAccount(db, "ana")).toBe("ok");
  expect((await call("pavel", "GET", "")).json()).toEqual([]);
});

test("an idea for the Norless app team reaches the team, not the owners", async () => {
  const server = buildApp({
    db,
    logger: false,
    origin: "https://norless.com",
    mailer: async (mail) => {
      mails.push(mail);
      return true;
    },
    appTeam: ["st@example.com"],
  });
  const as = (person: (typeof people)[number]) => ({
    cookie: `__Host-session=${sessions[person]}`,
  });
  expect(
    (
      await call(
        "ana",
        "POST",
        "",
        { ...idea("Un mod de concert"), to: "app" },
        server,
      )
    ).statusCode,
  ).toBe(201);
  expect(mails.map((m) => m.to)).toEqual(["st@example.com"]);
  expect(mails[0]?.text).toContain("https://norless.com/app-ideas");
  // Not on the owners' list.
  expect((await call("pavel", "GET", "", undefined, server)).json()).toEqual(
    [],
  );

  const list = (person: (typeof people)[number]) =>
    server.inject({ url: "/api/app-feedback", headers: as(person) });
  expect((await list("pavel")).statusCode).toBe(403);
  const [item] = (await list("stranger")).json<Feedback[]>();
  expect(item).toMatchObject({
    text: "Un mod de concert",
    from: "Ana",
    community: "Unu-Unu",
  });
  expect(
    (
      await server.inject({
        method: "PATCH",
        url: `/api/app-feedback/${item?.id}`,
        headers: as("stranger"),
        payload: { archived: true },
      })
    ).statusCode,
  ).toBe(204);
  expect((await list("stranger")).json()).toEqual([]);
  const me = await server.inject({ url: "/api/me", headers: as("stranger") });
  expect(me.json()).toMatchObject({ appTeam: true });
});
