import { devices } from "@playwright/test";
import { api, expect, logInAs, openFromBar, test } from "./helpers";

test.describe("installed or not", () => {
  test.use({ serviceWorkers: "allow" });
  test("after the first visit the app frame loads offline, and says so", async ({
    page,
    context,
  }) => {
    await logInAs(page, "maria@example.com");
    await page.goto("/unu-unu/playlists/steady");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("status")).toContainText(
      /offline|reconnecting/i,
    );
    await context.setOffline(false);
  });

  test("a visitor's phone following along doesn't download the offline cache", async ({
    browser,
  }) => {
    const phone = await (await browser.newContext()).newPage();
    await phone.goto("/urmarim/follow");
    await expect(phone.getByRole("radio", { name: "RO" })).toBeVisible();
    await phone.waitForLoadState("networkidle");
    expect(
      await phone.evaluate(() =>
        navigator.serviceWorker.getRegistration().then(Boolean),
      ),
    ).toBe(false);
  });
});

test("built files are kept for good, the page and its worker asked for again", async ({
  page,
}) => {
  const html = await (await page.request.get("/")).text();
  const script = /\/assets\/[^"]+\.js/.exec(html)?.[0] ?? "no script";
  expect((await page.request.get(script)).headers()["cache-control"]).toBe(
    "public, max-age=31536000, immutable",
  );
  for (const path of ["/", "/sw.js"])
    expect((await page.request.get(path)).headers()["cache-control"]).toBe(
      "public, max-age=0",
    );
});

test("the icons: a tile installed, the ribbon alone in the tab and on the splash", async ({
  page,
}) => {
  const { icons } = (await (
    await page.request.get("/manifest.webmanifest")
  ).json()) as { icons: { src: string; purpose?: string }[] };
  // Plain (the splash and the taskbar), maskable (home screens) and monochrome (themed).
  expect(new Set(icons.map((icon) => icon.purpose ?? "any"))).toEqual(
    new Set(["any", "maskable", "monochrome"]),
  );
  for (const { src } of icons) {
    const file = await page.request.get(src);
    expect(file.ok()).toBe(true);
    expect(file.headers()["content-type"]).toContain("image/png");
  }
  await page.goto("/");
  await expect(
    page.locator('link[rel="icon"][type="image/svg+xml"]'),
  ).toHaveAttribute("href", "/favicon.svg");
  expect((await page.request.get("/favicon.svg")).ok()).toBe(true);
});

test("the start page opens the community this device opened last", async ({
  page,
}) => {
  const manifest = await page.request.get("/manifest.webmanifest");
  expect(await manifest.json()).toMatchObject({
    // The app is the root, whatever page it was installed from.
    id: "/",
    start_url: "/",
    display: "standalone",
    // A dark splash screen, so opening it in a dark room doesn't flash white.
    background_color: "#060607",
  });

  // Two communities and none opened yet: the list.
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Communities" })
    .getByRole("link", { name: "Unu-Unu" })
    .click();
  // The community, or its follow-along page while another test has a song live; either
  // way the device remembers it once it has loaded.
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("norless:community")))
    .toBe("unu-unu");
  await page.goto("/");
  await expect(page).toHaveURL(/\/unu-unu/);
});

test.describe("on an iPhone", () => {
  const { viewport, userAgent, isMobile, hasTouch } = devices["iPhone 13"];
  test.use({ viewport, userAgent, isMobile, hasTouch });
  test("Safari users see how to add it to the home screen, once", async ({
    page,
  }) => {
    await page.goto("/unu-unu/playlists/steady");
    const suggestion = page.getByRole("region", { name: "Install Norless" });
    await expect(suggestion).toContainText("Share, then Add to Home Screen");
    await suggestion.getByRole("button", { name: "OK" }).click();
    await page.reload();
    await expect(page.getByRole("grid", { name: "Entries" })).toBeVisible();
    await expect(suggestion).toHaveCount(0);
  });
});

