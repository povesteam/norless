import AxeBuilder from "@axe-core/playwright";
import {
  type BrowserContext,
  test as base,
  expect,
  type Locator,
  type Page,
} from "@playwright/test";

export { expect };

/**
 * The serious and critical accessibility violations axe-core finds on a page, in light
 * and in dark mode (app-shell spec), with where they are.
 */
export async function accessibilityProblems(page: Page) {
  const problems: string[] = [];
  // Colors measured as they end up, not halfway through a transition.
  await page.addStyleTag({
    content:
      "*, *::before, *::after { transition: none !important; animation: none !important; }",
  });
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    // The page follows the system's scheme on the next frame.
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(resolve)),
    );
    const { violations } = await new AxeBuilder({ page })
      // React Aria's hidden announcer keeps announcements whose labels are gone.
      .exclude("[data-live-announcer]")
      .analyze();
    for (const v of violations)
      if (v.impact === "serious" || v.impact === "critical")
        problems.push(
          `${colorScheme} ${page.url()}: ${v.id} (${v.help}) at ${v.nodes
            .map((n) => {
              const data = n.any[0]?.data as
                | { fgColor?: string; bgColor?: string; contrastRatio?: number }
                | undefined;
              const colors = data?.fgColor
                ? ` ${data.fgColor} on ${data.bgColor} ${data.contrastRatio}`
                : "";
              return `${n.html.slice(0, 100)}${colors}`;
            })
            .join("; ")}`,
        );
  }
  return problems;
}

/** Pages that work once, so opening them again shows something else. */
const once = /\/login\/link\//;

/**
 * Playwright's test, checking accessibility when each test ends: the pages it leaves
 * open, as they are, and every other page its own context visited, opened again.
 */
export const test = base.extend<{ accessible: undefined }>({
  accessible: [
    async ({ context, browser }, use) => {
      const before = new Set(browser.contexts());
      const visited = new Set<string>();
      const follow = (page: Page) =>
        page.on("framenavigated", (frame) => {
          if (frame === page.mainFrame() && frame.url().startsWith("http"))
            visited.add(frame.url().split("#")[0] ?? "");
        });
      context.pages().forEach(follow);
      context.on("page", follow);
      await use(undefined);
      const opened = browser
        .contexts()
        .filter((c: BrowserContext) => c === context || !before.has(c));
      const pages = opened
        .flatMap((c) => c.pages())
        .filter((p) => !p.isClosed() && p.url().startsWith("http"));
      const problems = (
        await Promise.all(pages.map((p) => accessibilityProblems(p)))
      ).flat();
      const open = new Set(pages.map((p) => p.url().split("#")[0]));
      const again = [...visited].filter(
        (url) => !open.has(url) && !once.test(url),
      );
      if (again.length) {
        const page = await context.newPage();
        for (const url of again) {
          await page.goto(url);
          // Settled: loaded, and nothing loading still shown.
          await page.waitForLoadState("networkidle").catch(() => {});
          problems.push(...(await accessibilityProblems(page)));
        }
        await page.close();
      }
      expect(problems, "accessibility").toEqual([]);
    },
    { auto: true },
  ],
});

/**
 * Calls the API from inside the page, so the session cookie goes along: Playwright's
 * own request client doesn't send Secure cookies over plain http.
 */
export async function api(
  page: Page,
  method: string,
  url: string,
  data?: unknown,
) {
  if (page.url() === "about:blank") await page.goto("/");
  return page.evaluate(
    async ({ method, url, data }) => {
      const response = await fetch(url, {
        method,
        headers:
          data === undefined ? {} : { "content-type": "application/json" },
        body: data === undefined ? undefined : JSON.stringify(data),
      });
      const text = await response.text();
      return {
        status: response.status,
        body: text ? (JSON.parse(text) as unknown) : null,
      };
    },
    { method, url, data },
  );
}

/**
 * For tests that open the login page: no code to log in with a phone, since its offer
 * would reach the phones of the other tests running on this address.
 */
export const withoutPhoneLogin = (page: Page) =>
  page.route("**/api/device-login", (route) => route.abort());

