import { devices, type Page } from "@playwright/test";
import { expect, test } from "./helpers";

/** As if Unu-Unu were the only community. */
const onlyUnuUnu = (page: Page) =>
  page.route("**/api/communities", (route) =>
    route.fulfill({ json: [{ slug: "unu-unu", name: "Unu-Unu" }] }),
  );

test("a fresh browser sees what Norless is, with the communities, and Log in in the header only", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Norless keeps a church's songs")).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in" })).toHaveCount(1);
  await expect(
    page
      .getByRole("navigation", { name: "Communities" })
      .getByRole("link", { name: "Unu-Unu" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Install Norless" }),
  ).toHaveCount(0);
});

test("with one community, Open leads in, and the device then jumps straight in", async ({
  page,
}) => {
  await onlyUnuUnu(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Open Unu-Unu" }).click();
  // Its playlist, or its follow-along page while another test has a song live.
  await expect(page).toHaveURL(/\/unu-unu\/(playlists\/|follow)/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/unu-unu/);
});

test("where the browser offers it, Install comes first, in the place kept for it", async ({
  page,
}) => {
  await onlyUnuUnu(page);
  await page.goto("/");
  const open = page.getByRole("link", { name: "Open Unu-Unu" });
  const before = await open.boundingBox();
  await page.evaluate(() => {
    const offer = Object.assign(new Event("beforeinstallprompt"), {
      prompt: async () => {
        (window as unknown as { prompted: boolean }).prompted = true;
      },
    });
    window.dispatchEvent(offer);
  });
  await page.getByRole("button", { name: "Install the app" }).click();
  expect(
    await page.evaluate(
      () => (window as unknown as { prompted?: boolean }).prompted,
    ),
  ).toBe(true);
  expect(await open.boundingBox()).toEqual(before);
});

test("the installed app never shows it", async ({ page }) => {
  await onlyUnuUnu(page);
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "standalone", { value: true }),
  );
  await page.goto("/");
  await expect(page).toHaveURL(/\/unu-unu/);
});

test.describe("on an iPhone", () => {
  const { viewport, userAgent, isMobile, hasTouch } = devices["iPhone 13"];
  test.use({ viewport, userAgent, isMobile, hasTouch });
  test("Install shows how to add it to the home screen", async ({ page }) => {
    await onlyUnuUnu(page);
    await page.goto("/");
    await expect(
      page.getByText("tap Share, then Add to Home Screen"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Open Unu-Unu" }),
    ).toBeVisible();
  });
});
