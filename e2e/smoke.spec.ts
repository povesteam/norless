import { expect, test } from "./helpers";

test("home page loads", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Norless" })).toBeVisible();
});

test("a community's URL opens that community", async ({ page }) => {
  await page.goto("/unu-unu");

  // Its newest playlist, or its follow-along page while another test has a song live.
  await expect(page).toHaveURL(/\/unu-unu\/(playlists\/|follow)/);
});

test("unknown pages and communities show not found, with a way back", async ({
  page,
}) => {
  for (const url of ["/unu-unu/nothing/here", "/nope-nope"]) {
    await page.goto(url);
    await expect(page.getByText("This page doesn't exist.")).toBeVisible();
  }

  // The start page opens the community opened last.
  await page.getByRole("link", { name: "Go to the start page" }).click();
  await expect(page).toHaveURL(/\/unu-unu/);
  await expect(page.getByText("This page doesn't exist.")).toBeHidden();
});
