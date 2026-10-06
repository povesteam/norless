import { expect, logInAs, test } from "../helpers";
import { newPlaylist, rows, slides } from "./playlist";

test.describe("on a laptop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("Go live or a double-click sends a song live, Page Down moves on, Blank and Show again", async ({
    page,
  }) => {
    await logInAs(page, "ioana@example.com");
    const id = await newPlaylist(page, "Live clasic");
    await page.goto(`/clasic/playlists/${id}`);

    await rows(page).filter({ hasText: "Lumina lumii" }).click();
    // Live takes Go live's place without moving the title or the edit button.
    const heading = page.getByRole("heading", { name: /Lumina lumii/ });
    const headingBox = await heading.boundingBox();
    await page.getByRole("button", { name: "Go live" }).click();
    await expect(slides(page).getByRole("button").first()).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(page.getByRole("button", { name: "Go live" })).toHaveCount(0);
    expect(await heading.boundingBox()).toEqual(headingBox);
    await expect(page.getByRole("button", { name: "Blank" })).toBeVisible();
    // A double-click on another entry sends it live too, framed without moving.
    const doar = rows(page).filter({ hasText: "Doar harul" });
    const before = await doar.locator("[data-entry]").boundingBox();
    await doar.dblclick();
    await expect(doar).toContainText("Live");
    await expect(doar.locator("[data-glide]")).toHaveClass(/border-live/);
    expect(await doar.locator("[data-entry]").boundingBox()).toEqual(before);
    await rows(page).filter({ hasText: "Lumina lumii" }).dblclick();
    await expect(rows(page).filter({ hasText: "Lumina lumii" })).toContainText(
      "Live",
    );

    // Four slides (1, R, 2, R), then past the divider to the next song.
    await page.mouse.click(5, 5);
    for (let i = 0; i < 4; i++) await page.keyboard.press("PageDown");
    await expect(
      page.getByRole("heading", { name: "Doar harul Tău" }),
    ).toBeVisible();
    await expect(slides(page).getByRole("button").first()).toHaveAttribute(
      "aria-current",
      "true",
    );

    // A slide click sends that slide.
    await slides(page).getByRole("button").nth(1).click();
    await expect(slides(page).getByRole("button").nth(1)).toHaveAttribute(
      "aria-current",
      "true",
    );

    // Blank keeps the bar and the slide; Show again brings it back; Escape only blanks.
    // The button keeps its size when its label changes.
    const blankBox = await page
      .getByRole("button", { name: "Blank" })
      .boundingBox();
    await page.getByRole("button", { name: "Blank" }).click();
    await expect(
      page.getByRole("button", { name: "Show again" }),
    ).toBeVisible();
    expect(
      await page.getByRole("button", { name: "Show again" }).boundingBox(),
    ).toEqual(blankBox);
    await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
    await page.getByRole("button", { name: "Show again" }).click();
    await expect(slides(page).getByRole("button").nth(1)).toHaveAttribute(
      "aria-current",
      "true",
    );
    await page.mouse.click(5, 5);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Show again" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Show again" }),
    ).toBeVisible();
  });

  test("the live slide has a Live tag and a vivid frame, Blank's label sits by its icon, the menu names who's online", async ({
    page,
  }) => {
    await logInAs(page, "ioana@example.com");
    const id = await newPlaylist(page, "Semne");
    await page.goto(`/clasic/playlists/${id}`);
    await rows(page).filter({ hasText: "Lumina lumii" }).dblclick();
    const cards = slides(page).getByRole("listitem");
    await expect(
      cards.first().getByText("Live", { exact: true }),
    ).toBeVisible();
    await expect(cards.nth(1).getByText("Live", { exact: true })).toBeHidden();

    // A navy primary color still gives a bright orange live frame, not brown.
    const rgb = await cards
      .first()
      .getByRole("button")
      .evaluate((card) => {
        document.documentElement.style.setProperty("--accent", "#2d5a8a");
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) return [];
        context.fillStyle = getComputedStyle(card).borderTopColor;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)];
      });
    const [r = 0, g = 0, b = 0] = rgb;
    expect(r).toBeGreaterThan(180);
    expect(g).toBeGreaterThan(60);
    expect(g).toBeLessThan(160);
    expect(b).toBeLessThan(80);

    const blank = page.getByRole("button", { name: "Blank" });
    const icon = await blank.locator("svg").boundingBox();
    const label = await blank.getByText("Blank", { exact: true }).boundingBox();
    expect(
      (label?.x ?? 0) - ((icon?.x ?? 0) + (icon?.width ?? 0)),
    ).toBeLessThan(12);

    await page.getByRole("button", { name: "Menu" }).click();
    await expect(
      page
        .getByRole("dialog", { name: "Menu" })
        .getByRole("heading", { name: "Online" }),
    ).toBeVisible();
  });

  test("the menu and the bottom bar show an icon on each action", async ({
    page,
  }) => {
    await logInAs(page, "ana@example.com");
    const id = await newPlaylist(page, "Iconițe");
    await page.goto(`/clasic/playlists/${id}`);
    // The magnifier in the search box.
    await expect(
      page
        .getByRole("combobox", { name: "Search songs" })
        .locator(
          "xpath=ancestor::div[contains(@class, 'relative')][1]//*[name()='svg']",
        ),
    ).toHaveCount(1);
    await rows(page).filter({ hasText: "Lumina lumii" }).dblclick();
    // Lucide's icons; Projector RO also has its flag.
    for (const name of ["Blank", "Previous", "Next", "Projector RO"])
      await expect(
        page.getByRole("button", { name }).locator("svg.lucide"),
      ).toHaveCount(1);
    await page.getByRole("button", { name: "Menu" }).locator("svg").click();
    const menu = page.getByRole("dialog", { name: "Menu" });
    await expect(
      menu.getByRole("button", { name: "Create new song" }).locator("svg"),
    ).toHaveCount(1);
    for (const name of ["Settings", "Privacy", "About"])
      await expect(menu.getByRole("link", { name }).locator("svg")).toHaveCount(
        1,
      );
  });

  test("Project opens full screen on the projector, asking the browser once", async ({
    page,
  }) => {
    // A laptop with a projector, in a browser that asks before pages place windows.
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      w.asked = 0;
      let state = "prompt";
      const query = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = (async (
        descriptor: PermissionDescriptor,
      ) =>
        descriptor.name === ("window-management" as PermissionName)
          ? ({ state } as PermissionStatus)
          : query(descriptor)) as typeof navigator.permissions.query;
      w.getScreenDetails = async () => {
        if (state === "prompt") w.asked = (w.asked as number) + 1;
        state = "granted";
        return {
          screens: [
            {
              label: "Built-in",
              isPrimary: true,
              availLeft: 0,
              availTop: 0,
              availWidth: 1440,
              availHeight: 900,
            },
            {
              label: "Projector",
              isPrimary: false,
              availLeft: 1440,
              availTop: 0,
              availWidth: 1920,
              availHeight: 1080,
            },
          ],
        };
      };
      w.opened = [];
      w.open = (url: string, _target: string, features: string) => {
        (w.opened as string[]).push(`${url} ${features}`);
        return null;
      };
    });
    await logInAs(page, "ioana@example.com");
    await page.goto("/clasic/playlists/classic-sunday");
    const opened = () =>
      page.evaluate(() => (window as unknown as { opened: string[] }).opened);
    await page.getByRole("button", { name: "Projector RO" }).click();
    await expect.poll(opened).toHaveLength(1);
    expect((await opened())[0]).toMatch(
      /\/clasic\/projector\/ro popup,fullscreen,left=1440,top=0,width=1920/,
    );
    await page.getByRole("button", { name: "Projector UA" }).click();
    await expect.poll(opened).toHaveLength(2);
    expect(
      await page.evaluate(() => (window as unknown as { asked: number }).asked),
    ).toBe(1);
  });

  test("Project opens one projector window per language, whose keys drive the slides", async ({
    page,
    context,
  }) => {
    await logInAs(page, "ioana@example.com");
    const id = await newPlaylist(page, "Fereastra");
    await page.goto(`/clasic/playlists/${id}`);
    await rows(page).filter({ hasText: "Lumina lumii" }).click();
    await page.getByRole("button", { name: "Go live" }).click();
    const popup = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Projector UA" }).click();
    const projector = await popup;
    await expect(projector).toHaveURL(/\/clasic\/projector\/uk$/);
    // Again: the same window comes forward, no second one.
    await page.getByRole("button", { name: "Projector UA" }).click();
    await page.waitForTimeout(300);
    expect(context.pages()).toHaveLength(2);
    // A clicker on the projector's window moves the slides too.
    await projector.keyboard.press("PageDown");
    await expect(slides(page).getByRole("button").nth(1)).toHaveAttribute(
      "aria-current",
      "true",
    );
  });
});
