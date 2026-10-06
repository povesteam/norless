import { expect, test } from "@playwright/test";
import { api, barPages, logInAs, openFromBar } from "./helpers";

test("the owner keeps the schedule and classifies the imported plays", async ({
  page,
}) => {
  await logInAs(page, "ana@example.com");
  await page.goto("/unu-unu");
  await openFromBar(page, "Settings");
  // One tab per part, each with its own address.
  await page.getByRole("tab", { name: "Schedule" }).click();
  await expect(page).toHaveURL(/\/unu-unu\/settings\/schedule$/);
  await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
  await expect(page.getByText("No events yet")).toBeVisible();

  await page.getByRole("button", { name: "Add a weekly event" }).click();
  await page.getByLabel("Name").fill("Serviciu duminică");
  await page.getByLabel("Starts").fill("10:00");
  await page.getByLabel("Ends").fill("12:30");
  await page.getByLabel("From (optional)").fill("2020-01-01");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const sunday = page.getByRole("listitem", { name: "Serviciu duminică" });
  await expect(sunday).toContainText("Sunday, 10:00–12:30");
  await expect(sunday).toContainText("since Jan 1, 2020");
  await expect(sunday).toContainText("Service");

  // An end before the start is refused, with the reason.
  await sunday.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Ends").fill("09:00");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("That event can't be saved")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Cancel one day" }).click();
  await page.getByLabel("Date").fill("2026-10-04");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Cancelled days" }),
  ).toBeVisible();

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Classify imported plays" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "service plays" }),
  ).toHaveText(/\d+ service plays and \d+ rehearsal plays\./);
});

test("on a phone the settings are a list of sections; an event goes from its ⋯", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logInAs(page, "ana@example.com");
  await page.goto("/unu-unu/settings");
  await page.getByRole("link", { name: "Schedule" }).click();
  await expect(page).toHaveURL(/\/unu-unu\/settings\/schedule$/);
  await page.getByRole("button", { name: "Add a weekly event" }).click();
  await page.getByLabel("Name").fill("De șters");
  await page.getByLabel("Starts").fill("03:00");
  await page.getByLabel("Ends").fill("03:30");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const row = page.getByRole("listitem", { name: "De șters" });
  page.once("dialog", (dialog) => void dialog.accept());
  await row.getByRole("button", { name: "Actions: De șters" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/unu-unu\/settings$/);
  await expect(page.getByRole("link", { name: "Members" })).toBeVisible();
});

test("others don't see the settings", async ({ page }) => {
  await logInAs(page, "maria@example.com");
  await page.goto("/unu-unu/settings");
  await expect(
    page.getByText("Only owners can change the settings."),
  ).toBeVisible();
  expect(await barPages(page)).not.toContain("Settings");
});

test("the owner sets the community's color and logo; colors hard to read can't be saved", async ({
  page,
}) => {
  await logInAs(page, "ana@example.com");
  await page.goto("/unu-unu/settings/theme");
  const theme = page.getByRole("region", { name: "Theme" });
  const save = theme.getByRole("button", { name: "Save the theme" });

  await theme.getByLabel("Primary color").fill("#f0b090");
  await expect(theme.getByRole("alert").first()).toContainText(
    "White text on the primary color would be hard to read",
  );
  await expect(save).toBeDisabled();

  await theme.getByLabel("Primary color").fill("#ac5334");
  // A 1×1 PNG.
  await theme.getByLabel("Logo (up to 200 KB)").setInputFiles({
    name: "logo.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
      "base64",
    ),
  });
  await expect(
    theme.getByRole("img", { name: "Logo (up to 200 KB)" }),
  ).toBeVisible();
  await save.click();
  await expect(theme.getByText("Saved")).toBeVisible();

  await page.reload();
  await expect
    .poll(() =>
      page.evaluate(() =>
        getComputedStyle(document.documentElement)
          .getPropertyValue("--accent")
          .trim(),
      ),
    )
    .toBe("#ac5334");
  await expect(
    page.getByRole("navigation", { name: "Unu-Unu" }).locator("img"),
  ).toBeVisible();
  // Back to the app's own look for the other tests.
  await api(page, "PUT", "/api/communities/unu-unu/theme", {});
});

test("a screen has one short link, to open and to copy", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await logInAs(page, "ana@example.com");
  const { body } = await api(page, "POST", "/api/communities/unu-unu/screens", {
    name: "Link test",
    type: "projector",
    languages: ["ro"],
  });
  const secret = (body as { secret: string }).secret;
  await page.goto("/unu-unu/settings/screens");
  const row = page.getByRole("listitem", { name: "Link test" });
  const href = await row
    .getByRole("link", { name: "Open" })
    .getAttribute("href");
  expect(href).toMatch(/^http:\/\/[^/]+\/[2-9a-zA-Z]{6}$/);
  await row.getByRole("button", { name: "Copy link" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(href);
  await page.goto(href ?? "");
  await expect(page).toHaveURL(`/s/${secret}`);
});

test("the owner picks the Bible version per language, also one not listed", async ({
  page,
}) => {
  await logInAs(page, "ana@example.com");
  await page.goto("/unu-unu/settings/bible");
  const romanian = page.getByRole("button", { name: /Romanian/ });
  await expect(romanian).toContainText("VDC");
  await romanian.click();
  await page.getByRole("option", { name: /NTR/ }).click();
  await page.getByRole("button", { name: "Save the versions" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  const { body } = await api(page, "GET", "/api/communities/unu-unu");
  expect((body as { bibleVersions: object }).bibleVersions).toMatchObject({
    ro: 126,
  });

  await page.getByRole("button", { name: /Romanian/ }).click();
  await page.getByRole("option", { name: "Other…" }).click();
  await page
    .getByRole("textbox", { name: "bible.com version number" })
    .fill("1996");
  await page.getByRole("button", { name: "Save the versions" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  const again = await api(page, "GET", "/api/communities/unu-unu");
  expect((again.body as { bibleVersions: object }).bibleVersions).toMatchObject(
    {
      ro: 1996,
    },
  );
  // Back to the default, for the other tests.
  await api(page, "PUT", "/api/communities/unu-unu/bible-versions", {
    versions: {},
  });
});

test("the owner sets the YouTube channel the services are streamed on, from its address", async ({
  page,
}) => {
  await logInAs(page, "ana@example.com");
  await page.goto("/unu-unu/settings/schedule");
  const channel = page.getByRole("textbox", {
    name: "Channel address or @handle",
  });
  await channel.fill("Unu-unu");
  await page.getByRole("button", { name: "Save the channel" }).click();
  await expect(page.getByText("That isn't a YouTube channel")).toBeVisible();

  await channel.fill("https://www.youtube.com/@Unu-unuRo/streams");
  await page.getByRole("button", { name: "Save the channel" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  await expect(channel).toHaveValue("@Unu-unuRo");
  // Back to none, for the other tests.
  await api(page, "PUT", "/api/communities/unu-unu/youtube-channel", {
    channel: null,
  });
});
