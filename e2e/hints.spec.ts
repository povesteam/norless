import { expect, logInAs, test } from "./helpers";

test.use({ viewport: { width: 1440, height: 900 } });

test("Classic's hints show one at a time beside their control, and Got it hides each for good", async ({
  page,
}) => {
  // Eva, on the team at Clasic, hasn't seen them.
  await logInAs(page, "eva@example.com");
  await page.goto("/clasic/playlists/classic-sunday");
  const hint = page.getByRole("note", { name: "Hint" });
  await expect(hint).toHaveCount(1);
  await expect(hint).toContainText("Double-click an entry");
  // Beside the playlist, not over it.
  const entries = await page
    .getByRole("grid", { name: "Entries" })
    .boundingBox();
  const bubble = await hint.boundingBox();
  expect(bubble?.x ?? 0).toBeGreaterThanOrEqual(
    (entries?.x ?? 0) + (entries?.width ?? 0),
  );

  await hint.getByRole("button", { name: "Got it" }).click();
  await expect(hint).toContainText("Type anywhere to search");
  await hint.getByRole("button", { name: "Got it" }).click();
  // Then Project, and the clicker keys once something is live (other tests may have
  // sent something live in this room): whichever comes, until none is left.
  const later: string[] = [];
  while (later.length < 2 && (await hint.count()) > 0) {
    const text = (await hint.getByRole("paragraph").textContent()) ?? "";
    later.push(text);
    const saved = page.waitForResponse("/api/me/preferences");
    await hint.getByRole("button", { name: "Got it" }).click();
    await saved;
    await expect(hint.getByText(text)).toHaveCount(0);
  }
  expect(later.join(" ")).toContain("A projector's button opens it");
  await page.reload();
  await expect(page.getByRole("grid", { name: "Entries" })).toBeVisible();
  for (const seen of [
    "Double-click an entry",
    "Type anywhere to search",
    "A projector's button opens it",
  ])
    await expect(page.getByText(seen)).toHaveCount(0);
});

test("on an empty playlist the first hint is about searching, not going live", async ({
  page,
}) => {
  await logInAs(page, "vera@example.com");
  await page.goto("/clasic/playlists/classic-empty");
  const hint = page.getByRole("note", { name: "Hint" });
  await expect(hint).toContainText("Type anywhere to search");
  await expect(page.getByText("Double-click an entry")).toHaveCount(0);
});
