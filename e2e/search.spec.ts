import { expect, type Page, test } from "@playwright/test";
import { api, logInAs, openSteadyPage } from "./helpers";

test.beforeEach(async ({ page }) => {
  await openSteadyPage(page);
});

test("typing anywhere starts a search, and Enter opens the first song", async ({
  page,
}) => {
  const box = page.getByRole("combobox", { name: "Search songs" });
  await page.keyboard.press("h");
  await expect(box).toBeFocused();
  await expect(box).toHaveValue("h");

  await page.keyboard.type("ar min");
  const option = page.getByRole("option", { name: /Har minunat/ });
  await expect(option).toBeVisible();
  await expect(option).toContainText("G");
  await expect(option).toContainText("3/4");
  await expect(option).toContainText("har");
  await expect(option).toContainText("last played 3 weeks ago");

  // The results for what was typed are in, with the first selected.
  await expect(page.getByRole("option").first()).toHaveAttribute(
    "data-focused",
    "true",
  );
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/unu-unu/songs/grace");
  await expect(
    page.getByRole("heading", { name: "Har minunat" }),
  ).toBeVisible();
});

test("title matches come first, and the arrow keys move the selection", async ({
  page,
}) => {
  await page.getByRole("combobox", { name: "Search songs" }).fill("har");
  // "Har minunat" by title, "Isus e Domn" by its lyrics.
  await expect(page.getByRole("listbox").getByRole("option")).toHaveText([
    /Har minunat/,
    /Isus e Domn/,
  ]);

  // The results for what was typed are in, with the first selected.
  await expect(page.getByRole("option").first()).toHaveAttribute(
    "data-focused",
    "true",
  );
  // In a filled frame, without the focus ring while typing.
  await expect(page.getByRole("option").first()).toHaveCSS(
    "box-shadow",
    "none",
  );
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("option").nth(1)).toHaveAttribute(
    "data-focused",
    "true",
  );
  await expect(page.getByRole("option").nth(1)).not.toHaveCSS(
    "box-shadow",
    "none",
  );
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/unu-unu/songs/isus");
});

test("Esc clears, and the empty box lists songs", async ({ page }) => {
  const box = page.getByRole("combobox", { name: "Search songs" });
  await box.fill("isus");
  await expect(page.getByRole("listbox").getByRole("option")).toHaveText([
    /Isus e Domn/,
  ]);

  await page.keyboard.press("Escape");
  await expect(box).toHaveValue("");
  await expect(page.getByRole("listbox").getByRole("option")).toHaveCount(0);

  await box.click();
  // Other tests add songs, so at least the two seeded ones.
  await expect
    .poll(() => page.getByRole("listbox").getByRole("option").count())
    .toBeGreaterThanOrEqual(2);
});

test("shortcuts with Cmd or Ctrl are not captured", async ({ page }) => {
  await page.keyboard.press("ControlOrMeta+c");

  await expect(
    page.getByRole("combobox", { name: "Search songs" }),
  ).not.toBeFocused();
});

test("in a playlist, the empty box offers what else goes there, then songs worth suggesting", async ({
  page,
}) => {
  await logInAs(page, "ioana@example.com");
  const { body } = await api(
    page,
    "POST",
    "/api/communities/unu-unu/playlists",
    {
      title: "Sugestii",
    },
  );
  await page.goto(`/unu-unu/playlists/${(body as { id: string }).id}`);
  await page.getByRole("combobox", { name: "Search songs" }).click();
  const options = page.getByRole("listbox").getByRole("option");
  await expect(options.nth(0)).toHaveText("Add divider");
  await expect(options.nth(1)).toHaveText("Add text slide");
  // How to find a passage, which isn't picked.
  await expect(options.nth(2)).toHaveText(
    "Type a reference to add a passage, like Ioan 3:16",
  );
  await expect(options.nth(2)).toHaveAttribute("aria-disabled", "true");
  // Sung in one of the last services, and in many but not for 6 months (the seed's).
  await expect(options.filter({ hasText: "Har minunat" })).toContainText(
    "Played recently",
  );
  await expect(options.filter({ hasText: "Isus e Domn" })).toContainText(
    "Bring it back",
  );
  // Enter adds the first song, not an action: the one played lately (nobody liked any).
  await expect(options.nth(3)).toContainText("Har minunat");
  await page.keyboard.press("Enter");
  const rows = page.getByRole("grid", { name: "Entries" }).getByRole("row");
  await expect(rows).toHaveText([/Har minunat/]);
  // Being prepared, its row says when it was last sung.
  await expect(rows.first()).toContainText("last played 3 weeks ago");

  await page.getByRole("combobox", { name: "Search songs" }).click();
  await options.filter({ hasText: "Add divider" }).click();
  const dialog = page.getByRole("dialog", { name: "Add divider" });
  await dialog.getByRole("textbox", { name: "Heading" }).fill("Final");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(rows).toHaveText([/./, /Final/]);
});

