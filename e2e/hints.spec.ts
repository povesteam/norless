import { expect, logInAs, test } from "./helpers";

test.use({ viewport: { width: 1440, height: 900 } });

test("Classic's hints wait in the What's new bubble as the page's tips, seen once opened", async ({
  page,
}) => {
  // Eva, on the team at Clasic, hasn't seen them.
  await logInAs(page, "eva@example.com");
  await page.goto("/clasic/playlists/classic-sunday");
  await expect(page.getByRole("grid", { name: "Entries" })).toBeVisible();
  // Nothing covers the page.
  await expect(page.getByText("Double-click an entry")).toHaveCount(0);
  const bubble = page.getByRole("button", { name: /^What's new/ });
  const saved = page.waitForResponse("/api/me/preferences");
  await bubble.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Tips for this page");
  await expect(dialog).toContainText("Double-click an entry");
  await expect(dialog).toContainText("Type anywhere to search");
  await expect(dialog).toContainText("A projector's button opens it");
  await saved;
  await dialog.getByRole("button", { name: "Got it" }).click();

  // Seen: not offered again.
  await page.reload();
  await expect(page.getByRole("grid", { name: "Entries" })).toBeVisible();
  await expect(bubble).toHaveCount(0);
});

test("on an empty playlist the tips leave out going live", async ({ page }) => {
  await logInAs(page, "vera@example.com");
  await page.goto("/clasic/playlists/classic-empty");
  await page.getByRole("button", { name: /^What's new/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Type anywhere to search");
  await expect(dialog.getByText("Double-click an entry")).toHaveCount(0);
});
