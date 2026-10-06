import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Page } from "@playwright/test";
import { api, expect, logInAs, test } from "./helpers";

test.use({ viewport: { width: 1440, height: 900 } });

/** A visitor opens Clasic's Sunday playlist and chooses an export in the actions menu. */
async function openExport(page: Page, name: string, language: string) {
  await page.goto("/clasic/playlists/classic-sunday");
  await page.getByRole("button", { name: "Playlist actions" }).click();
  await page.getByRole("menuitem", { name }).click();
  const dialog = page.getByRole("dialog", { name });
  // The interface language first when the community has it; English isn't one.
  await expect(dialog.getByRole("radio", { name: "RO" })).toBeChecked();
  await dialog.getByText(language, { exact: true }).click();
  return dialog;
}

test("a visitor copies the playlist in Ukrainian: songs in order, a repeated refrain by its name, a missing translation in the language it has", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const dialog = await openExport(page, "Copy as text", "UA");
  await dialog.getByRole("button", { name: "Copy as text" }).click();
  await expect(dialog).toContainText("Copied.");
  const text = await page.evaluate(() => navigator.clipboard.readText());
  // The playlist's name, its date in the export's language.
  expect(text).toMatch(/^Duminică · 1 січня/);
  expect(text).toContain(`1. Світло світу

1:
Зоря засвітилась над селом

R:
Співаємо всі разом

2:
Ніч, але ми не боїмось

R


2. Doar harul Tău`);
  // The divider isn't a song.
  expect(text).not.toContain("Rugăciune");
});

test("saved as HTML: named by date and title, standalone, with contents and a dark mode it remembers", async ({
  page,
}) => {
  const dialog = await openExport(page, "Save as HTML", "RO");
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Save as HTML" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(
    /^\d{4}-\d{2}-\d{2}-Duminică\.html$/,
  );
  const path = join(
    mkdtempSync(join(tmpdir(), "norless-export-")),
    file.suggestedFilename(),
  );
  await file.saveAs(path);
  const html = readFileSync(path, "utf8");
  // Every refrain in full.
  expect(html.match(/Cântăm cu toții împreună/g)).toHaveLength(2);
  expect(html).not.toMatch(/(src|href)="(https?:)?\/\//);

  // Opened on a phone without internet.
  const offline = await page.context().newPage();
  await page.context().setOffline(true);
  await offline.goto(`file://${path}`);
  await offline.getByRole("link", { name: "Doar harul Tău" }).click();
  await expect(offline).toHaveURL(/#song-2$/);
  // In the export's language.
  await offline.getByRole("button", { name: /Luminos sau întunecat/ }).click();
  await offline.reload();
  await expect(offline.locator("html")).toHaveClass("dark");
  await page.context().setOffline(false);
});

test("print sends only the titles and lyrics to the browser's print", async ({
  page,
}) => {
  // The browser's print, in every frame: noted instead of shown, so the frame stays.
  await page.addInitScript(() => {
    window.print = () => {
      document.body.dataset.printed = "yes";
    };
  });
  const dialog = await openExport(page, "Print", "RO");
  const printed = page.waitForEvent("frameattached");
  await dialog.getByRole("button", { name: "Print" }).click();
  const frame = await printed;
  await expect(frame.locator("body[data-printed=yes]")).toHaveCount(1);
  expect(await frame.locator("h2").allTextContents()).toEqual([
    "Cuprins",
    "1. Lumina lumii",
    "2. Doar harul Tău",
  ]);
  await expect(dialog).toBeHidden();
});

test("members find a playlist's YouTube chapters in its menu; before a service there are none", async ({
  page,
}) => {
  await logInAs(page, "ana@example.com");
  const { body } = await api(
    page,
    "POST",
    "/api/communities/unu-unu/playlists",
    {
      title: "Fără serviciu încă",
    },
  );
  await page.goto(`/unu-unu/playlists/${(body as { id: string }).id}`);
  await page.getByRole("button", { name: "Playlist actions" }).click();
  await page.getByRole("menuitem", { name: "YouTube chapters" }).click();
  const dialog = page.getByRole("dialog", { name: "YouTube chapters" });
  await expect(dialog.getByText("No chapters yet")).toBeVisible();
});
