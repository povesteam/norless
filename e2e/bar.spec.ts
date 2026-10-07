import { type Page } from "@playwright/test";
import { api, barPages, expect, logInAs, openFromBar, test } from "./helpers";

/** A playlist of its own in Unu-Unu, by its title. */
async function newPlaylist(page: Page, title: string) {
  const { body } = await api(
    page,
    "POST",
    "/api/communities/unu-unu/playlists",
    {
      title,
    },
  );
  return (body as { id: string }).id;
}

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
    "Instruments",
    "Vocals",
    "Stage monitor",
    "Host",
  ]);
  // Links, so Cmd-click and right-click work on them.
  await expect(
    page.getByRole("menuitem", { name: "Instruments" }),
  ).toHaveAttribute("href", "/echipa/musicians");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await openFromBar(page, "My schedule");
  await expect(page).toHaveURL("/echipa/my-schedule");
  await openFromBar(page, "Statistics");
  await expect(page).toHaveURL("/echipa/statistics");
  // The account menu's pages too, opened in place.
  await page.getByRole("button", { name: "Ioana" }).click();
  const account = page.getByRole("menuitem", { name: "My account" });
  await expect(account).toHaveAttribute("href", "/account");
  await account.click();
  await expect(page).toHaveURL("/account");
});

test("a visitor's bar has Playlists and the stage views only", async ({
  page,
}) => {
  await page.goto("/unu-unu/playlists");
  expect(await barPages(page)).toEqual([
    "Unu-Unu",
    "Playlists",
    "Instruments",
    "Vocals",
    "Stage monitor",
  ]);
});

test("the playlists list shows each one's name, songs and who made it, without another date", async ({
  page,
}) => {
  await logInAs(page, "ioana@example.com");
  const id = await newPlaylist(page, "Listă cu autor");
  await page.goto("/unu-unu/playlists");
  const row = page.locator(`a[href$="/playlists/${id}"]`);
  await expect(row).toContainText("Listă cu autor");
  await expect(row).toContainText("0 songs");
  await expect(row.getByLabel("Made by Ioana")).toBeVisible();
  await expect(row).not.toContainText("Created");
});

test.describe("the title's menu on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("lists the newest other playlists and All playlists", async ({
    page,
  }) => {
    await logInAs(page, "ioana@example.com");
    const other = await newPlaylist(page, "Cealaltă listă");
    const id = await newPlaylist(page, "Lista de acum");
    await page.goto(`/unu-unu/playlists/${id}`);
    await page.locator("[data-bar-title] button").click();
    await expect(
      page.getByRole("menuitem", { name: "All playlists" }),
    ).toBeVisible();
    await page.getByRole("menuitem", { name: /^Cealaltă listă/ }).click();
    await expect(page).toHaveURL(new RegExp(`/playlists/${other}$`));
  });
});
