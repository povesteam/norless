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
    "Played lately",
  );
  await expect(options.filter({ hasText: "Isus e Domn" })).toContainText(
    "Not played lately",
  );
  // Enter adds the first song, not an action: the one played lately (nobody liked any).
  await expect(options.nth(3)).toContainText("Har minunat");
  await page.keyboard.press("Enter");
  const rows = page.getByRole("grid", { name: "Entries" }).getByRole("row");
  await expect(rows).toHaveText([/Har minunat/]);

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
