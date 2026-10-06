import { api, expect, logInAs, test } from "../helpers";
import { base, newPlaylist, rows } from "./playlist";

test.describe("on a laptop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("typing searches; random songs when empty; Enter adds; dividers too", async ({
    page,
  }) => {
    await logInAs(page, "ioana@example.com");
    const { body } = await api(page, "POST", base, { title: "Căutare" });
    await page.goto(`/clasic/playlists/${(body as { id: string }).id}`);

    const search = page.getByRole("combobox", { name: "Search songs" });
    await search.click();
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await page.mouse.click(5, 5);

    await page.keyboard.type("doar");
    await expect(
      page.getByRole("option", { name: /Doar harul/ }),
    ).toBeVisible();
    await expect(page.getByRole("option").first()).toHaveAttribute(
      "data-focused",
      "true",
    );
    await page.keyboard.press("Enter");
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("Doar harul Tău");
    // Who added it, under the selected entry's title, and no browser tooltip.
    await expect(page.getByText("Added by Ioana")).toBeVisible();
    await expect(
      rows(page).first().locator("[data-entry]"),
    ).not.toHaveAttribute("title");

    await search.fill("Anunțuri");
    await page
      .getByRole("option", { name: "Add “Anunțuri” as a divider" })
      .click();
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).nth(1)).toContainText("Anunțuri");
  });

  test("the menu creates today's playlist, finds older ones, and a new song goes into it", async ({
    page,
  }) => {
    await logInAs(page, "maria@example.com");
    await page.goto("/clasic/playlists/classic-sunday");
    await page.getByRole("button", { name: "Menu" }).click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    // It closes with the mouse too.
    await menu.getByRole("button", { name: "Close" }).click();
    await expect(menu).toBeHidden();
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(menu.getByRole("link", { name: "Duminică" })).toBeVisible();
    // Who made each playlist, as the old menu showed.
    await expect(
      menu.getByRole("listitem").filter({ hasText: "Duminică" }),
    ).toContainText("Ioana");

    // The 10 newest, and a filter for older ones.
    await menu.getByRole("textbox", { name: "Find a playlist" }).fill("dumin");
    await expect(menu.getByRole("link", { name: "Duminică" })).toBeVisible();
    await menu.getByRole("textbox", { name: "Find a playlist" }).fill("nimic");
    await expect(
      menu.getByText("No playlist has that in its title or date."),
    ).toBeVisible();
    // Its date finds it too, in the viewer's language.
    await menu
      .getByRole("textbox", { name: "Find a playlist" })
      .fill("january");
    await expect(menu.getByRole("link", { name: "Duminică" })).toBeVisible();

    await menu.getByRole("button", { name: "New playlist" }).click();
    await expect(page).toHaveURL(/\/clasic\/playlists\/[0-9A-Za-z]{12}$/);
    await expect(menu).toBeHidden();
    // No title: its date names it, and renaming waits for a click.
    await expect(
      page.getByRole("heading", { name: /^[A-Z][a-z]+ \d{1,2}(, \d{4})?$/ }),
    ).toBeVisible();
    await expect(page.getByLabel("Playlist title")).toHaveCount(0);

    // Closing a new song creates nothing.
    await page.getByRole("button", { name: "Menu" }).click();
    await menu.getByRole("button", { name: "Create new song" }).click();
    await page
      .getByRole("textbox", { name: "Title", exact: true })
      .fill("Nu rămâne");
    // It asks first, since a title was typed.
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page.getByText("Nothing in this playlist yet")).toBeVisible();
    const found = await api(
      page,
      "GET",
      "/api/communities/clasic/search?q=Nu%20r%C4%83m%C3%A2ne",
    );
    expect(
      JSON.stringify(
        (found.body as { results: { type: string }[] }).results.filter(
          (r) => r.type === "song",
        ),
      ),
    ).not.toContain("Nu rămâne");

    await page.getByRole("button", { name: "Menu" }).click();
    await menu.getByRole("button", { name: "Create new song" }).click();
    const title = page.getByRole("textbox", { name: "Title", exact: true });
    await expect(title).toBeFocused();
    // Room for two verses while empty, and it grows with the text.
    const text = page
      .getByRole("tabpanel")
      .getByRole("textbox", { name: "Text" });
    const empty = (await text.boundingBox())?.height ?? 0;
    expect(empty).toBeGreaterThan(250);
    await text.fill(
      Array.from({ length: 30 }, (_, i) => `Rândul ${i}`).join("\n"),
    );
    expect((await text.boundingBox())?.height ?? 0).toBeGreaterThan(empty);
    await text.fill("");
    await title.fill("Cântare nouă");
    await page
      .getByRole("button", { name: "Save and add to playlist" })
      .click();
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("Cântare nouă");
  });

  test("the editor has a tab per language; saving one leaves the other", async ({
    page,
  }) => {
    await logInAs(page, "maria@example.com");
    const { body } = await api(page, "POST", "/api/communities/clasic/songs", {
      versions: [
        { language: "ro", title: "Două limbi", text: "1:\nRomână" },
        { language: "uk", title: "Дві мови", text: "1:\nУкраїнська" },
      ],
    });
    const songId = (body as { id: string }).id;
    const list = await api(page, "POST", base, { title: "Editare" });
    const id = (list.body as { id: string }).id;
    await api(page, "POST", `${base}/${id}/entries`, { kind: "song", songId });
    await page.goto(`/clasic/playlists/${id}`);

    await rows(page).first().click();
    await page.getByRole("button", { name: "Edit song" }).click();
    // One language at a time until side by side is switched on.
    await expect(page.getByRole("radio", { name: "Side by side" })).toHaveCount(
      0,
    );
    // Ukrainian shows as UA, with its flag: UK reads as Britain.
    await page.getByRole("tab", { name: "UA" }).click();
    await page
      .getByRole("tabpanel")
      .getByRole("textbox", { name: "Text" })
      .fill("1:\nУкраїнська нова");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved")).toBeVisible();

    const saved = await api(
      page,
      "GET",
      `/api/communities/clasic/songs/${songId}`,
    );
    const versions = (
      saved.body as { versions: { language: string; text: string }[] }
    ).versions;
    expect(versions).toContainEqual(
      expect.objectContaining({ language: "uk", text: "1:\nУкраїнська нова" }),
    );
    expect(versions).toContainEqual(
      expect.objectContaining({ language: "ro", text: "1:\nRomână" }),
    );
  });

  test("Add divider above puts a divider just above the entry", async ({
    page,
  }) => {
    await logInAs(page, "ioana@example.com");
    const id = await newPlaylist(page, "Separator");
    await page.goto(`/clasic/playlists/${id}`);
    await rows(page)
      .filter({ hasText: "Doar harul" })
      .click({ button: "right" });
    await page.getByRole("menuitem", { name: "Add divider above" }).click();
    const dialog = page.getByRole("dialog", { name: "Add divider" });
    // No planned minutes while the times feature is off.
    await expect(dialog.getByText("Planned time")).toHaveCount(0);
    await dialog.getByRole("textbox", { name: "Heading" }).fill("Predica");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(rows(page)).toHaveText([
      /Lumina lumii/,
      /Rugăciune/,
      /Predica/,
      /Doar harul/,
    ]);
  });
});
