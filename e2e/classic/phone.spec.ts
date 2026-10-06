import { api, expect, logInAs, test } from "../helpers";
import { base, newPlaylist, rows, slides } from "./playlist";

test.describe("on a phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("one column at a time: the playlist, then a song's slides, and back", async ({
    page,
  }) => {
    await logInAs(page, "ioana@example.com");
    await page.goto("/clasic/playlists/classic-sunday");
    // The playlist's title in the bar, on the line of ☰, the community after it, smaller.
    const menu = await page.getByRole("button", { name: "Menu" }).boundingBox();
    const title = page.getByRole("heading", { name: "Duminică" });
    const box = await title.boundingBox();
    expect(
      Math.abs(
        (box?.y ?? 0) +
          (box?.height ?? 0) / 2 -
          ((menu?.y ?? 0) + (menu?.height ?? 0) / 2),
      ),
    ).toBeLessThan(4);
    await rows(page).filter({ hasText: "Lumina lumii" }).tap();
    await expect(slides(page)).toBeVisible();
    await expect(rows(page).first()).toBeHidden();

    await page.getByRole("button", { name: "Back to the playlist" }).tap();
    await expect(rows(page).first()).toBeVisible();
    await expect(slides(page)).toBeHidden();
    // The song still selected opens again too.
    await rows(page).filter({ hasText: "Lumina lumii" }).tap();
    await expect(slides(page)).toBeVisible();
    await page.getByRole("button", { name: "Back to the playlist" }).tap();

    // The projectors' preview in the page, instead of their windows, behind More.
    await page.getByRole("button", { name: "More" }).tap();
    await page.getByRole("button", { name: "Projector RO" }).tap();
    await expect(
      page.getByRole("group", { name: "What the projectors show" }),
    ).toBeVisible();
  });
});

test("on a phone, the live controls sit at the screen's bottom even when the playlist is short", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logInAs(page, "ioana@example.com");
  const id = await newPlaylist(page, "Scurtă");
  await page.goto(`/clasic/playlists/${id}`);
  await expect(page.getByRole("button", { name: "More" })).toBeVisible();
  const bar = await page.locator("[data-bottom-bar]").boundingBox();
  expect(Math.round((bar?.y ?? 0) + (bar?.height ?? 0))).toBe(844);
});

test("on a phone: the live song's title above the buttons, the menu at the left and the photo at the right", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logInAs(page, "ioana@example.com");
  const id = await newPlaylist(page, "Pe telefon");
  const { body } = await api(page, "GET", `${base}/${id}`);
  const entry = (body as { entries: { id: string }[] }).entries[0]?.id ?? "";
  await api(page, "POST", "/api/communities/clasic/live", {
    type: "go",
    entryId: entry,
  });
  await page.goto(`/clasic/playlists/${id}`);
  const bar = page.locator("[data-bottom-bar]");
  await expect(bar.getByText(/^Lumina lumii/)).toBeVisible();

  // ☰ first, the photo last; the photo opens the account menu.
  const menu = page.getByRole("button", { name: "Menu" });
  const photo = page.getByRole("button", { name: "Ioana" });
  expect((await menu.boundingBox())?.x ?? 0).toBeLessThan(50);
  expect((await photo.boundingBox())?.x ?? 0).toBeGreaterThan(300);
  await photo.click();
  await expect(
    page.getByRole("menuitem", { name: "My account" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  // The drawer opens from the left.
  await menu.click();
  const drawer = page.getByRole("dialog", { name: "Menu" });
  await expect(drawer).toBeVisible();
  await expect
    .poll(async () => (await drawer.boundingBox())?.x ?? 999)
    .toBeLessThan(50);
});

test("on a phone, the community's name sits above the bar, and the playlist's title opens its actions, Rename first, without ⋯", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logInAs(page, "ioana@example.com");
  const id = await newPlaylist(page, "Botez");
  await page.goto(`/clasic/playlists/${id}`);
  await expect(page.getByRole("heading", { name: "Botez" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Playlist actions" }),
  ).toHaveCount(0);
  // The community's name on a line of its own above the bar, centered.
  const name = await page
    .getByRole("link", { name: "Clasic", exact: true })
    .boundingBox();
  const heading = await page
    .getByRole("heading", { name: "Botez" })
    .boundingBox();
  expect((name?.y ?? 0) + (name?.height ?? 0)).toBeLessThanOrEqual(
    heading?.y ?? 0,
  );
  expect(
    Math.abs((name?.x ?? 0) + (name?.width ?? 0) / 2 - 390 / 2),
  ).toBeLessThan(4);
  await page.getByRole("button", { name: /^Botez/ }).click();
  const items = page.getByRole("menuitem");
  await expect(items.first()).toHaveText("Rename");
  await expect(
    page.getByRole("menuitem", { name: "Archive playlist" }),
  ).toBeVisible();
  await items.first().click();
  const title = page.getByLabel("Playlist title");
  await expect(title).toBeFocused();
  await title.fill("Botez seara");
  await title.press("Enter");
  await expect(
    page.getByRole("heading", { name: /^Botez seara/ }),
  ).toBeVisible();
});
