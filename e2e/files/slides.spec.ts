// Slides from files, in their own community "diapozitive" (RO and UA),
// through the converter's container: one test at a time, since they share its room.
import { readFileSync } from "node:fs";
import { type Page } from "@playwright/test";
import { api, expect, logInAs, test } from "../helpers";
import { png } from "./make";

test.describe.configure({ mode: "serial" });

const base = "/api/communities/diapozitive";
const playlist = "/diapozitive/playlists/slides-sunday";
const pdf = readFileSync("e2e/files/slides.pdf");

/** Drops files onto an element of the page, as from the computer's folders. */
async function drop(page: Page, selector: string, files: [string, Buffer][]) {
  const dataTransfer = await page.evaluateHandle(
    (files) => {
      const transfer = new DataTransfer();
      for (const [name, bytes] of files)
        transfer.items.add(new File([new Uint8Array(bytes)], name));
      return transfer;
    },
    files.map(([name, bytes]) => [name, [...bytes]] as [string, number[]]),
  );
  await page.dispatchEvent(selector, "drop", { dataTransfer });
}

/** Removes the slides entries the tests before added, so each starts with the song alone. */
async function onlyTheSong(page: Page) {
  const { body } = await api(page, "GET", `${base}/playlists/slides-sunday`);
  for (const entry of (body as { entries: { id: string; kind: string }[] })
    .entries)
    if (entry.kind === "slides")
      await api(
        page,
        "DELETE",
        `${base}/playlists/slides-sunday/entries/${entry.id}`,
      );
}

test("a PDF dropped onto the playlist becomes slides that go live page by page, then on", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ioana@example.com");
  await onlyTheSong(page);
  await page.goto(playlist);
  await drop(page, '[data-entry="slides-song-entry"]', [
    ["Program 12 oct.pdf", pdf],
  ]);
  const row = page
    .locator("[data-entry]")
    .filter({ hasText: "Program 12 oct" });
  await expect(row).toContainText("2 pages", { timeout: 20_000 });
  // Where it was dropped: after the song.
  await expect(page.locator("[data-entry]").last()).toContainText(
    "Program 12 oct",
  );
  await expect(row.locator("img")).toBeVisible();

  const projector = await (await browser.newContext()).newPage();
  await projector.goto("/diapozitive/projector/ro");
  await row.dblclick();
  await expect(
    projector.locator('img[src*="/api/slide-pages/"]'),
  ).toHaveAttribute("src", /\/1\/1280$/);
  // Its pages as thumbnails where a song's parts show; the live one framed.
  const pages = page.getByRole("list", { name: "Slides" });
  await expect(pages.getByRole("listitem")).toHaveCount(2);
  await page.keyboard.press("PageDown");
  await expect(
    projector.locator('img[src*="/api/slide-pages/"]'),
  ).toHaveAttribute("src", /\/2\/1280$/);
  await expect(
    pages.getByRole("button", { name: "Slides 2/2" }),
  ).toHaveAttribute("aria-current", "true");
  // The stage views name it.
  const band = await (await browser.newContext()).newPage();
  await band.goto("/diapozitive/vocalists");
  await expect(band.getByText("Slides 2/2")).toBeVisible();
  // Phones following along see the page across their width.
  const phone = await (
    await browser.newContext({ viewport: { width: 390, height: 844 } })
  ).newPage();
  await phone.goto("/diapozitive/follow");
  await expect(phone.locator('img[src*="/api/slide-pages/"]')).toHaveAttribute(
    "src",
    /\/2\/1280$/,
  );
  // After the last page, the next entry: here, none; previous goes back a page.
  await page.keyboard.press("PageUp");
  await expect(
    projector.locator('img[src*="/api/slide-pages/"]'),
  ).toHaveAttribute("src", /\/1\/1280$/);
});

test("a presentation dropped onto the playlist says to add it as a PDF, and adds nothing", async ({
  page,
}) => {
  await logInAs(page, "ioana@example.com");
  await onlyTheSong(page);
  await page.goto(playlist);
  await drop(page, '[data-entry="slides-song-entry"]', [
    ["Anunturi 12 oct.pptx", Buffer.from("PK")],
  ]);
  const hint = page.getByRole("status").filter({ hasText: "added as a PDF" });
  await expect(hint).toContainText("PowerPoint: File → Save As → PDF");
  await expect(page.locator("[data-entry]")).toHaveCount(1);
  await hint.getByRole("button", { name: "Close" }).click();
  await expect(hint).toBeHidden();
});

test("pictures picked together make one entry; a file for UA shows on UA's projector", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ioana@example.com");
  await onlyTheSong(page);
  await page.goto(playlist);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles(
      ["3.png", "1.png", "2.png"].map((name) => ({
        name,
        mimeType: "image/png",
        buffer: png(64, 48),
      })),
    );
  const row = page.locator("[data-entry]").filter({ hasText: "1" });
  await expect(
    page.locator("[data-entry]").filter({ hasText: "3 pages" }),
  ).toBeVisible({ timeout: 20_000 });

  // A file for Ukrainian, from the entry's menu.
  await row.last().click({ button: "right" });
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("menuitem", { name: /Add a file for Ukrainian/ })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "Оголошення.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  const entry = page.locator("[data-entry]").filter({ hasText: "3 pages" });
  await expect(entry.getByText("UA")).toBeVisible({ timeout: 20_000 });

  await logInAs(page, "ana@example.com");
  const screen = (name: string, languages: string[]) =>
    api(page, "POST", `${base}/screens`, {
      name,
      type: "projector",
      languages,
    }).then(({ body }) => (body as { secret: string }).secret);
  const ro = await (await browser.newContext()).newPage();
  await ro.goto(`/s/${await screen("RO", ["ro"])}`);
  const uk = await (await browser.newContext()).newPage();
  await uk.goto(`/s/${await screen("UA", ["uk"])}`);
  const id = await entry.getAttribute("data-entry");
  await api(page, "POST", `${base}/live`, { type: "go", entryId: id });
  const file = (screen: Page) =>
    screen
      .locator('img[src*="/api/slide-pages/"]')
      .getAttribute("src")
      .then((src) => src?.split("/")[3]);
  // Each projector its language's file, once the new live state reached both.
  await expect
    .poll(async () => {
      const [main, own] = [await file(ro), await file(uk)];
      return !!main && !!own && main !== own;
    })
    .toBe(true);
});

test("the timer moves the pages on the server, loops, and stops when anything moves", async ({
  page,
}) => {
  await logInAs(page, "ioana@example.com");
  await onlyTheSong(page);
  await page.goto(playlist);
  await page.locator('input[type="file"]').first().setInputFiles({
    name: "Program.pdf",
    mimeType: "application/pdf",
    buffer: pdf,
  });
  const row = page.locator("[data-entry]").filter({ hasText: "Program" });
  await expect(row).toContainText("2 pages", { timeout: 20_000 });
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: /Next page every/ }).click();
  await page.getByLabel("Seconds per page").fill("3");
  await page.getByRole("button", { name: "Start" }).click();
  const slide = () =>
    api(page, "GET", `${base}/live`).then(
      ({ body }) => (body as { slide: number }).slide,
    );
  await expect.poll(slide, { timeout: 10_000 }).toBe(1);
  // Looping after the last page.
  await expect.poll(slide, { timeout: 10_000 }).toBe(0);
  await api(page, "POST", `${base}/live`, { type: "next" });
  const { body } = await api(page, "GET", `${base}/live`);
  expect((body as { timer: unknown }).timer).toBeNull();
});
