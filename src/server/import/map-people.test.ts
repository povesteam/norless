import type { Document } from "bson";
import { describe, expect, test } from "vitest";
import { one, run } from "./test-helpers.js";

describe("people", () => {
  const user = (id: string, email: string, extra: Document = {}) => ({
    _id: id,
    username: `name-${id}`,
    emails: [{ address: email, verified: false }],
    createdAt: new Date("2015-01-01T00:00:00Z"),
    services: {
      password: { bcrypt: "$2b$10$SECRETHASH" },
      resume: { loginTokens: [{ hashedToken: "SECRETTOKEN" }] },
    },
    status: {
      lastLogin: { date: new Date("2020-01-01T00:00:00Z"), ipAddr: "10.9.8.7" },
    },
    ...extra,
  });

  test("the same email in both databases is one person, with admin and creator flags", () => {
    const { rows } = run({
      "norless.users": [
        user("u1", "Ana@Example.com"),
        user("u2", "ion@example.com"),
      ],
      "norless-ua.users": [
        user("u1", "ana@example.com", {
          status: { lastLogin: { date: new Date("2025-05-01T00:00:00Z") } },
        }),
      ],
    });

    expect(rows.users.map((u) => [u.email, u.status, u.last_login_at])).toEqual(
      [
        ["ana@example.com", "imported", "2025-05-01T00:00:00.000Z"],
        ["ion@example.com", "imported", "2020-01-01T00:00:00.000Z"],
      ],
    );
    expect(rows.users[0]?.legacy_ids).toBe('["norless:u1","norless-ua:u1"]');
    expect(rows.members.map((m) => [m.was_creator, m.was_admin])).toEqual([
      [1, 0],
      [0, 1],
    ]);
  });

  test("no password hash, login token or IP address reaches the output", () => {
    const output = JSON.stringify(
      run({ "norless.users": [user("u1", "ana@example.com")] }),
    );

    expect(output).not.toMatch(
      /SECRETHASH|SECRETTOKEN|10\.9\.8\.7|bcrypt|hashedToken/,
    );
  });

  test("songs and entries point to their creator", () => {
    const { rows } = run({
      "norless.users": [user("u1", "ana@example.com")],
      "norless.songs": [{ _id: "s1", title: "A", text: "a", creator: "u1" }],
    });

    expect(one(rows.songs).created_by).toBe(one(rows.users).id);
  });
});
