import { describe, expect, test } from "vitest";
import { createSession } from "./auth.js";
import {
  app,
  call,
  db,
  people,
  type Person,
  row,
  sessions,
} from "./test-helpers.js";

describe("see names, avatars and who is online", () => {
  const members: Person[] = ["member", "team", "editor", "owner"];
  test.each(people)("%s", async (person) => {
    const song = (await call(person, "GET", "/songs/song")).json<{
      people?: { createdBy: { name: string } | null };
    }>();
    expect(song.people?.createdBy?.name).toBe(
      members.includes(person) ? "Ed" : undefined,
    );
  });
  // Who is online and who is editing: presence.test.ts and editing.test.ts.
});

describe.todo("keep preferences");
describe("delete one's own account", () => {
  // Anyone logged in, member or not; each attempt with an account of its own.
  test.each(people)("%s", async (person) => {
    if (person === "visitor")
      return expect(
        (await app.inject({ method: "DELETE", url: "/api/me" })).statusCode,
      ).toBe(401);
    const id = `leaving-${person}`;
    db.prepare(
      "INSERT INTO users (id, display_name, email, status, created_at, updated_at) VALUES (?, 'Le', ?, 'active', 'x', 'x')",
    ).run(id, `${id}@example.com`);
    const roles = {
      stranger: null,
      member: [],
      team: ["team"],
      editor: ["editor"],
      owner: ["owner"],
    }[person];
    if (roles)
      db.prepare(
        "INSERT INTO members (id, community_id, user_id, roles, status, created_at, updated_at) VALUES (?, 'c', ?, ?, 'active', 'x', 'x')",
      ).run(`m-${id}`, id, JSON.stringify(roles));
    const response = await app.inject({
      method: "DELETE",
      url: "/api/me",
      headers: { cookie: `__Host-session=${createSession(db, id)}` },
    });
    expect(response.statusCode).toBe(204);
  });
});
describe("choose one's photo: Google's, an uploaded one, or initials", () =>
  row(["stranger", "member", "team", "editor", "owner"], (as) =>
    app.inject({
      method: "PUT",
      url: "/api/me/avatar",
      headers:
        as === "visitor" ? {} : { cookie: `__Host-session=${sessions[as]}` },
      payload: { use: "initials" },
    }),
  ));
describe("send an idea or feedback", () =>
  row(["member", "team", "editor", "owner"], (as) =>
    call(as, "POST", "/feedback", {
      text: "O idee",
      page: "/unu-unu",
      deviceType: "laptop",
    }),
  ));

// A device's login page, waiting for a phone to approve it.
const pendingLogin = async () =>
  (
    await app.inject({ method: "POST", url: "/api/device-login", payload: {} })
  ).json<{ code: string; number: number }>();
const approveLogin = async (as: Person, how: object) => {
  const { code, number } = await pendingLogin();
  return app.inject({
    method: "POST",
    url: `/api/device-login/${code}/approve`,
    headers:
      as === "visitor" ? {} : { cookie: `__Host-session=${sessions[as]}` },
    payload: { number, ...how },
  });
};
describe("log another device in as oneself, from a phone", () =>
  row(["stranger", "member", "team", "editor", "owner"], (as) =>
    approveLogin(as, { as: "me" }),
  ));
describe("log a laptop in as the community's laptop, or a guest musician's phone", () => {
  describe("the laptop", () =>
    row(["team", "owner"], (as) =>
      approveLogin(as, { as: "laptop", community: "unu-unu" }),
    ));
  describe("a guest QR", () =>
    row(["team", "owner"], (as) =>
      call(as, "POST", "/guest-passes", { guest: "Vlad" }),
    ));
});

describe("read and archive ideas", () =>
  row(["owner"], (as) => call(as, "GET", "/feedback")));
