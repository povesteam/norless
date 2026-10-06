import { describe, expect, test } from "vitest";
import { app, call, people, type Person, row } from "./test-helpers.js";

describe("control live: next, previous, blank, parts, pages, stage messages", () => {
  const team: Person[] = ["team", "owner"];
  test.each(people)("see what's live: %s", async (person) =>
    expect((await call(person, "GET", "/live")).statusCode).toBe(200),
  );
  describe("blank", () =>
    row(team, (as) =>
      call(as, "POST", "/live", { type: "blank", blank: true }),
    ));
  describe("next", () =>
    row(team, (as) => call(as, "POST", "/live", { type: "next" })));
  describe("stage message", () =>
    row(team, (as) =>
      call(as, "POST", "/live", { type: "message", text: "5 minutes" }),
    ));
  describe("see the pages, to project them", () =>
    row(team, (as) => call(as, "GET", "/pages")));
  describe("project a page", () =>
    row(team, (as) =>
      call(as, "POST", "/live", { type: "page", pageId: null }),
    ));
});
describe("open screens on displays, pair a TV as a screen, share a screen's short link", () => {
  describe("see the room's screens", () =>
    row(["team", "owner"], (as) => call(as, "GET", "/screens")));
  const pairing = async () =>
    (
      await app.inject({
        method: "POST",
        url: "/api/pairing",
        payload: {
          token: `device-${Math.random().toString(36).slice(2)}-0123456789`,
        },
      })
    ).json<{ code: string }>().code;
  const screenId = async () =>
    (
      await call("owner", "POST", "/screens", {
        name: "Scenă",
        type: "stage",
        languages: ["ro"],
      })
    ).json<{ id: string }>().id;
  const device = async () =>
    (
      await call("owner", "POST", `/screens/${await screenId()}/devices`, {
        code: await pairing(),
      })
    ).json<{ id: string }>().id;
  describe("pair a TV", () =>
    row(["team", "owner"], async (as) =>
      call(as, "POST", `/screens/${await screenId()}/devices`, {
        code: await pairing(),
      }),
    ));
  describe("share a screen's short link", () =>
    row(["team", "owner"], async (as) => {
      const secret = (
        await call("owner", "POST", "/screens", {
          name: "Proiector",
          type: "projector",
          languages: ["ro"],
        })
      ).json<{ secret: string }>().secret;
      return call(as, "POST", "/short-codes", { kind: "screen", id: secret });
    }));
  describe("see paired devices", () =>
    row(["team", "owner"], (as) => call(as, "GET", "/devices")));
  describe("unpair a device", () =>
    row(["team", "owner"], async (as) =>
      call(as, "DELETE", `/devices/${await device()}`),
    ));
});

describe("listen for the band's tempo on a device", () =>
  row(["team", "owner"], (as) =>
    call(as, "POST", "/live/tempo", { listening: false }),
  ));

describe("record audio", () =>
  row(["team", "owner"], (as) =>
    call(as, "POST", "/recordings", { mime: "audio/webm" }),
  ));

describe("see the recordings and ask for access", () =>
  row(["team", "owner"], (as) => call(as, "GET", "/recordings")));
