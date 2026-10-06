import { barPages, expect, logInAs, openFromBar, test } from "./helpers";

test("the bar groups a team member's pages in one line at step 6", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await logInAs(page, "ioana@example.com");
  await page.goto("/echipa/playlists");
  const bar = page.locator("header nav").first();
  await expect(bar.getByRole("link", { name: "Playlists" })).toBeVisible();
  expect((await bar.boundingBox())?.height).toBeLessThan(48);
  await expect(page.getByRole("heading", { name: "Norless" })).toHaveCount(0);

  await bar.getByRole("button", { name: "Stage", exact: true }).click();
  await expect(page.getByRole("menuitem")).toHaveText([
    "Musicians",
    "Vocalists",
    "Stage monitor",
    "Host",
  ]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await openFromBar(page, "My schedule");
  await expect(page).toHaveURL("/echipa/my-schedule");
  await openFromBar(page, "Statistics");
  await expect(page).toHaveURL("/echipa/statistics");
});

test("a visitor's bar has Playlists and the stage views only", async ({
  page,
}) => {
  await page.goto("/unu-unu/playlists");
  expect(await barPages(page)).toEqual([
    "Unu-Unu",
    "Playlists",
    "Musicians",
    "Vocalists",
    "Stage monitor",
  ]);
});
