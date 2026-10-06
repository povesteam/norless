import { expect, type Page, test } from "@playwright/test";
import { api, logInAs, openSteadyPage, pickLayout } from "./helpers";

/** A new playlist with these dividers, made through the API as the logged-in member. */
async function playlistWith(page: Page, title: string, dividers: string[]) {
  const base = "/api/communities/unu-unu/playlists";
  const { body } = await api(page, "POST", base, { title });
  const id = (body as { id: string }).id;
  for (const text of dividers)
    await api(page, "POST", `${base}/${id}/entries`, { kind: "divider", text });
  return id;
}

const rows = (page: Page) =>
  page.getByRole("grid", { name: "Entries" }).getByRole("row");

test.describe("the team", () => {
  // Tall enough that the team's live bar, sticky at the bottom, doesn't cover the rows.
  test.use({ viewport: { width: 1280, height: 1100 } });
  test.beforeEach(({ page }) => logInAs(page, "ioana@example.com"));

  test("creates a playlist named by its date and fills it from the search box", async ({
    page,
  }) => {
    await page.goto("/unu-unu/playlists");
    await page.getByRole("button", { name: "New playlist" }).click();
    await expect(page).toHaveURL(/\/unu-unu\/playlists\/[0-9A-Za-z]{12}$/);
    // No title: its date names it, and renaming waits for a click.
    await expect(
      page.getByRole("heading", { name: /^[A-Z][a-z]+ \d{1,2}(, \d{4})?$/ }),
    ).toBeVisible();
    await expect(page.getByLabel("Playlist title")).toHaveCount(0);
    await expect(page.getByText("Nothing in this playlist yet")).toBeVisible();

    // Away from where the results open, so hovering doesn't select one.
    await page.mouse.move(0, 0);
    const search = page.getByRole("combobox", { name: "Search songs" });
    await search.fill("har min");
    await expect(
      page.getByRole("option", { name: /Har minunat/ }),
    ).toBeVisible();
    // The results for what was typed are in, with the first selected.
    await expect(page.getByRole("option").first()).toHaveAttribute(
      "data-focused",
      "true",
    );
    await page.keyboard.press("Enter");
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText("Har minunat");
    await expect(rows(page).first()).toHaveAttribute("aria-selected", "true");

    await search.fill("ioan 3 16");
    await expect(
      page.getByRole("option", { name: /^John 3:16/ }),
    ).toBeVisible();
    // The results for what was typed are in, with the first selected.
    await expect(page.getByRole("option").first()).toHaveAttribute(
      "data-focused",
      "true",
    );
    await page.keyboard.press("Enter");
    await expect(rows(page).nth(1)).toContainText("John 3:16");
    await expect(
      rows(page).nth(1).getByRole("link", { name: "bible.com" }),
    ).toHaveAttribute("href", "https://www.bible.com/bible/1/JHN.3.16.KJV");

    await search.fill("Cina Domnului");
    await page
      .getByRole("option", { name: "Add “Cina Domnului” as a divider" })
      .click();
    await expect(rows(page).nth(2)).toContainText("Cina Domnului");

    await page.getByRole("button", { name: "Add text slide" }).click();
    await page.getByLabel("Text (Markdown)").fill("# Anunțuri\nDuminică la 10");
    // Planned time as people write it; what isn't one can't be saved.
    const planned = page.getByRole("textbox", { name: "Planned time" });
    await planned.fill("5 hours");
    await expect(
      page.getByRole("button", { name: "Save", exact: true }),
    ).toBeDisabled();
    await planned.fill("1:30");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(rows(page).nth(3)).toContainText("Anunțuri");
    await expect(rows(page).nth(3)).toContainText("1 h 30 min");
  });

  test("an added song shows at once, before the server answers, and goes if it refuses", async ({
    page,
  }) => {
    const id = await playlistWith(page, "Repede", []);
    await page.goto(`/unu-unu/playlists/${id}`);
    const search = page.getByRole("combobox", { name: "Search songs" });

    let release: () => void = () => {};
    let held = new Promise<void>((resolve) => (release = resolve));
    await page.route(`**/playlists/${id}/entries`, async (route) => {
      await held;
      await route.continue();
    });
    await search.fill("har");
    await page.getByRole("option", { name: /Har minunat/ }).click();
    await expect(rows(page)).toHaveText([/Har minunat/]);
    release();
    await page.unrouteAll({ behavior: "wait" });
    await expect(rows(page)).toHaveText([/Har minunat/]);

    held = new Promise<void>((resolve) => (release = resolve));
    await page.route(`**/playlists/${id}/entries`, async (route) => {
      await held;
      await route.fulfill({ status: 500, body: "{}" });
    });
    await search.fill("isus");
    await page.getByRole("option", { name: /Isus e Domn/ }).click();
    await expect(rows(page)).toHaveText([/Har minunat/, /Isus e Domn/]);
    release();
    await expect(rows(page)).toHaveText([/Har minunat/]);
    await page.unrouteAll({ behavior: "wait" });
  });

  test("moves entries with Alt+arrows and by dragging, and removes them", async ({
    page,
  }) => {
    const id = await playlistWith(page, "Ordine", ["Unu", "Doi", "Trei"]);
    await page.goto(`/unu-unu/playlists/${id}`);
    await expect(rows(page)).toHaveText([/Unu/, /Doi/, /Trei/]);

    await rows(page).nth(2).click();
    await page.keyboard.press("Alt+ArrowUp");
    await expect(rows(page)).toHaveText([/Unu/, /Trei/, /Doi/]);
    await page.keyboard.press("ArrowUp");
    await expect(rows(page).first()).toHaveAttribute("aria-selected", "true");
    // The move is the server's before the drag, so a reload can't swap rows mid-drag.
    await page.reload();
    await expect(rows(page)).toHaveText([/Unu/, /Trei/, /Doi/]);

    // Emulated drag and drop sometimes misses or lands a row lower under load; drag
    // "Doi" to the top again, from wherever it is, until it's there.
    await expect(async () => {
      const order = await rows(page).allTextContents();
      const at = order.findIndex((text) => text.includes("Doi"));
      if (at > 0) {
        // In steps, so the drag starts and passes over the rows like a real one.
        const from = await rows(page).nth(at).boundingBox();
        const to = await rows(page).first().boundingBox();
        if (from && to) {
          await page.mouse.move(from.x + 20, from.y + from.height / 2);
          await page.mouse.down();
          await page.mouse.move(to.x + 20, to.y + 2, { steps: 12 });
          await page.mouse.up();
        }
      }
      await expect(rows(page)).toHaveText([/Doi/, /Unu/, /Trei/], {
        timeout: 2000,
      });
    }).toPass({ timeout: 15_000 });

    // The order is the server's too.
    await page.reload();
    await expect(rows(page)).toHaveText([/Doi/, /Unu/, /Trei/]);

    await rows(page).first().click();
    await page.keyboard.press("Delete");
    await expect(rows(page)).toHaveText([/Unu/, /Trei/]);
    // Rows have no handle or remove button; a right-click has the actions.
    await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(0);
    await rows(page).nth(1).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Move up" }).click();
    await expect(rows(page)).toHaveText([/Trei/, /Unu/]);
    await rows(page).first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "Remove" }).click();
    await expect(rows(page)).toHaveText([/Unu/]);
  });

  test("two languages side by side in a part don't overlap, however long the lines", async ({
    page,
  }) => {
    const long = (word: string) => Array(12).fill(word).join(" ");
    // The song needs an editor; the owner is one.
    await logInAs(page, "ana@example.com");
    const { body } = await api(page, "POST", "/api/communities/unu-unu/songs", {
      versions: [
        { language: "ro", title: "Lungă", text: `1:\n${long("cuvânt")}` },
        { language: "uk", title: "Довга", text: `1:\n${long("слово")}` },
      ],
    });
    const id = await playlistWith(page, "Rânduri lungi", []);
    await api(
      page,
      "POST",
      `/api/communities/unu-unu/playlists/${id}/entries`,
      {
        kind: "song",
        songId: (body as { id: string }).id,
      },
    );
    await page.goto(`/unu-unu/playlists/${id}`);
    await pickLayout(page, "Controller");
    await rows(page).first().click();
    const part = page
      .getByRole("list", { name: "Slides" })
      .getByRole("listitem")
      .first();
    const ro = await part.locator('[lang="ro"]').boundingBox();
    const uk = await part.locator('[lang="uk"]').boundingBox();
    expect((ro?.x ?? 0) + (ro?.width ?? 0)).toBeLessThanOrEqual(
      (uk?.x ?? 0) + 1,
    );
    // Long lines wrap inside their column instead of running into the next.
    const overflow = await part
      .locator('[lang="ro"] div div')
      .first()
      .evaluate((line) => line.scrollWidth - line.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("a removed entry comes back with Undo, in its place", async ({
    page,
  }) => {
    const id = await playlistWith(page, "Anulare", ["Unu", "Doi", "Trei"]);
    await page.goto(`/unu-unu/playlists/${id}`);
    await rows(page).nth(1).click();
    await page.keyboard.press("Delete");
    await expect(rows(page)).toHaveText([/Unu/, /Trei/]);
    await page
      .getByRole("status")
      .getByRole("button", { name: "Undo" })
      .click();
    await expect(rows(page)).toHaveText([/Unu/, /Doi/, /Trei/]);
    await page.reload();
    await expect(rows(page)).toHaveText([/Unu/, /Doi/, /Trei/]);
  });

  test("Delete in the search box doesn't remove the selected entry", async ({
    page,
  }) => {
    const id = await playlistWith(page, "Păstrat", ["Rămâne"]);
    await page.goto(`/unu-unu/playlists/${id}`);
    await rows(page).first().click();
    const search = page.getByRole("combobox", { name: "Search songs" });
    await search.fill("x");
    await search.press("Backspace");
    await search.press("Delete");
    await page.keyboard.press("Escape");
    await expect(rows(page)).toHaveCount(1);
  });

  test("renames, archives and restores a playlist", async ({ page }) => {
    const id = await playlistWith(page, "Vechi", []);
    await page.goto(`/unu-unu/playlists/${id}`);
    // The title is in the bar; a click edits it, Escape leaves it as it was.
    const title = page.getByLabel("Playlist title");
    await page.getByRole("button", { name: "Vechi" }).click();
    await title.fill("Altceva");
    await title.press("Escape");
    await expect(page.getByRole("heading", { name: "Vechi" })).toBeVisible();
    await page.getByRole("button", { name: "Vechi" }).click();
    await title.fill("Seara de rugăciune");
    await title.press("Enter");
    await expect(
      page.getByRole("button", { name: "Seara de rugăciune" }),
    ).toBeFocused();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Seara de rugăciune" }),
    ).toBeVisible();
    // Rename in its actions does the same; an empty title leaves the date alone.
    await page.getByRole("button", { name: "Playlist actions" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await expect(title).toBeFocused();
    await title.fill("");
    await title.press("Enter");
    await expect(
      page.getByRole("heading", { name: /^[A-Z][a-z]+ \d{1,2}(, \d{4})?$/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Playlist actions" }).click();
    await page.getByRole("menuitem", { name: "Rename" }).click();
    await title.fill("Seara de rugăciune");
    await title.press("Enter");

    // Archived, it stays readable here, and only Restore changes it.
    await page.getByRole("button", { name: "Playlist actions" }).click();
    await page.getByRole("menuitem", { name: "Archive playlist" }).click();
    await expect(page.getByText(/^Archived on /)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Seara de rugăciune" }),
    ).toHaveCount(0);
    await page.goto("/unu-unu/playlists");
    const link = page.getByRole("link", { name: /Seara de rugăciune/ });
    await expect(link).toHaveCount(0);
    await page.getByText("Show archived").click();
    await link.click();
    await page.getByRole("button", { name: "Restore" }).click();
    await expect(
      page.getByRole("button", { name: "Seara de rugăciune" }),
    ).toBeVisible();
  });

  test("the home opens the newest playlist, from the community's name", async ({
    page,
  }) => {
    const id = await playlistWith(page, "Cea mai nouă", []);
    await page.goto("/unu-unu");
    await expect(page).toHaveURL(/\/unu-unu\/playlists\/[0-9A-Za-z]{12}$/);
    await page.goto("/unu-unu/playlists");
    await page.getByRole("link", { name: "Unu-Unu", exact: true }).click();
    await expect(page).toHaveURL(/\/unu-unu\/playlists\/[0-9A-Za-z]{12}$/);
    // A playlist's whole row opens it, its date too.
    await page.goto("/unu-unu/playlists");
    await page
      .getByRole("link", { name: /Cea mai nouă/ })
      .locator("span")
      .last()
      .click();
    await expect(page).toHaveURL(`/unu-unu/playlists/${id}`);
  });
});

test("a team member who is also an editor creates a song from the search box, added once saved", async ({
  page,
}) => {
  await logInAs(page, "ana@example.com");
  const id = await playlistWith(page, "Cu cântare nouă", []);
  await page.goto(`/unu-unu/playlists/${id}`);
  await page.mouse.move(0, 0);
  await page
    .getByRole("combobox", { name: "Search songs" })
    .fill("Cântec din căutare");
  await page
    .getByRole("option", { name: "Create the song “Cântec din căutare”" })
    .click();

  // The editor opens with the title; nothing exists until it's saved.
  await expect(
    page.getByRole("textbox", { name: /^Title/ }).first(),
  ).toHaveValue("Cântec din căutare");
  await expect(page.getByText("Nothing in this playlist yet")).toBeVisible();
  await page
    .getByRole("textbox", { name: /^Text/ })
    .first()
    .fill("1:\nUn vers");
  await page.getByRole("button", { name: "Save and add to playlist" }).click();
  await expect(rows(page)).toHaveText([/Cântec din căutare/]);
  // Saved again, it's the same song, not a second entry.
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  await expect(rows(page)).toHaveText([/Cântec din căutare/]);
});

test("entries show titles in the community's first language while the interface is English, and members see who added them", async ({
  page,
}) => {
  await logInAs(page, "ioana@example.com");
  const id = await playlistWith(page, "Limbi", []);
  await api(page, "POST", `/api/communities/unu-unu/playlists/${id}/entries`, {
    kind: "song",
    songId: "grace",
  });
  await page.goto(`/unu-unu/playlists/${id}`);
  await expect(rows(page)).toHaveText([/Har minunat/]);
  // Above the selected entry's parts, not as an avatar or a tooltip on every row.
  await rows(page).first().click();
  await expect(page.getByText("Added by Ioana")).toBeVisible();
  await expect(rows(page).first().locator("[data-entry]")).not.toHaveAttribute(
    "title",
  );
});

test("changes reach a visitor's open playlist, which is read-only", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ioana@example.com");
  const id = await playlistWith(page, "În direct", ["Început"]);

  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto(`/unu-unu/playlists/${id}`);
  await expect(rows(visitor)).toHaveText([/Început/]);
  await expect(
    visitor.getByRole("heading", { name: "În direct" }),
  ).toBeVisible();
  await expect(visitor.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await expect(visitor.getByRole("button", { name: "În direct" })).toHaveCount(
    0,
  );

  await api(page, "POST", `/api/communities/unu-unu/playlists/${id}/entries`, {
    kind: "divider",
    text: "Adăugat acum",
  });
  await expect(rows(visitor)).toHaveText([/Început/, /Adăugat acum/]);
  await visitor.context().close();
});

test("an editor sees the playlist read-only", async ({ page }) => {
  await logInAs(page, "ioana@example.com");
  const id = await playlistWith(page, "Doar citire", ["Ceva"]);
  await logInAs(page, "maria@example.com");
  await page.goto(`/unu-unu/playlists/${id}`);
  await expect(rows(page)).toHaveText([/Ceva/]);
  await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add text slide" }),
  ).toHaveCount(0);
});

test.describe("live activity", () => {
  // Tall enough that the team's live bar, sticky at the bottom, doesn't cover the rows
  // (it grows when other tests leave a song live and pages to show).
  test.use({ viewport: { width: 1280, height: 1100 } });
  test("members see who has the playlist open, and an entry moving while it's dragged", async ({
    page,
    browser,
  }) => {
    await logInAs(page, "ioana@example.com");
    const id = await playlistWith(page, "Împreună", ["Unu", "Doi", "Trei"]);
    const maria = await (await browser.newContext()).newPage();
    // Counts the rows that glide instead of jumping.
    await maria.addInitScript(() => {
      const counted = window as unknown as { glides: number };
      counted.glides = 0;
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (...args) {
        counted.glides += 1;
        return animate.apply(this, args);
      };
    });
    await logInAs(maria, "maria@example.com");
    await maria.goto(`/unu-unu/playlists/${id}`);
    await page.goto(`/unu-unu/playlists/${id}`);
    await expect(
      maria.getByLabel("Ioana has this playlist open"),
    ).toBeVisible();
    await expect(page.getByLabel("Maria has this playlist open")).toBeVisible();
    // The estimated end shows above the list; wait, so the rows don't move after.
    await expect(page.getByLabel("Estimated end")).toBeVisible();

    // Ioana holds "Trei" above "Unu" without dropping it.
    const from = await rows(page).nth(2).boundingBox();
    const to = await rows(page).first().boundingBox();
    if (!from || !to) throw new Error("no rows");
    const x = from.x + from.width / 2;
    await page.mouse.move(x, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(x, to.y + 2, { steps: 10 });
    // Emulated drags report drop targets only while the mouse moves.
    await expect(async () => {
      await page.mouse.move(x + Math.random() * 4, to.y + 2, { steps: 2 });
      await expect(rows(maria).first()).toContainText("Trei", {
        timeout: 1000,
      });
    }).toPass({ timeout: 10_000 });
    await expect(rows(maria).first()).toContainText("Ioana is moving it");
    // Maria's rows glide there, and the moving one is colored.
    expect(
      await maria.evaluate(
        () => (window as unknown as { glides: number }).glides,
      ),
    ).toBeGreaterThan(0);
    await expect(rows(maria).first().locator("[data-glide]")).toHaveClass(
      /bg-warning-soft/,
    );
    // On Ioana's screen the rows make room: the gap is as tall as the row.
    const gap = await page.locator("[data-drop-target]").boundingBox();
    expect(gap?.height).toBeGreaterThan(from.height / 2);

    await page.mouse.up();
    await expect(rows(maria)).toHaveText([/Trei/, /Unu/, /Doi/]);
    await expect(maria.getByText("Ioana is moving it")).toHaveCount(0);

    // Leaving the playlist takes her off.
    await page.goto("/unu-unu/playlists");
    await expect(maria.getByLabel("Ioana has this playlist open")).toHaveCount(
      0,
    );
    await maria.context().close();
  });
});

test("? lists the keyboard shortcuts, except while typing", async ({
  page,
}) => {
  await logInAs(page, "ioana@example.com");
  await openSteadyPage(page);
  const search = page.getByRole("combobox", { name: "Search songs" });
  await search.fill("?");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await search.fill("");
  await search.blur();

  await page.keyboard.press("?");
  const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
  await expect(dialog).toContainText("Send the selected entry live");
  await expect(dialog).toContainText("Blank the screens");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test.describe("sharing", () => {
  test.use({ permissions: ["clipboard-read", "clipboard-write"] });
  test("anyone copies a short link to a playlist, and it opens the playlist", async ({
    page,
  }) => {
    await openSteadyPage(page);
    await page.getByRole("button", { name: "Copy short link" }).click();
    await expect(
      page.getByRole("button", { name: "Link copied" }),
    ).toBeVisible();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/^http:\/\/[^/]+\/[2-9a-zA-Z]{6}$/);
    await page.goto("/unu-unu/playlists");
    await page.goto(link);
    await expect(page).toHaveURL("/unu-unu/playlists/steady");
  });
});

test.describe("on a phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  test.beforeEach(({ page }) => logInAs(page, "ioana@example.com"));

  test("each row's ⋯ button opens its actions", async ({ page }) => {
    const id = await playlistWith(page, "Meniu", ["Unu", "Doi"]);
    await page.goto(`/unu-unu/playlists/${id}`);
    await expect(rows(page)).toHaveText([/Unu/, /Doi/]);
    await expect(page.getByRole("button", { name: "Remove" })).toHaveCount(0);

    await page.getByRole("button", { name: "Actions: Doi" }).tap();
    await expect(page.getByRole("menuitem", { name: "Move up" })).toBeVisible();
    await page.getByRole("menuitem", { name: "Move up" }).tap();
    await expect(rows(page)).toHaveText([/Doi/, /Unu/]);
    await page.getByRole("button", { name: "Actions: Unu" }).tap();
    await page.getByRole("menuitem", { name: "Remove" }).tap();
    await expect(rows(page)).toHaveText([/Doi/]);
  });
});
