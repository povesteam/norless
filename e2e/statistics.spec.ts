import {
  api,
  barPages,
  expect,
  logInAs,
  openFromBar,
  openSteadyPage,
  test,
} from "./helpers";

test("members open the statistics from the menu; a new song says it wasn't sung yet", async ({
  page,
}) => {
  await logInAs(page, "maria@example.com");
  await page.goto("/unu-unu/playlists");
  await openFromBar(page, "Statistics");
  await expect(page).toHaveURL("/unu-unu/statistics");
  await expect(
    page.getByRole("heading", { name: "Most played", level: 3 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Not played lately", level: 3 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Played a lot lately", level: 3 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "The last 12 services", level: 3 }),
  ).toBeVisible();
  // A season is offered once a year is picked.
  const season = page.getByRole("button", { name: /Season/ });
  await expect(season).toBeDisabled();
  await page.getByRole("button", { name: /Period/ }).click();
  await page
    .getByRole("option", { name: String(new Date().getFullYear()) })
    .click();
  await expect(season).toBeEnabled();
  await expect(
    page.getByRole("region", {
      name: `${new Date().getFullYear()} in songs`,
    }),
  ).toBeVisible();

  // A song never sung in a service says so on its page.
  await logInAs(page, "ana@example.com");
  const { body } = await api(page, "POST", "/api/communities/unu-unu/songs", {
    versions: [{ language: "ro", title: "Abia scrisă", text: "1:\nNouă" }],
  });
  await page.goto(`/unu-unu/songs/${(body as { id: string }).id}`);
  await expect(page.getByRole("region", { name: "Services" })).toHaveText(
    "Not played in a service yet.",
  );
});

test("visitors have no statistics", async ({ page }) => {
  await page.goto("/unu-unu/songs/grace");
  await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
  await expect(page.getByRole("region", { name: "Services" })).toHaveCount(0);
  expect(await barPages(page)).not.toContain("Statistics");
  await page.goto("/unu-unu/statistics");
  await expect(
    page.getByText("Only the community's members see the statistics."),
  ).toBeVisible();
});

test("a search that finds nothing shows for editors, and starts the song with that title", async ({
  page,
}) => {
  // Searches that find nothing are counted per address, 30 an hour; the whole run
  // shares one, so this test comes from its own.
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "10.0.0.58" });
  await logInAs(page, "ana@example.com");
  await openSteadyPage(page);
  const search = page.getByRole("combobox", { name: "Search songs" });
  await search.fill("Zxqv cântec lipsă");
  // The results for the whole search are in (it offers a song by that title), so
  // closing the box tells the miss.
  await expect(
    page.getByRole("option", { name: /Create the song “Zxqv cântec lipsă”/ }),
  ).toBeVisible();
  const told = page.waitForResponse(
    (r) =>
      r.url().endsWith("/search-misses") && r.request().method() === "POST",
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await search.blur();
  await told;

  await page.goto("/unu-unu/statistics");
  const misses = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Looked for, not found" }),
  });
  await expect(misses.getByText(/Zxqv/)).toBeVisible();
  await misses
    .getByRole("listitem")
    .filter({ hasText: "Zxqv" })
    .getByRole("link", { name: "New song" })
    .click();
  await expect(page).toHaveURL(/\/unu-unu\/songs\/new\?title=/);
  await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue(
    /Zxqv/,
  );
});
