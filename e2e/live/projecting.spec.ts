import { expect, test } from "@playwright/test";
import { api, logInAs } from "../helpers";
import { base, rows, servicePlaylist } from "./playlist";

// Every test here changes the one room's live state, so they run one after another.
test.describe.configure({ mode: "serial" });

test("the team sends entries live, and the projectors follow in their language", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ioana@example.com");
  const id = await servicePlaylist(page);
  const ro = await browser.newPage();
  await ro.goto("/unu-unu/projector/ro");
  const uk = await browser.newPage();
  await uk.goto("/unu-unu/projector/uk");

  await page.goto(`/unu-unu/playlists/${id}`);
  await rows(page).first().click();
  await page.keyboard.press("Enter");
  await expect(rows(page).first()).toContainText("Live");
  await expect(ro.getByText("Amazing grace how sweet")).toBeVisible();
  await expect(ro.getByText("#1/4")).toBeVisible();
  // The Ukrainian version has one slide.
  await expect(uk.getByText("Слава Тобі")).toBeVisible();

  await page.keyboard.press("PageDown");
  await expect(ro.getByText("#2/4")).toBeVisible();
  await expect(
    ro.locator("[data-fit]").getByText("Slavă ție", { exact: false }),
  ).toBeVisible();

  // Blank keeps the position: next shows slide 3.
  await page.keyboard.press("Escape");
  await expect(ro.getByText("#2/4")).toBeHidden();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(ro.getByText("#3/4")).toBeVisible();

  // Past the song's last slide, next skips the divider.
  await page.keyboard.press("ArrowRight");
  await expect(ro.getByText("#4/4")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(rows(page).nth(2)).toContainText("Live");
  await expect(ro.getByText("Cântăm cu bucurie")).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(ro.getByText("Ioan 3:16")).toBeVisible();
  await expect(uk.getByText("Івана 3:16")).toBeVisible();
  await ro.close();
  await uk.close();
});

test("part buttons and slides send their slide live, and others see who did it", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ioana@example.com");
  const id = await servicePlaylist(page);
  const ana = await (await browser.newContext()).newPage();
  await logInAs(ana, "ana@example.com");
  await ana.goto(`/unu-unu/playlists/${id}`);
  const ro = await browser.newPage();
  await ro.goto("/unu-unu/projector/ro");

  await page.goto(`/unu-unu/playlists/${id}`);
  await rows(page).first().dblclick();
  const parts = page.getByRole("group", { name: "Parts of the live song" });
  await expect(parts.getByRole("button")).toHaveText(["1", "R", "R", "2"]);
  await parts.getByRole("button", { name: "Refrain" }).first().click();
  await expect(ro.getByText("#2/4")).toBeVisible();
  await expect(ana.getByText("Ioana → Refrain")).toBeVisible();
  // Ioana is the last to change live, among those online.
  await expect(
    ana
      .getByRole("group", { name: "Online" })
      .getByLabel(/^Ioana.*last live change$/),
  ).toBeVisible();

  // The selected song's slides, beside the playlist.
  await page
    .getByRole("list", { name: "Slides" })
    .getByRole("button", { name: /Verse 2/ })
    .click();
  await expect(ro.getByText("#4/4")).toBeVisible();
  await expect(ro.getByText("Amin")).toBeVisible();
  await expect(ana.getByText("Ioana → Verse 2")).toBeVisible();

  // A divider doesn't go live.
  await rows(page).nth(1).click();
  await page.keyboard.press("Enter");
  await expect(ro.getByText("#4/4")).toBeVisible();
  await ana.context().close();
  await ro.close();
});

test("visitors see what's live but can't control it", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ioana@example.com");
  const id = await servicePlaylist(page);
  await page.goto(`/unu-unu/playlists/${id}`);
  await rows(page).first().click();
  await page.keyboard.press("Enter");

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(`/unu-unu/playlists/${id}`);
  await expect(rows(visitor).first()).toContainText("Live");
  await expect(visitor.getByRole("button", { name: "Next" })).toHaveCount(0);
  await rows(visitor).nth(2).click();
  await visitor.keyboard.press("Enter");
  await expect(rows(visitor).first()).toContainText("Live");
  await visitor.context().close();
});

test("a projector keeps its slide while offline, and catches up after", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ioana@example.com");
  const id = await servicePlaylist(page);
  await page.goto(`/unu-unu/playlists/${id}`);
  await rows(page).first().click();
  await page.keyboard.press("Enter");

  const context = await browser.newContext();
  const ro = await context.newPage();
  await ro.goto("/unu-unu/projector/ro");
  await expect(ro.getByText("#1/4")).toBeVisible();

  await context.setOffline(true);
  await page.keyboard.press("PageDown");
  await page.keyboard.press("PageDown");
  await ro.waitForTimeout(500);
  await expect(ro.getByText("#1/4")).toBeVisible(); // the last content stays

  await context.setOffline(false);
  await expect(ro.getByText("#3/4")).toBeVisible({ timeout: 10_000 });
  await expect(ro.getByRole("button", { name: "Fullscreen" })).toBeVisible();
  await context.close();
});

