import { api, expect, logInAs, test } from "../helpers";
import { base, newPlaylist, rows, slides } from "./playlist";

test.describe("on a laptop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the playlist and the slides side by side, the editor in the slides' place, without later steps' controls", async ({
    page,
  }) => {
    await logInAs(page, "maria@example.com");
    await page.goto("/clasic/playlists/classic-sunday");
    await expect(rows(page)).toHaveCount(3);

    // A click shows the slides, beside the playlist, without projecting.
    await rows(page).filter({ hasText: "Lumina lumii" }).click();
    await expect(slides(page)).toContainText("O stea se-aprinde peste sat");
    await expect(rows(page).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Blank" })).toHaveCount(0);
    // No editor column until the pencil; Close brings the slides back.
    await expect(page.getByRole("heading", { name: "Edit song" })).toHaveCount(
      0,
    );
    await page.getByRole("button", { name: "Edit song" }).click();
    await expect(
      page.getByRole("heading", { name: "Edit song" }),
    ).toBeVisible();
    await expect(slides(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await expect(slides(page)).toContainText("O stea se-aprinde peste sat");

    // Nothing from later steps.
    for (const name of [
      "Add text slide",
      "Project here",
      "Copy short link",
      "Screens",
    ])
      await expect(page.getByRole("button", { name })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Layout/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Instruments" })).toHaveCount(
      0,
    );
    await expect(page.getByRole("link", { name: "All playlists" })).toHaveCount(
      0,
    );
    // Nor on a song's page.
    await page.goto("/clasic/songs/lumina");
    await expect(
      page.getByRole("heading", { name: "Lumina lumii" }),
    ).toBeVisible();
    for (const name of ["Project here", "Copy short link"])
      await expect(page.getByRole("button", { name })).toHaveCount(0);
  });

  test("the window doesn't scroll; each column does, without scroll in scroll", async ({
    page,
  }) => {
    await logInAs(page, "maria@example.com");
    const id = await newPlaylist(page, "Fereastră");
    // More entries than the window holds.
    for (let i = 0; i < 25; i++)
      await api(page, "POST", `${base}/${id}/entries`, {
        kind: "divider",
        text: `Pauză ${i}`,
      });
    await page.goto(`/clasic/playlists/${id}`);
    await rows(page).filter({ hasText: "Lumina lumii" }).click();
    await page.getByRole("button", { name: "Edit song" }).click();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
    const page_ = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight,
      window: window.innerHeight,
    }));
    expect(page_.scroll).toBeLessThanOrEqual(page_.window);
    // The playlist scrolls inside its column, and the bottom bar stays in view.
    await expect(rows(page)).toHaveCount(28);
    expect(
      await page.getByRole("grid", { name: "Entries" }).evaluate((grid) => {
        let column = grid.parentElement;
        while (column && getComputedStyle(column).overflowY !== "auto")
          column = column.parentElement;
        return !!column && column.scrollHeight > column.clientHeight;
      }),
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: /Projector RO/ }),
    ).toBeInViewport();
  });

  test("visitors see the entries and slides, without search or controls", async ({
    page,
  }) => {
    await page.goto("/clasic/playlists/classic-sunday");
    await rows(page).filter({ hasText: "Lumina lumii" }).click();
    await expect(slides(page)).toContainText("O stea se-aprinde peste sat");
    await expect(
      page.getByRole("combobox", { name: "Search songs" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Projector/ })).toHaveCount(
      0,
    );
    await expect(page.getByRole("button", { name: "Edit song" })).toHaveCount(
      0,
    );
  });
});
