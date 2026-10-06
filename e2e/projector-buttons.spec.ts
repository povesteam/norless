import { expect, logInAs, test } from "./helpers";

test.use({ viewport: { width: 1440, height: 900 } });

test("without a second display, a projector button says so, and Open anyway opens a window", async ({
  page,
}) => {
  // The browser knows this laptop has only its own display.
  await page.addInitScript(() =>
    Object.defineProperty(window.screen, "isExtended", { value: false }),
  );
  await logInAs(page, "ioana@example.com");
  await page.goto("/clasic/playlists/classic-sunday");
  const projector = page
    .locator("[data-bottom-bar]")
    .getByRole("button", { name: "Projector RO" });
  let popups = 0;
  page.on("popup", () => popups++);
  await projector.click();
  const message = page.getByText("No projector is attached");
  await expect(message).toBeVisible();
  expect(popups).toBe(0);

  const popup = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Open anyway" }).click();
  await popup;
  await expect(message).toHaveCount(0);
  // Already open: it comes forward without asking again.
  await projector.click();
  await expect(message).toHaveCount(0);
  expect(popups).toBe(1);
});
