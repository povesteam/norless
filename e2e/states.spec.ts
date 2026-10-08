import { expect, type Page, test } from "@playwright/test";
import { api, createSong, logInAs } from "./helpers";

test("an empty library says so, and offers editors the first song", async ({
  page,
}) => {
  await page.goto("/biserica-noua");
  await expect(page.getByText("No songs yet")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Add the first song" }),
  ).toHaveCount(0);

  await logInAs(page, "ana@example.com");
  await page.goto("/biserica-noua");
  await expect(page.getByText("No songs yet")).toBeVisible();
  await page.getByRole("link", { name: "Add the first song" }).click();
  await expect(page).toHaveURL("/biserica-noua/songs/new");
});

test("while the app's code loads, the page shows placeholders; a projector stays blank", async ({
  page,
}) => {
  // What shows, frame by frame, until a playlist's link does.
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { seen: string[] }).seen = seen;
    const tick = () => {
      const loading = [
        ...document.querySelectorAll('[aria-label="Loading…"]'),
      ].some((element) => getComputedStyle(element).opacity !== "0");
      const state = document.querySelector('a[href*="/playlists/"]')
        ? "playlists"
        : loading
          ? "placeholder"
          : "nothing";
      if (seen.at(-1) !== state) seen.push(state);
      if (state !== "playlists") requestAnimationFrame(tick);
    };
    tick();
  });
  // The app's scripts take a while, as on slow 4G.
  await page.route("**/assets/*.js", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await route.continue();
  });
  await page.goto("/unu-unu/playlists");
  const shell = page.locator("#shell");
  await expect(shell).toHaveCSS("opacity", "1");
  await expect(shell).toHaveAttribute("aria-label", "Loading…");
  // The app takes over, with no blank moment between.
  await expect(page.locator('a[href*="/playlists/"]').first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(shell).toHaveCount(0);
  const seen = await page.evaluate(
    () => (window as unknown as { seen: string[] }).seen,
  );
  expect(seen).toEqual(["nothing", "placeholder", "playlists"]);

  await page.goto("/unu-unu/projector/ro");
  await expect(page.locator("#shell")).toHaveCount(0);
});

test("the page's placeholder sits where the app's does, on every device", async ({
  browser,
}) => {
  const sizes = [
    { width: 390, height: 844, touch: true },
    { width: 1024, height: 768, touch: true },
    { width: 1440, height: 900, touch: false },
  ];
  for (const { width, height, touch } of sizes) {
    const context = await browser.newContext({
      viewport: { width, height },
      hasTouch: touch,
      isMobile: touch,
    });
    const bars = (page: Page, selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((element) =>
          [...element.children].map((bar) => {
            const { x, y, width, height } = bar.getBoundingClientRect();
            return [x, y, width, height].map(Math.round);
          }),
        );
    // The page alone, its scripts never coming.
    const shell = await context.newPage();
    await shell.route("**/assets/*.js", (route) => route.abort());
    await shell.goto("/unu-unu/playlists");
    await expect(shell.locator("#shell")).toHaveCSS("opacity", "1");
    // The app, waiting for the community.
    const app = await context.newPage();
    await app.route(/\/api\/communities\//, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.continue();
    });
    await app.goto("/unu-unu/playlists");
    const placeholder = '#root [role="status"][aria-label="Loading…"]';
    await expect(app.locator(placeholder).first()).toBeVisible();
    expect(await bars(shell, "#shell")).toEqual(await bars(app, placeholder));
    await context.close();
  }
});

test("screens and stage views are dark from the first paint, in a light room's system too", async ({
  browser,
}) => {
  const context = await browser.newContext({ colorScheme: "light" });
  const page = await context.newPage();
  await page.route("**/assets/*.js", (route) => route.abort());
  const html = page.locator("html");
  for (const path of ["/unu-unu/projector/ro", "/unu-unu/stage", "/s/any"]) {
    await page.goto(path);
    await expect(html).toHaveCSS("background-color", "rgb(0, 0, 0)");
    await expect(page.locator("#shell")).toBeHidden();
  }
  // The musicians on their own phones get the placeholder, dark.
  await page.goto("/unu-unu/instruments");
  await expect(html).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await expect(page.locator("#shell")).toHaveCSS("opacity", "1");
  // A paired screen loads in what it showed last: an overlay, transparent for OBS.
  await page.evaluate(() =>
    localStorage.setItem("norless:screen-background", "transparent"),
  );
  await page.goto("/s/any");
  await expect(html).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await context.close();
});