test.describe("the open search takes over the screen, above the live bar", () => {
  const open = async (page: Page) => {
    await logInAs(page, "ioana@example.com");
    await page.goto("/clasic/playlists/classic-sunday");
    const box = page.getByRole("combobox", { name: "Search songs" });
    const before = await box.boundingBox();
    await box.click();
    await page.keyboard.type("doar");
    await expect(
      page.getByRole("option", { name: /Doar harul/ }),
    ).toHaveAttribute("data-focused", "true");
    return { box, before };
  };
  /** The results end right above the live bar. */
  const endAboveBar = async (page: Page) => {
    const list = await page.getByRole("listbox").boundingBox();
    const bar = await page.locator("[data-bottom-bar]").boundingBox();
    expect(list && bar && bar.y - (list.y + list.height)).toBeLessThan(24);
    expect(
      list && bar && bar.y - (list.y + list.height),
    ).toBeGreaterThanOrEqual(0);
  };

  test.describe("on a phone", () => {
    test.use({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });

    test("the box goes to the top and the results fill the screen", async ({
      page,
    }) => {
      const { box, before } = await open(page);
      expect((await box.boundingBox())?.y).toBeLessThan(24);
      await endAboveBar(page);
      // Narrow: no words beside the results.
      await expect(
        page.getByRole("region", { name: "Doar harul Tău" }),
      ).toHaveCount(0);
      await page.keyboard.press("Escape");
      // The page as it was.
      expect(await box.boundingBox()).toEqual(before);
    });
  });

  test.describe("on a laptop", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test("the highlighted song's words show beside the results", async ({
      page,
    }) => {
      const { box, before } = await open(page);
      await endAboveBar(page);
      await expect(
        page.getByRole("region", { name: "Doar harul Tău" }),
      ).toContainText("M-a ridicat");
      // Its live bar stays in view.
      await expect(
        page.locator("[data-bottom-bar]").getByText("Projector RO"),
      ).toBeVisible();
      // Escape, which adds nothing to the Classic playlist other tests count.
      await page.keyboard.press("Escape");
      await expect(page.getByRole("listbox")).toHaveCount(0);
      expect(await box.boundingBox()).toEqual(before);
    });
  });
});

test("on a wide window, the results keep their width when the preview's code comes late", async ({
  page,
}) => {
  // The preview's code arrives after the results, as on a slow network.
  await page.route("**/SearchPreview-*.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.continue();
  });
  await page.getByRole("combobox", { name: "Search songs" }).fill("har min");
  const results = page.getByRole("listbox", { name: "Suggestions" });
  await expect(page.getByRole("option", { name: /Har minunat/ })).toBeVisible();
  const before = (await results.boundingBox())?.width;
  // The highlighted song's words beside them, once the code is there.
  await expect(
    page.getByRole("heading", { name: "Har minunat" }),
  ).toBeVisible();
  expect((await results.boundingBox())?.width).toBe(before);
});

test("a press on the box opens the results, and its release over a song doesn't pick it", async ({
  page,
}) => {
  await logInAs(page, "ioana@example.com");
  const { body } = await api(
    page,
    "POST",
    "/api/communities/unu-unu/playlists",
    { title: "Clic" },
  );
  const id = (body as { id: string }).id;
  await page.goto(`/unu-unu/playlists/${id}`);
  const box = page.getByRole("combobox", { name: "Search songs" });
  const at = await box.boundingBox();
  if (!at) throw new Error("no box");
  await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
  await page.mouse.down();
  // The box moved up, and a song came where the pointer is let go.
  const song = page.getByRole("option", { name: /Har minunat/ });
  const under = await song.boundingBox();
  if (!under) throw new Error("no song");
  await page.mouse.move(under.x + 20, under.y + under.height / 2);
  await page.mouse.up();
  await expect(
    page.getByRole("listbox", { name: "Suggestions" }),
  ).toBeVisible();
  const entries = await api(
    page,
    "GET",
    `/api/communities/unu-unu/playlists/${id}`,
  );
  expect((entries.body as { entries: unknown[] }).entries).toHaveLength(0);
});

test("the preview marks each part by its faint number, not its name", async ({
  page,
}) => {
  await page.getByRole("combobox", { name: "Search songs" }).fill("har min");
  const preview = page.getByRole("region", { name: "Har minunat" });
  await expect(preview.locator("[data-mark]").first()).toBeVisible();
  // Its name is only read out.
  await expect(preview.getByText(/^Verse 1$/)).toHaveClass(/sr-only/);
});

test("words typed together find the song", async ({ page }) => {
  await page.getByRole("combobox", { name: "Search songs" }).fill("harminunat");
  await expect(page.getByRole("option", { name: /Har minunat/ })).toBeVisible();
});
