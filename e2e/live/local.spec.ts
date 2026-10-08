import { expect, test } from "@playwright/test";
import { api, logInAs } from "../helpers";
import { base, rows, servicePlaylist } from "./playlist";

// Every test here changes the one room's live state, so they run one after another.
test.describe.configure({ mode: "serial" });

test("a visitor projects a playlist locally, and the church's screens don't change", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ioana@example.com");
  const id = await servicePlaylist(page);
  const room = async () =>
    (await api(page, "GET", "/api/communities/unu-unu/live")).body as {
      entryId: string | null;
      changedAt: string | null;
    };
  const before = await room();

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(`/unu-unu/playlists/${id}`);
  const [projector] = await Promise.all([
    visitor.waitForEvent("popup"),
    visitor.getByRole("button", { name: "Project here" }).click(),
  ]);
  // The visitor controls their own projector like the team controls the room's.
  await rows(visitor).first().click();
  await visitor.keyboard.press("Enter");
  await expect(projector.getByText("Amazing grace how sweet")).toBeVisible();
  await visitor.getByRole("button", { name: "Next" }).click();
  await expect(
    projector.locator("[data-fit]").getByText(/Slavă/),
  ).toBeVisible();
  // A projector window opened again catches up.
  await projector.reload();
  await expect(
    projector.locator("[data-fit]").getByText(/Slavă/),
  ).toBeVisible();
  // Stage messages and modes are the room's.
  await expect(
    visitor.getByRole("group", { name: "To the stage:" }),
  ).toHaveCount(0);
  expect(await room()).toMatchObject(before);

  await Promise.all([
    projector.waitForEvent("close"),
    visitor.getByRole("button", { name: "Stop projecting" }).click(),
  ]);
  await expect(visitor.getByRole("button", { name: "Next" })).toHaveCount(0);
  await visitor.context().close();
});

test("Project here starts where the church's screens are", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ioana@example.com");
  const id = await servicePlaylist(page);
  const { body } = await api(page, "GET", `${base}/${id}`);
  const entryId = (body as { entries: { id: string }[] }).entries[0]?.id;
  await api(page, "POST", "/api/communities/unu-unu/live", {
    type: "go",
    entryId,
    slide: 1,
  });

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(`/unu-unu/playlists/${id}`);
  const [projector] = await Promise.all([
    visitor.waitForEvent("popup"),
    visitor.getByRole("button", { name: "Project here" }).click(),
  ]);
  await expect(
    projector.locator("[data-fit]").getByText(/Slavă/),
  ).toBeVisible();
  await expect(rows(visitor).first()).toContainText("Live");
  await visitor.context().close();
});

test("anyone projects a song from its page", async ({ browser }) => {
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/unu-unu/songs/grace");
  const [projector] = await Promise.all([
    visitor.waitForEvent("popup"),
    visitor.getByRole("button", { name: "Project here" }).click(),
  ]);
  await expect(projector.getByText("Amazing grace how sweet")).toBeVisible();
  await visitor.getByRole("button", { name: "Refrain" }).first().click();
  await expect(
    projector.locator("[data-fit]").getByText(/Slavă/),
  ).toBeVisible();
  // Closing the projector window stops projecting, and the page says why.
  await projector.close();
  await expect(visitor.getByRole("alert")).toHaveText(
    "The projector window was closed, so projecting stopped.",
  );
  await expect(
    visitor.getByRole("button", { name: "Stop projecting" }),
  ).toHaveCount(0);
  await expect(
    visitor.getByRole("button", { name: "Project here" }),
  ).toBeVisible();
  await visitor.context().close();
});