test("a slow page shows placeholders until it arrives", async ({ page }) => {
  await page.route("**/api/communities/unu-unu/songs/grace", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.goto("/unu-unu/songs/grace");

  await expect(page.getByRole("status", { name: "Loading…" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Har minunat" }),
  ).toBeVisible();
  await expect(page.getByRole("status", { name: "Loading…" })).toHaveCount(0);
});

test("a page that didn't load can be tried again", async ({ page }) => {
  await page.route("**/api/communities/unu-unu/songs/grace", (route) =>
    route.fulfill({ status: 500 }),
  );
  await page.goto("/unu-unu/songs/grace");
  await expect(page.getByText("This didn't load.")).toBeVisible();

  await page.unroute("**/api/communities/unu-unu/songs/grace");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "Har minunat" }),
  ).toBeVisible();
});

test.describe("saving", () => {
  test.beforeEach(({ page }) => logInAs(page, "ana@example.com"));

  test("a removed entry goes at once, and comes back with a message if the server says no", async ({
    page,
  }) => {
    const base = "/api/communities/unu-unu/playlists";
    const { body } = await api(page, "POST", base, { title: "Ștergere" });
    const id = (body as { id: string }).id;
    for (const text of ["Unu", "Doi"])
      await api(page, "POST", `${base}/${id}/entries`, {
        kind: "divider",
        text,
      });
    await page.goto(`/unu-unu/playlists/${id}`);
    const rows = page.getByRole("grid", { name: "Entries" }).getByRole("row");
    await expect(rows).toHaveCount(2);
    // The server is slow, then the removal fails.
    await page.route("**/entries/*", async (route) => {
      if (route.request().method() !== "DELETE") return route.continue();
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.abort();
    });
    await rows.first().click();
    await page.keyboard.press("Delete");
    // Gone before the server answers.
    await expect(rows).toHaveCount(1, { timeout: 1500 });
    await expect(page.getByText("That didn't go through")).toBeVisible();
    await expect(rows).toHaveCount(2);
  });

  test("a double tap on a slow save saves once and shows it's saving", async ({
    page,
  }) => {
    const id = await createSong(page, "Salvare lentă", "1:\nVers");
    let saves = 0;
    await page.route(
      `**/api/communities/unu-unu/songs/${id}`,
      async (route) => {
        if (route.request().method() !== "PUT") return route.continue();
        saves++;
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await route.continue();
      },
    );
    await page.goto(`/unu-unu/songs/${id}/edit`);
    await page.getByLabel("Key").fill("A");

    const save = page.getByRole("button", { name: "Save", exact: true });
    await save.click();
    await expect(save).toHaveAttribute("data-pending", "true");
    await save.click({ force: true });
    await page.keyboard.press("ControlOrMeta+s");
    await expect(page.getByText("Saved")).toBeVisible();
    expect(saves).toBe(1);
  });

  test("a failed save keeps the text and can be tried again", async ({
    page,
  }) => {
    const id = await createSong(page, "Salvare eșuată", "1:\nVers");
    const url = `**/api/communities/unu-unu/songs/${id}`;
    await page.route(url, (route) =>
      route.request().method() === "PUT" ? route.abort() : route.continue(),
    );
    await page.goto(`/unu-unu/songs/${id}/edit`);
    await page.getByRole("radio", { name: "One language" }).click();
    const text = page.getByRole("tabpanel").getByLabel("Text");
    await text.fill("1:\nVers nou");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText("The song wasn't saved.")).toBeVisible();
    await expect(text).toHaveValue("1:\nVers nou");

    await page.unroute(url);
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.getByText("Saved")).toBeVisible();
    await expect(page.getByText("The song wasn't saved.")).toHaveCount(0);
  });

  test("a song needs a title before it saves", async ({ page }) => {
    await page.goto("/unu-unu/songs/new");
    await page.getByRole("radio", { name: "One language" }).click();
    await page.getByRole("tabpanel").getByLabel("Text").fill("1:\nFără titlu");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByText("Give the song a title in at least one language"),
    ).toBeVisible();
  });
});
