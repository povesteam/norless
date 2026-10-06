import { api, barPages, expect, logInAs, openFromBar, test } from "./helpers";

const base = "/api/communities/unu-unu/playlists";

test("owners read who changed what and when, with what it was before", async ({
  page,
}) => {
  await logInAs(page, "ana@example.com");
  const { body } = await api(page, "POST", base, { title: "De schimbat" });
  const { id } = body as { id: string };
  await api(page, "PATCH", `${base}/${id}`, { title: "Schimbat" });

  await page.goto("/unu-unu/playlists");
  await openFromBar(page, "Changes");
  await expect(page).toHaveURL("/unu-unu/changes");
  const change = page
    .getByRole("listitem")
    .filter({ hasText: "Playlist · Schimbat" })
    .filter({ hasText: "Changed" });
  await expect(change).toContainText("Ana");
  await expect(change).toContainText("De schimbat → Schimbat");

  // By kind: the playlists' changes aren't songs.
  await page.getByRole("button", { name: /About/ }).click();
  await page.getByRole("option", { name: "Songs" }).click();
  await expect(page.getByText("Playlist · Schimbat")).toHaveCount(0);
});

test("only owners see the Changes page", async ({ page }) => {
  await logInAs(page, "ioana@example.com");
  await page.goto("/unu-unu/playlists");
  await expect(
    page.getByRole("link", { name: "Playlists" }).first(),
  ).toBeVisible();
  expect(await barPages(page)).not.toContain("Changes");
  await page.goto("/unu-unu/changes");
  await expect(
    page.getByText("Only the community's owners see its changes."),
  ).toBeVisible();
});

test("an open page shows others' changes without a reload", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ana@example.com");
  await page.goto("/unu-unu/changes");
  await expect(page.getByRole("heading", { name: "Changes" })).toBeVisible();

  const other = await (await browser.newContext()).newPage();
  await logInAs(other, "ana@example.com");
  await api(other, "POST", base, { title: "De departe" });

  await expect(page.getByText("Playlist · De departe")).toBeVisible();
});