test("the phone's bars take the page's own background, in light and dark", async ({
  page,
}) => {
  // A stage view first, which paints the bars black, then the app's pages.
  await page.goto("/unu-unu/vocalists");
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto("/unu-unu/playlists");
    await expect(
      page.getByRole("heading", { name: "Playlists" }),
    ).toBeVisible();
    const [bar, background] = await page.evaluate(() => [
      document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
        ?.content,
      getComputedStyle(document.body).backgroundColor,
    ]);
    expect(bar).toBe(background);
  }
});

test("before its styles load, the page has the system's light or dark background", async ({
  page,
}) => {
  await page.route("**/*.css", (route) => route.abort());
  for (const [colorScheme, color] of [
    ["dark", "rgb(6, 6, 7)"],
    ["light", "rgb(245, 245, 245)"],
  ] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto("/about");
    expect(
      await page.evaluate(
        () => getComputedStyle(document.documentElement).backgroundColor,
      ),
    ).toBe(color);
  }
  // Styled again for the accessibility check at the end.
  await page.unroute("**/*.css");
  await page.reload();
});

test.describe("offline on one laptop", () => {
  test.use({ serviceWorkers: "allow" });
  test("a laptop that keeps the songs projects them without internet, from a playlist made there", async ({
    page,
    context,
  }) => {
    // Owners switch it on (it arrives off), then Ioana's laptop keeps the songs.
    await logInAs(page, "ana@example.com");
    const { body } = await api(page, "GET", "/api/communities/unu-unu");
    const switches = (body as { switches?: Record<string, unknown> }).switches;
    await api(page, "PUT", "/api/communities/unu-unu/switches", {
      switches: { ...switches, offline: true },
    });
    await logInAs(page, "ioana@example.com");
    await page.goto("/unu-unu/playlists/steady");
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.getByRole("button", { name: "This device" }).click();
    await page.getByText("Keep songs for offline").click();
    await expect(page.getByText(/songs kept, at/)).toBeVisible();

    // No internet: switching off asks first, since the songs couldn't come back.
    await context.setOffline(true);
    await expect(page.getByRole("status")).toContainText(
      /offline|reconnecting/i,
    );
    const asked = page.waitForEvent("dialog").then(async (dialog) => {
      expect(dialog.message()).toContain("There's no internet");
      await dialog.dismiss();
    });
    await page.getByText("Keep songs for offline").click();
    await asked;
    await expect(
      page.getByRole("switch", { name: "Keep songs for offline" }),
    ).toBeChecked();

    // The frame says so and opens what was kept.
    await page.reload();
    await page
      .getByRole("link", { name: "Open what this device kept" })
      .click();
    await expect(page.getByRole("heading", { name: "Offline" })).toBeVisible();
    // A playlist for the campfire, with a song found by its words.
    await page.getByLabel("New playlist").fill("Foc de tabără");
    await page.getByRole("button", { name: "Create the playlist" }).click();
    await page.getByLabel("Add a song").fill("har minunat");
    await page
      .getByRole("button", { name: /Har minunat/ })
      .first()
      .click();
    const projector = page.waitForEvent("popup");
    await page
      .getByRole("region", { name: "Foc de tabără" })
      .locator("ol")
      .getByRole("button", { name: /^1 Har minunat/ })
      .click();
    const screen = await projector;
    await expect(screen.locator("body")).toContainText(/Har|minunat/i);
    // The clicker moves it, from either window.
    await page.keyboard.press("PageDown");
    await expect(screen.locator("header")).toContainText("#2/");
    await context.setOffline(false);
  });
});

test("a page opened before a deploy reloads when a page's code is gone", async ({
  page,
}) => {
  let documents = 0;
  page.on("request", (request) => {
    if (request.resourceType() === "document") documents++;
  });
  await logInAs(page, "maria@example.com");
  await page.goto("/unu-unu/playlists");
  const opened = documents;
  // The deploy replaced the statistics page's file: gone until the page loads again.
  let missing = 0;
  await page.route(/\/assets\/Statistics-[^/]+\.js$/, (route) => {
    if (documents > opened) return route.continue();
    missing++;
    return route.fulfill({ status: 404 });
  });
  await openFromBar(page, "Statistics");
  await expect(
    page.getByRole("heading", { name: "Most played", level: 3 }),
  ).toBeVisible();
  expect(missing).toBeGreaterThan(0);
});
