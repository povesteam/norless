import { type Page } from "@playwright/test";
import { api, expect, logInAs, test } from "./helpers";

// Adding between rows, switched on in Unu-Unu by the seed.

const base = "/api/communities/unu-unu/playlists";
/** A playlist of two dividers, Început and Sfârșit, opened as the team. */
async function openTwoDividers(page: Page, title: string) {
  await logInAs(page, "ioana@example.com");
  const { body } = await api(page, "POST", base, { title });
  const id = (body as { id: string }).id;
  for (const text of ["Început", "Sfârșit"])
    await api(page, "POST", `${base}/${id}/entries`, { kind: "divider", text });
  await page.goto(`/unu-unu/playlists/${id}`);
}
const rows = (page: Page) =>
  page.getByRole("grid", { name: "Entries" }).getByRole("row");
const search = (page: Page) =>
  page.getByRole("combobox", { name: "Search songs" });

test.describe("with a mouse", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  /** Points at the gap above a row, and opens its + menu. */
  async function openGapAbove(page: Page, row: number) {
    const add = page.getByRole("button", { name: "Add here" });
    // Again while the rows change: a pick's row is replaced once saved.
    await expect(async () => {
      const box = await rows(page).nth(row).boundingBox();
      if (!box) throw new Error("No row");
      await page.mouse.move(box.x + box.width / 3, box.y + 4);
      await expect(add).toBeVisible({ timeout: 1000 });
    }).toPass();
    await add.click();
  }

  test("a + between two rows adds a song, a divider or a text slide there", async ({
    page,
  }) => {
    await openTwoDividers(page, "Între rânduri");
    await expect(rows(page)).toHaveText([/Început/, /Sfârșit/]);
    // Away from the rows' edges, no line.
    await rows(page).first().hover();
    await expect(page.getByRole("button", { name: "Add here" })).toHaveCount(0);

    await openGapAbove(page, 1);
    // The + sits in the rows' column of icons, at the left.
    const row = await rows(page).nth(1).boundingBox();
    const plus = await page
      .getByRole("button", { name: "Add here" })
      .first()
      .boundingBox();
    expect((plus?.x ?? 0) - (row?.x ?? 0)).toBeLessThan(48);
    await page.getByRole("menuitem", { name: "Song", exact: true }).click();
    // The search box says where the pick lands.
    await expect(search(page)).toBeFocused();
    await expect(page.getByText("After “Început”")).toBeVisible();
    await page.keyboard.type("har min");
    await expect(
      page.getByRole("option", { name: /Har minunat/ }),
    ).toHaveAttribute("data-focused", "true");
    await page.keyboard.press("Enter");
    await expect(rows(page)).toHaveText([/Început/, /Har minunat/, /Sfârșit/]);
    await expect(rows(page).nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText("After “Început”")).toHaveCount(0);

    await openGapAbove(page, 1);
    await page.getByRole("menuitem", { name: "Divider", exact: true }).click();
    const divider = page.getByRole("dialog", { name: "Add divider" });
    await divider.getByRole("textbox", { name: "Heading" }).fill("Rugăciune");
    await divider.getByRole("button", { name: "Save" }).click();
    await expect(divider).toHaveCount(0);
    await expect(rows(page)).toHaveText([
      /Început/,
      /Rugăciune/,
      /Har minunat/,
      /Sfârșit/,
    ]);

    await openGapAbove(page, 3);
    await page
      .getByRole("menuitem", { name: "Text slide", exact: true })
      .click();
    const text = page.getByRole("dialog", { name: "Text slide" });
    await text.getByLabel("Text (Markdown)").fill("Anunțuri");
    await text.getByRole("button", { name: "Save" }).click();
    await expect(text).toHaveCount(0);
    await expect(rows(page)).toHaveText([
      /Început/,
      /Rugăciune/,
      /Har minunat/,
      /Anunțuri/,
      /Sfârșit/,
    ]);
  });

  test("a passage or a divider typed lands there too; Escape and × cancel", async ({
    page,
  }) => {
    await openTwoDividers(page, "Pasaj între rânduri");
    await openGapAbove(page, 1);
    await page.getByRole("menuitem", { name: "Song", exact: true }).click();
    await page.keyboard.type("ioan 3:16");
    await page.getByRole("option", { name: /^John 3:16/ }).click();
    await expect(rows(page)).toHaveText([/Început/, /John 3:16/, /Sfârșit/]);

    await openGapAbove(page, 1);
    await page.getByRole("menuitem", { name: "Song", exact: true }).click();
    await page.keyboard.type("Pauză");
    await page
      .getByRole("option", { name: "Add “Pauză” as a divider" })
      .click();
    await expect(rows(page)).toHaveText([
      /Început/,
      /Pauză/,
      /John 3:16/,
      /Sfârșit/,
    ]);

    await openGapAbove(page, 1);
    await page.getByRole("menuitem", { name: "Song", exact: true }).click();
    await expect(page.getByText("After “Început”")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText("After “Început”")).toHaveCount(0);

    await openGapAbove(page, 2);
    await page.getByRole("menuitem", { name: "Song", exact: true }).click();
    await expect(page.getByText("After “Pauză”")).toBeVisible();
    // With the mouse, while the list (which hides what's around it) is open.
    await page
      .getByRole("button", {
        name: "Add at the end instead",
        includeHidden: true,
      })
      .click();
    await expect(page.getByText("After “Pauză”")).toHaveCount(0);
  });
});

test.describe("on a phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test("a row's ⋯ menu adds a song or a text slide above it", async ({
    page,
  }) => {
    await openTwoDividers(page, "Deasupra");
    await page.getByRole("button", { name: "Actions: Sfârșit" }).tap();
    await expect(
      page.getByRole("menuitem", { name: "Add divider above" }),
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Add text slide above" }),
    ).toBeVisible();
    await page.getByRole("menuitem", { name: "Add song above" }).tap();
    await expect(page.getByText("After “Început”")).toBeVisible();
    await search(page).fill("isus");
    await page.getByRole("option", { name: /Isus e Domn/ }).tap();
    await expect(rows(page)).toHaveText([/Început/, /Isus e Domn/, /Sfârșit/]);
  });
});
