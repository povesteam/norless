import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { type Page } from "@playwright/test";
import { expect, logInAs, test } from "./helpers";

test.use({ serviceWorkers: "allow" });

// The built service worker as it was, for the other tests.
let original = "";
test.beforeAll(() => {
  original = readFileSync(worker, "utf8");
});
test.afterAll(() => writeFileSync(worker, original));

const worker = fileURLToPath(new URL("../dist/client/sw.js", import.meta.url));

/**
 * Deploys a new version: the server's service worker changes, and the pages ask for it,
 * as they do when the live connection comes back after a deploy.
 */
async function deploy(pages: Page[]) {
  appendFileSync(worker, "\n// a new version\n");
  for (const page of pages)
    await page
      .evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.update();
      })
      // An idle screen may already be reloading into the new version the page before found.
      .catch((error: Error) => {
        if (!error.message.includes("Execution context was destroyed"))
          throw error;
      });
}

test("a new version: members see a notice and reload when they choose; an idle screen reloads by itself", async ({
  page,
  context,
}) => {
  await logInAs(page, "maria@example.com");
  await page.goto("/unu-unu/playlists/steady");
  await page.evaluate(() => navigator.serviceWorker.ready);
  const screen = await context.newPage();
  await screen.goto("/unu-unu/projector/ro");
  const reloaded = screen.waitForEvent("load");

  await deploy([page, screen]);
  const notice = page.getByRole("region", { name: "New version" });
  await expect(notice).toContainText("A new version of Norless is ready.");
  // Nothing live in Unu-Unu's room, and no service: the projector took it by itself.
  await reloaded;
  await expect(screen.getByRole("region", { name: "New version" })).toHaveCount(
    0,
  );

  await notice.getByRole("button", { name: "Reload" }).click();
  await expect(page.getByRole("grid", { name: "Entries" })).toBeVisible();
  await expect(notice).toHaveCount(0);
});
