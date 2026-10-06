import { describe, test } from "vitest";
import { call, type Person, row } from "./test-helpers.js";

describe("invite and remove members, change roles", () => {
  const owners: Person[] = ["owner"];
  describe("list", () => row(owners, (as) => call(as, "GET", "/members")));
  describe("invite", () =>
    row(owners, (as) =>
      call(as, "POST", "/members", {
        email: `new-${as}@example.com`,
        roles: ["team"],
      }),
    ));
  describe("change roles", () =>
    row(owners, (as) =>
      call(as, "PATCH", "/members/m-team", { roles: ["team"] }),
    ));
  describe("remove", () =>
    row(owners, async (as) => {
      await call("owner", "POST", "/members", {
        email: `gone-${as}@example.com`,
        roles: ["team"],
      });
      const members = (await call("owner", "GET", "/members")).json<
        { id: string; email: string }[]
      >();
      const gone = members.find((m) => m.email === `gone-${as}@example.com`);
      return call(as, "DELETE", `/members/${gone?.id}`);
    }));
});

describe("community settings: theme, privacy contact, languages, schedule, screens, pages, Bible versions, note names, tempo check, YouTube channel", () => {
  const owners: Person[] = ["owner"];
  const event = {
    kind: "recurring",
    name: "Serviciu",
    type: "service",
    weekday: 7,
    startTime: "10:00",
    endTime: "12:00",
  };
  const newEvent = async () =>
    (await call("owner", "POST", "/schedule", event)).json<{ id: string }>().id;
  describe("set the privacy contact", () =>
    row(owners, (as) =>
      call(as, "PUT", "/privacy", { name: "Biserica", email: "a@example.com" }),
    ));
  describe("change the theme", () =>
    row(owners, (as) => call(as, "PUT", "/theme", { color: "#ac5334" })));
  describe("choose the Bible versions", () =>
    row(owners, (as) =>
      call(as, "PUT", "/bible-versions", { versions: { ro: 126 } }),
    ));
  describe("choose when a tempo drift shows", () =>
    row(owners, (as) =>
      call(as, "PUT", "/tempo-check", { percent: 4, seconds: 8 }),
    ));
  describe("choose the note names", () =>
    row(owners, (as) =>
      call(as, "PUT", "/note-names", { noteNames: "solfege" }),
    ));
  describe("choose the YouTube channel", () =>
    row(owners, (as) =>
      call(as, "PUT", "/youtube-channel", { channel: "@Unu-unuRo" }),
    ));
  describe("see the schedule", () =>
    row(owners, (as) => call(as, "GET", "/schedule")));
  describe("add an event", () =>
    row(owners, (as) => call(as, "POST", "/schedule", event)));
  describe("change an event", () =>
    row(owners, async (as) =>
      call(as, "PUT", `/schedule/${await newEvent()}`, event),
    ));
  describe("delete an event", () =>
    row(owners, async (as) =>
      call(as, "DELETE", `/schedule/${await newEvent()}`),
    ));
  describe("classify imported plays", () =>
    row(owners, (as) => call(as, "POST", "/schedule/classify")));
  const screen = { name: "Proiector", type: "projector", languages: ["ro"] };
  const newScreen = async () =>
    (await call("owner", "POST", "/screens", screen)).json<{ id: string }>().id;
  describe("add a screen", () =>
    row(owners, (as) => call(as, "POST", "/screens", screen)));
  describe("change a screen", () =>
    row(owners, async (as) =>
      call(as, "PUT", `/screens/${await newScreen()}`, screen),
    ));
  describe("give a screen a new secret", () =>
    row(owners, async (as) =>
      call(as, "POST", `/screens/${await newScreen()}/secret`),
    ));
  describe("delete a screen", () =>
    row(owners, async (as) =>
      call(as, "DELETE", `/screens/${await newScreen()}`),
    ));
  const page = { name: "Start", url: "https://norless.test/start" };
  const newPage = async () =>
    (await call("owner", "POST", "/pages", page)).json<{ id: string }>().id;
  describe("add a page", () =>
    row(owners, (as) => call(as, "POST", "/pages", page)));
  describe("change a page", () =>
    row(owners, async (as) =>
      call(as, "PUT", `/pages/${await newPage()}`, page),
    ));
  describe("move a page", () =>
    row(owners, async (as) =>
      call(as, "POST", `/pages/${await newPage()}/move`, { by: 1 }),
    ));
  describe("delete a page", () =>
    row(owners, async (as) => call(as, "DELETE", `/pages/${await newPage()}`)));
  test.todo("theme, languages");
});
