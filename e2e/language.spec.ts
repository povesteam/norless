import { expect, test } from "./helpers";

// English for everyone until the Romanian and Ukrainian texts are reviewed.
test("the interface is English whatever the browser's language, with no language picker", async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: "ro-RO" });
  const page = await context.newPage();
  await page.goto("/unu-unu/playlists/steady");
  await expect(
    page.getByRole("combobox", { name: "Search songs" }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("combobox", { name: "Interface language" }),
  ).toHaveCount(0);
  await context.close();
});

test("a link from the old Ukrainian app opens, without its language parameter", async ({
  page,
}) => {
  // Where the server sends app-ua.norless.com links.
  await page.goto("/unu-unu/playlists/steady?lang=uk");
  await expect(page).toHaveURL("/unu-unu/playlists/steady");
  await expect(
    page.getByRole("combobox", { name: "Search songs" }),
  ).toBeVisible();
});
