// The Big screen layout, in its own community "ecran-mare",
// whose live state no other test changes.
import { api, expect, logInAs, test } from "../helpers";

test.describe.configure({ mode: "serial" });

const base = "/api/communities/ecran-mare";
const playlist = "/ecran-mare/playlists/big-sunday";

test("a big window opens Big screen: the room's screens, the band's devices, more panels as it widens", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ana@example.com");
  await api(page, "POST", `${base}/screens`, {
    name: "Monitor de scenă",
    type: "stage",
    languages: ["ro"],
  });
  await logInAs(page, "ioana@example.com");
  await api(page, "POST", `${base}/live`, { type: "go", entryId: "big-e1" });

  // A laptop's 1440 pixels: the Controller, and no Big screen to pick.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(playlist);
  const picker = page.getByRole("button", { name: /^Layout: / });
  await expect(picker).toHaveAccessibleName("Layout: Controller");
  await picker.click();
  await expect(
    page.getByRole("menuitemradio", { name: "Big screen" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Full HD: Big screen by itself, with every screen's preview.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(picker).toHaveAccessibleName("Layout: Big screen");
  const screens = page.getByRole("region", { name: "The room's screens" });
  await expect(
    screens.getByRole("button", { name: "Open Monitor de scenă larger" }),
  ).toBeVisible();
  const people = page.getByRole("region", {
    name: "Musicians' and vocalists' devices",
  });
  await expect(
    people.getByText(/No musicians or vocalists view/),
  ).toBeVisible();

  // Radu opens the musicians view on his phone: a tile draws it.
  const phone = await (
    await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    })
  ).newPage();
  await logInAs(phone, "radu@example.com");
  await phone.goto("/ecran-mare/musicians");
  const tile = people.getByRole("button", {
    name: /^Open Radu · .* · Phone larger$/,
  });
  await expect(tile).toBeVisible();
  await expect(tile.getByText("Primul cântec")).toBeVisible();
  // Readable at a glance: at least 13rem wide.
  expect((await tile.boundingBox())?.width).toBeGreaterThanOrEqual(13 * 16);

  // Looking closer changes nothing live, and Next still works behind the dialog.
  await screens
    .getByRole("button", { name: "Open Monitor de scenă larger" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Monitor de scenă" });
  await expect(
    dialog.getByRole("group", { name: "To the stage:" }),
  ).toBeVisible();
  const live = () =>
    api(page, "GET", `${base}/live`).then(
      ({ body }) => body as { entryId: string; slide: number },
    );
  expect(await live()).toMatchObject({ entryId: "big-e1", slide: 0 });
  await page.keyboard.press("PageDown");
  await expect.poll(live).toMatchObject({ entryId: "big-e1", slide: 1 });
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  // QHD: the band's devices get a column; 4K at 100%: the next song to read ahead.
  const grid = page.locator("[data-tier]");
  await expect(grid).toHaveAttribute("data-tier", "1");
  const preview = screens.getByRole("button", {
    name: "Open Monitor de scenă larger",
  });
  const fullHd = (await preview.boundingBox())?.width ?? 0;
  await page.setViewportSize({ width: 2560, height: 1440 });
  await expect(grid).toHaveAttribute("data-tier", "2");
  await page.setViewportSize({ width: 3840, height: 2160 });
  await expect(grid).toHaveAttribute("data-tier", "3");
  // The screens' previews grow with the window, two per row, the text at 125%.
  await expect
    .poll(async () => (await preview.boundingBox())?.width ?? 0)
    .toBeGreaterThan(fullHd * 1.6);
  await expect(
    page.getByRole("heading", { name: "The next song" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).fontSize,
    ),
  ).toBe("20px");

  // Phone closed: its tile goes.
  await phone.close();
  await expect(tile).toHaveCount(0);
});
