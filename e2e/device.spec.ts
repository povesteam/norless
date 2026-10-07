import { devices, expect, type Page, test } from "@playwright/test";
import { api, logInAs, openSteadyPage } from "./helpers";

/** The device type the user menu shows as chosen. */
async function deviceType(page: Page) {
  await page.goto("/unu-unu/playlists");
  // Her name, and on a phone who else is online.
  const account = page.getByRole("button", { name: /^Ana(,|$)/ });
  await account.click();
  return page.getByRole("menuitemradio", { checked: true }).textContent();
}

/** About and Privacy as rows a finger hits, 44 pixels high. */
async function expectRows(page: Page) {
  const about = await page
    .getByRole("link", { name: "About Norless" })
    .boundingBox();
  const privacy = await page
    .getByRole("link", { name: "Privacy" })
    .boundingBox();
  expect(about?.height).toBeGreaterThanOrEqual(44);
  expect(privacy?.height).toBeGreaterThanOrEqual(44);
}

test.describe("on a phone", () => {
  // A phone's size, touch and screen, in this project's Chromium.
  const { viewport, deviceScaleFactor, isMobile, hasTouch, userAgent } =
    devices["Pixel 7"];
  test.use({ viewport, deviceScaleFactor, isMobile, hasTouch, userAgent });
  test("is a phone", async ({ page }) => {
    await logInAs(page, "ana@example.com");
    expect(await deviceType(page)).toBe("Phone");
  });
  test("one bar at the top, with the pages and account in a burger menu", async ({
    page,
  }) => {
    await logInAs(page, "ana@example.com");
    await page.goto("/unu-unu/playlists/steady");
    const nav = page.getByRole("navigation", { name: "Unu-Unu" });
    await expect(nav).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Norless" })).toHaveCount(0);
    const menu = page.getByRole("button", { name: "Menu" });
    expect((await menu.boundingBox())?.y).toBeLessThan(60);
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    // Her photo, named with who else is online.
    await expect(page.getByRole("button", { name: /^Ana(,|$)/ })).toBeVisible();
    await nav.getByRole("link", { name: "Playlists" }).click();
    await expect(page).toHaveURL("/unu-unu/playlists");
    await expect(nav).toHaveCount(0);
  });
  test("About and Privacy are in the menu, not at the bottom of the page", async ({
    page,
  }) => {
    await page.goto("/unu-unu/playlists/steady");
    await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
    await expect(page.getByRole("contentinfo")).toHaveCount(0);
    await page.getByRole("button", { name: "Menu" }).click();
    await expect(
      page.getByRole("link", { name: "About Norless" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Privacy" })).toBeVisible();
    await expectRows(page);
    // Classic's menu too.
    await page.goto("/clasic");
    await page.getByRole("button", { name: "Menu" }).click();
    await expectRows(page);
  });
  test("pages fit the phone's width, so it opens without zooming", async ({
    page,
  }) => {
    // An editor sees the most buttons on a song.
    await logInAs(page, "ana@example.com");
    for (const path of [
      "/unu-unu/songs/grace",
      "/unu-unu/songs/grace/edit",
      "/unu-unu/songs/grace/chords",
      "/unu-unu/playlists",
      "/unu-unu/playlists/steady",
      "/unu-unu/recordings",
      "/unu-unu/settings/theme",
      "/unu-unu/settings/schedule",
      "/unu-unu/settings/screens",
      "/unu-unu/settings/members",
      "/account",
    ]) {
      await page.goto(path);
      // Settled: loaded, and nothing loading still shown.
      await page.waitForLoadState("networkidle");
      // A wider page makes the phone's browser zoom out to fit it.
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(viewport.width);
      // Nor do the members' rows scroll sideways inside it.
      if (path.endsWith("/members"))
        expect(
          await page.evaluate(() =>
            [...document.querySelectorAll("table")].map(
              (table) =>
                table.scrollWidth <= (table.parentElement?.clientWidth ?? 0),
            ),
          ),
        ).not.toContain(false);
    }
  });
  test("the playlist doesn't move while who's online and its end time arrive, or someone opens it", async ({
    page,
    browser,
  }) => {
    await logInAs(page, "ana@example.com");
    // Both held back until the playlist shows.
    let release = () => {};
    const released = new Promise<void>((resolve) => (release = resolve));
    await page.routeWebSocket("/api/live", async (ws) => {
      await released;
      ws.connectToServer();
    });
    await page.route("**/times", async (route) => {
      await released;
      await route.continue();
    });
    await page.goto("/unu-unu/playlists/steady");
    const search = page.getByRole("combobox");
    await expect(search).toBeVisible();
    const before = await search.boundingBox();
    release();
    await expect(page.getByLabel("Estimated end")).toBeVisible();
    // On a phone, who comes online stacks under the photo in the bar.
    const maria = await (await browser.newContext()).newPage();
    await logInAs(maria, "maria@example.com");
    await maria.goto("/unu-unu/playlists/steady");
    await expect(
      page.getByRole("button", { name: /^Ana, and \d+ others? online$/ }),
    ).toBeVisible();
    expect(await search.boundingBox()).toEqual(before);
    await maria.context().close();
  });
  test("opening the app on a slow network shows one placeholder, under the community's bar", async ({
    page,
    context,
  }) => {
    await logInAs(page, "ana@example.com");
    // The device remembers the community, so the app opens its newest playlist.
    await openSteadyPage(page);
    await page.addInitScript(() => {
      const seen: string[] = [];
      (window as unknown as { seen: string[] }).seen = seen;
      const tick = () => {
        // A placeholder that's there to see: index.html's fades in after 300 ms.
        const loading = [
          ...document.querySelectorAll('[aria-label="Loading…"]'),
        ].some((element) => getComputedStyle(element).opacity !== "0");
        const state = document.querySelector('[role="combobox"]')
          ? "playlist"
          : loading
            ? "placeholder"
            : "nothing";
        // The laptop's header would show while the community loads.
        const header = document.querySelector("h1")?.textContent ?? "";
        const now = `${state}${header ? ` ${header}` : ""}`;
        if (seen.at(-1) !== now) seen.push(now);
        if (state !== "playlist") requestAnimationFrame(tick);
      };
      tick();
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 400,
      downloadThroughput: 1_000_000,
      uploadThroughput: 500_000,
    });
    await page.goto("/");
    await expect(page.getByRole("combobox")).toBeVisible({ timeout: 10_000 });
    const seen = await page.evaluate(
      () => (window as unknown as { seen: string[] }).seen,
    );
    // No header but the community's bar, and a placeholder, once there, stays.
    expect(seen.filter((state) => state.includes(" "))).toEqual([]);
    expect(seen.slice(seen.indexOf("placeholder"))).toEqual([
      "placeholder",
      "playlist",
    ]);
  });

  test("an archived playlist's notice wraps under the header, outside its sideways row", async ({
    page,
  }) => {
    await logInAs(page, "ana@example.com");
    const base = "/api/communities/unu-unu/playlists";
    const { body } = await api(page, "POST", base, { title: "Arhivată" });
    const id = (body as { id: string }).id;
    await api(page, "PUT", `${base}/${id}/archived`, { archived: true });
    await page.goto(`/unu-unu/playlists/${id}`);
    const restore = page.getByRole("button", { name: "Restore" });
    await expect(restore).toBeInViewport();
    expect(
      await restore.evaluate((el) => {
        for (let p = el.parentElement; p; p = p.parentElement)
          if (getComputedStyle(p).overflowX === "auto") return false;
        return true;
      }),
    ).toBe(true);
  });

  test("a singer goes from the playlist to Vocals and back in one tap each", async ({
    page,
  }) => {
    await logInAs(page, "sorin@example.com");
    await api(page, "PUT", "/api/me/preferences", {
      musician: { instruments: ["vocals"], main: "vocals" },
    });
    await page.goto("/unu-unu/playlists/steady");
    await page.getByRole("link", { name: "Vocals" }).click();
    await expect(page).toHaveURL("/unu-unu/vocalists");
    const back = page.getByRole("link", { name: "The playlist" });
    // As big as the toolbar's other buttons.
    expect((await back.boundingBox())?.height).toBeGreaterThanOrEqual(32);
    await back.click();
    await expect(page).toHaveURL(/\/unu-unu(\/playlists\/|\/follow|$)/);
  });

  test("the menu is a page of its own, and the page behind it holds still", async ({
    page,
  }) => {
    await page.goto("/unu-unu/playlists/steady");
    await page.getByRole("button", { name: "Menu" }).click();
    const menu = await page.locator("#phone-menu").boundingBox();
    expect((menu?.y ?? 0) + (menu?.height ?? 0)).toBe(viewport.height);
    expect(menu?.width).toBe(viewport.width);
    const held = () =>
      page.evaluate(() => document.documentElement.style.overflow);
    expect(await held()).toBe("hidden");
    // Classic's menu fills the screen too.
    await page.goto("/clasic");
    await page.getByRole("button", { name: "Menu" }).click();
    expect((await page.getByRole("dialog").boundingBox())?.width).toBe(
      viewport.width,
    );
    expect(await held()).toBe("hidden");
  });

  test("who else is online stacks under the photo, which opens the menu as a page with them on top", async ({
    page,
    browser,
  }) => {
    const other = await (await browser.newContext()).newPage();
    await logInAs(other, "maria@example.com");
    await other.goto("/unu-unu/playlists/steady");
    await logInAs(page, "ioana@example.com");
    await page.goto("/unu-unu/playlists/steady");
    const photo = page.getByRole("button", {
      name: /^Ioana, and \d+ others? online$/,
    });
    await photo.click();
    const online = page.getByRole("region", { name: "Online" });
    await expect(online).toContainText("Maria");
    await expect(online).not.toContainText("Ioana");
    // Once it has opened (it grows from the photo).
    await expect
      .poll(() => page.locator('[data-slot="dropdown-popover"]').boundingBox())
      .toMatchObject({ x: 0, width: viewport.width });
    // No row of avatars above the search box on a phone.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("group", { name: "Online" })).toHaveCount(0);
  });

  // Android's back button or gesture goes back in the history.
  test("back from a song's slides shows the playlist, and closes the menu, without leaving the page", async ({
    page,
  }) => {
    const playlist = "/clasic/playlists/classic-sunday";
    await page.goto(playlist);
    const entries = page.getByRole("grid", { name: "Entries" });
    await entries.getByRole("row").first().click();
    await expect(entries).toBeHidden();
    // The slide cards mark their parts faintly in the corner (1, 2, R).
    await expect(page.locator("[data-mark]").first()).toBeVisible();
    await page.goBack();
    await expect(entries).toBeVisible();
    await expect(page).toHaveURL(playlist);

    await page.getByRole("button", { name: "Menu" }).click();
    const menu = page.getByRole("dialog");
    await expect(menu).toBeVisible();
    await page.goBack();
    await expect(menu).toHaveCount(0);
    await expect(page).toHaveURL(playlist);
  });

  test("back closes the community's phone menu", async ({ page }) => {
    const playlist = "/unu-unu/playlists/steady";
    await page.goto(playlist);
    const menu = page.getByRole("button", { name: "Menu" });
    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await page.goBack();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(page).toHaveURL(playlist);
  });

  test("in the installed app, back on its first page asks before closing it", async ({
    page,
  }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "standalone", { value: true }),
    );
    const playlist = "/unu-unu/playlists/steady";
    await page.goto(playlist);
    await expect(page.getByRole("button", { name: "Menu" })).toBeVisible();
    await page.goBack();
    await expect(page.getByText("Press back again to close")).toBeVisible();
    await expect(page).toHaveURL(playlist);
    // It goes after 2 seconds, and the guard is back.
    await expect(page.getByText("Press back again to close")).toHaveCount(0, {
      timeout: 4000,
    });
  });
});

test.describe("on a tablet", () => {
  test.use({
    viewport: { width: 1024, height: 768 },
    hasTouch: true,
    isMobile: true,
  });
  test("is a tablet", async ({ page }) => {
    await logInAs(page, "ana@example.com");
    expect(await deviceType(page)).toBe("Tablet");
  });

  test("shows the playlist beside the live panel", async ({ page }) => {
    await logInAs(page, "ioana@example.com");
    await openSteadyPage(page);
    const list = page.getByRole("grid", { name: "Entries" });
    const next = page.getByRole("button", { name: "Next" });
    await expect(list.getByRole("row").first()).toBeInViewport();
    await expect(next).toBeInViewport();
    const left = (await list.boundingBox()) ?? { x: 0, width: Infinity };
    const right = (await next.boundingBox()) ?? { x: 0 };
    expect(right.x).toBeGreaterThanOrEqual(left.x + left.width);
  });
});

test("a laptop is a laptop, and a member can correct it for the device", async ({
  page,
}) => {
  await logInAs(page, "ana@example.com");
  expect(await deviceType(page)).toBe("Laptop");

  await page.getByRole("menuitemradio", { name: "Tablet" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Ana", exact: true }).click();
  await expect(page.getByRole("menuitemradio", { checked: true })).toHaveText(
    "Tablet",
  );
  // Choosing it didn't log out.
  await expect(
    page.getByRole("menuitem", { name: "My account" }),
  ).toBeVisible();
});

test("musicians and vocalists are dark unless the member chooses light, and keep a text size", async ({
  page,
}) => {
  // The system is dark, so a light layout is a light area inside a dark page.
  await page.emulateMedia({ colorScheme: "dark" });
  await logInAs(page, "ioana@example.com");
  await page.goto("/unu-unu/vocalists");
  // The layout's root: the toolbar's parent.
  const view = page
    .getByRole("link", { name: "The playlist" })
    .locator("xpath=ancestor::header/..");
  const content = view.locator("> header + div");
  await expect(view).toHaveClass(/\bdark\b/);
  // One panel for the colors and the text size; it stays open meanwhile.
  const panel = page.getByRole("dialog", { name: "Display" });
  const press = (name: string) =>
    panel
      .getByRole("radio", { name })
      .or(panel.getByRole("button", { name }))
      .click();
  await page.getByRole("button", { name: "Display" }).click();
  await press("Light");
  await expect(view).toHaveClass(/\blight\b/);
  await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  await press("Larger text");
  await press("Larger text");
  await expect(content).toHaveCSS("zoom", "1.2");
  await expect(panel.getByText("120%")).toBeVisible();
  await press("Smaller text");
  await expect(content).toHaveCSS("zoom", "1.1");
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();

  // Kept for this member's laptops, on the musicians layouts too.
  await page.goto("/unu-unu/musicians");
  await expect(view).toHaveClass(/\blight\b/);
  await expect(content).toHaveCSS("zoom", "1.1");
  await page.getByRole("button", { name: "Display" }).click();
  await press("Dark");
  await press("Smaller text");
  await expect(view).toHaveClass(/\bdark\b/);
  await expect(content).toHaveCSS("zoom", "1");
});

test.describe("feels like an app on a phone", () => {
  const { viewport, isMobile, hasTouch, userAgent } = devices["Pixel 7"];
  test.use({ viewport, isMobile, hasTouch, userAgent });
  test("no page bounce or input zoom, 44-point targets, and only lyrics selectable", async ({
    page,
  }) => {
    await page.goto("/unu-unu/playlists/steady");
    const style = (selector: string, property: string) =>
      page
        .locator(selector)
        .first()
        .evaluate(
          (element, name) => getComputedStyle(element).getPropertyValue(name),
          property,
        );
    expect(await style("html", "overscroll-behavior-y")).toBe("none");
    expect(
      parseFloat(await style("input", "font-size")),
    ).toBeGreaterThanOrEqual(16);
    const button = page.getByRole("button", { name: "Copy short link" });
    expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect(await style("button", "user-select")).toBe("none");
    await page.goto("/unu-unu/songs/grace");
    const lyrics = page.getByText("grace how sweet");
    expect(
      await lyrics.evaluate((element) => getComputedStyle(element).userSelect),
    ).not.toBe("none");
  });
});