/** Logs in through the dev login, without the login page. */
export async function logInAs(page: Page, email: string) {
  const { status } = await api(page, "POST", "/api/auth/dev-login", { email });
  expect(status).toBe(204);
}

/** Creates a song of its own for a test, as the logged-in editor. */
export async function createSong(page: Page, title: string, text: string) {
  const { status, body } = await api(
    page,
    "POST",
    "/api/communities/unu-unu/songs",
    {
      versions: [{ language: "ro", title, text }],
    },
  );
  expect(status).toBe(201);
  return (body as { id: string }).id;
}

/** Opens the seeded playlist that no test changes: a stable page with the search box. */
export async function openSteadyPage(page: Page) {
  await page.goto("/unu-unu/playlists/steady");
  await expect(page.getByRole("grid", { name: "Entries" })).toBeVisible();
}

/**
 * Each element inside a TV's title-safe area, 5% of the screen from each edge (screens
 * spec, Title-safe margins). Retried while the text is fitted to the screen.
 */
export async function expectTitleSafe(page: Page, elements: Locator[]) {
  const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
  await expect(async () => {
    for (const element of elements) {
      const box = await element.boundingBox();
      if (!box) throw new Error("not shown");
      expect(box.x).toBeGreaterThanOrEqual(width * 0.05 - 1);
      expect(box.y).toBeGreaterThanOrEqual(height * 0.05 - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(width * 0.95 + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(height * 0.95 + 1);
    }
  }).toPass();
}

/** The bar's menus on a laptop (app-shell spec, Community bar). */
const barMenus = ["Stage", "Team", "More"];

/**
 * Opens a page of the community's bar on a laptop: its link, or its item in one of the
 * bar's menus.
 */
export async function openFromBar(page: Page, name: string) {
  const bar = page.locator("header nav").first();
  // The bar's menus come once the community and this person's roles have loaded.
  await expect(async () => {
    const link = bar.getByRole("link", { name, exact: true });
    if (await link.isVisible()) return link.click();
    for (const menu of barMenus) {
      const button = bar.getByRole("button", { name: menu, exact: true });
      if (!(await button.isVisible())) continue;
      await button.click();
      const item = page.getByRole("menuitem", { name, exact: true });
      await page.getByRole("menuitem").first().waitFor();
      if (await item.isVisible()) return item.click();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu")).toHaveCount(0);
    }
    throw new Error(`${name} is not in the bar`);
  }).toPass({ timeout: 10_000 });
}

/** Every page the community's bar offers on a laptop, in its links and its menus. */
export async function barPages(page: Page) {
  const bar = page.locator("header nav").first();
  await bar.getByRole("link").nth(1).waitFor();
  const names = await bar.getByRole("link").allInnerTexts();
  for (const menu of barMenus) {
    const button = bar.getByRole("button", { name: menu, exact: true });
    if (!(await button.isVisible())) continue;
    await button.click();
    await page.getByRole("menuitem").first().waitFor();
    names.push(...(await page.getByRole("menuitem").allInnerTexts()));
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
  }
  return names.map((n) => n.trim());
}

/** Picks a playlist layout from the title row's menu. */
export async function pickLayout(page: Page, name: string) {
  await page.getByRole("button", { name: /^Layout: / }).click();
  await page.getByRole("menuitemradio", { name, exact: true }).click();
}

/** A one-finger swipe across the middle of the page: -1 to the left, 1 to the right. */
export const swipe = (page: Page, direction: -1 | 1) =>
  page.evaluate((direction) => {
    const x = innerWidth / 2;
    const y = innerHeight / 2;
    const target = document.elementFromPoint(x, y) ?? document.body;
    const touch = (dx: number) =>
      new Touch({ identifier: 1, target, clientX: x + dx, clientY: y });
    target.dispatchEvent(
      new TouchEvent("touchstart", {
        bubbles: true,
        touches: [touch(0)],
        changedTouches: [touch(0)],
      }),
    );
    target.dispatchEvent(
      new TouchEvent("touchend", {
        bubbles: true,
        touches: [],
        changedTouches: [touch(direction * 120)],
      }),
    );
  }, direction);