test("the operator's device moves at once, before the server answers, and snaps back if it refuses", async ({
  page,
}) => {
  await logInAs(page, "ioana@example.com");
  const id = await servicePlaylist(page);
  const entries = (
    (await api(page, "GET", `${base}/${id}`)).body as {
      entries: { id: string }[];
    }
  ).entries;
  await api(page, "POST", "/api/communities/unu-unu/live", {
    type: "go",
    entryId: entries[0]?.id,
  });
  await page.goto(`/unu-unu/playlists/${id}`);
  const part = (n: number) =>
    page
      .getByRole("group", { name: "Parts of the live song" })
      .getByRole("button")
      .nth(n);
  await expect(part(0)).toHaveAttribute("aria-pressed", "true");

  // The server takes its time: the next part shows as live meanwhile.
  let release: () => void = () => {};
  let held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/communities/unu-unu/live", async (route) => {
    await held;
    await route.continue();
  });
  await page.getByRole("button", { name: "Next" }).click();
  await expect(part(1)).toHaveAttribute("aria-pressed", "true");
  release();
  await page.unrouteAll({ behavior: "wait" });
  await expect(part(1)).toHaveAttribute("aria-pressed", "true");

  // Refused: shown at once, then back to what the room shows.
  held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/communities/unu-unu/live", async (route) => {
    await held;
    await route.fulfill({ status: 500, body: "{}" });
  });
  await page.getByRole("button", { name: "Next" }).click();
  await expect(part(2)).toHaveAttribute("aria-pressed", "true");
  release();
  await expect(part(1)).toHaveAttribute("aria-pressed", "true");
  await page.unrouteAll({ behavior: "wait" });
});

test("entries above the live one look done, and while blank a line marks where the service is; no clocks in rows", async ({
  page,
}) => {
  await logInAs(page, "ioana@example.com");
  const id = await servicePlaylist(page);
  await page.goto(`/unu-unu/playlists/${id}`);
  // The estimated end stays in the header; the rows show no clock.
  await expect(page.getByLabel("Estimated end")).toContainText("Ends at");
  await rows(page).nth(2).click();
  await page.keyboard.press("Enter");
  await expect(rows(page).nth(2).locator("[data-entry]")).not.toHaveAttribute(
    "data-passed",
  );
  for (const i of [0, 1])
    await expect(rows(page).nth(i).locator("[data-entry]")).toHaveAttribute(
      "data-passed",
    );
  await expect(rows(page).nth(3).locator("[data-entry]")).not.toHaveAttribute(
    "data-passed",
  );
  await expect(rows(page).first()).not.toContainText(/\d{1,2}:\d{2}/);
  await expect(page.locator("[data-position]")).toHaveCount(0);

  // Blank: the live entry is done too, with the line under it.
  await page.getByRole("button", { name: "Blank" }).first().click();
  await expect(rows(page).nth(2).locator("[data-entry]")).toHaveAttribute(
    "data-passed",
  );
  await expect(rows(page).nth(2).locator("[data-position]")).toBeAttached();
});

test("the search box runs commands: blank, a part by name, next", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ioana@example.com");
  const id = await servicePlaylist(page);
  const ro = await browser.newPage();
  await ro.goto("/unu-unu/projector/ro");
  await page.goto(`/unu-unu/playlists/${id}`);
  await rows(page).first().click();
  await page.keyboard.press("Enter");
  await expect(ro.getByText("#1/4")).toBeVisible();

  // Away from where the results open, so hovering doesn't select one.
  await page.mouse.move(0, 0);
  const search = page.getByRole("combobox", { name: "Search songs" });
  const run = async (text: string, command: string) => {
    await search.fill(text);
    await expect(page.getByRole("option").first()).toContainText(command);
    await expect(page.getByRole("option").first()).toHaveAttribute(
      "data-focused",
      "true",
    );
    await page.keyboard.press("Enter");
  };
  await run("refr", "Go to Refrain");
  await expect(ro.getByText("#2/4")).toBeVisible();
  await run("verse 2", "Go to Verse 2");
  await expect(ro.getByText("#4/4")).toBeVisible();
  await run("blank", "Blank the screens");
  await expect(ro.getByText("#4/4")).toBeHidden();
  await ro.close();
});
