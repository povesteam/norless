import { expect, type Page, test } from "@playwright/test";
import type { UsageBatch } from "../src/shared/usage";
import { api, logInAs } from "./helpers";

/** Hides the page, which sends the queued usage events, and returns them. */
async function sentEvents(page: Page) {
  const request = page.waitForRequest("/api/usage");
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const sent = await request;
  expect((await sent.response())?.status()).toBe(204);
  return (sent.postDataJSON() as UsageBatch).events;
}

test.use({ viewport: { width: 1440, height: 900 } });

test("a double-click that sends a song live is counted as live.go via double-click, with the Classic layout", async ({
  page,
}) => {
  // Sala mică, at Classic, so its live state and Dan's preferences are this test's own.
  await logInAs(page, "dan@example.com");
  const { body: song } = await api(
    page,
    "POST",
    "/api/communities/sala-mica/songs",
    {
      versions: [
        {
          language: "ro",
          title: "Lumina lumii",
          text: "1:\nO stea\n\n2:\nE noapte",
        },
      ],
    },
  );
  const base = "/api/communities/sala-mica/playlists";
  const { body } = await api(page, "POST", base, { title: "Counted" });
  const id = (body as { id: string }).id;
  await api(page, "POST", `${base}/${id}/entries`, {
    kind: "song",
    songId: (song as { id: string }).id,
  });
  await page.goto(`/sala-mica/playlists/${id}`);
  const row = page
    .getByRole("grid", { name: "Entries" })
    .getByRole("row")
    .filter({ hasText: "Lumina lumii" });
  await row.dblclick();
  await expect(row).toContainText("Live");
  await page.keyboard.press("PageDown");

  const events = await sentEvents(page);
  expect(events).toContainEqual(
    expect.objectContaining({
      feature: "layout.shown",
      community: "sala-mica",
      layout: "classic",
      detail: { view: "playlist" },
    }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      feature: "live.go",
      community: "sala-mica",
      layout: "classic",
      detail: { via: "double-click" },
    }),
  );
  expect(events).toContainEqual(
    expect.objectContaining({
      feature: "live.next",
      detail: { via: "clicker" },
    }),
  );
});

test("switched off on My account, the next event is kept without the member; the app team reads usage from My account", async ({
  page,
  browser,
}) => {
  await logInAs(page, "counted@example.com");
  const marker = String(Math.random());
  const count = (step: string) =>
    api(page, "POST", "/api/usage", {
      deviceType: "laptop",
      events: [
        {
          feature: "error.shown",
          community: "clasic",
          ago: 0,
          detail: { marker, step },
        },
      ],
    });
  expect((await count("on")).status).toBe(204);

  await page.goto("/account/profile");
  const counting = page.getByRole("switch", {
    name: "Help improve Norless: count how I use it",
  });
  await expect(counting).toBeChecked();
  const saved = page.waitForResponse("/api/me/preferences");
  await page.getByText("Help improve Norless: count how I use it").click();
  expect((await saved).status()).toBe(204);
  await expect(counting).not.toBeChecked();
  expect((await count("off")).status).toBe(204);

  const team = await (await browser.newContext()).newPage();
  await logInAs(team, "app-team@example.com");
  const { body } = await api(
    team,
    "GET",
    "/api/app-usage/events?community=clasic",
  );
  const mine = (
    body as { userId: string | null; name: string | null; detail: string }[]
  ).filter((e) => e.detail.includes(marker));
  expect(mine.map((e) => [JSON.parse(e.detail).step, e.name])).toEqual([
    ["on", "counted"],
    ["off", null],
  ]);

  // The app team's page, from My account.
  await team.goto("/account/about");
  await team.getByRole("link", { name: "Usage" }).click();
  await expect(team).toHaveURL(/\/app-usage$/);
  await expect(
    team.getByRole("heading", { name: "Not used in 30 days" }),
  ).toBeVisible();
  await expect(team.getByText("Clasic", { exact: true })).toBeVisible();
  await team.getByRole("button", { name: /Feature/ }).click();
  await team.getByRole("option", { name: "error.shown" }).click();
  await expect(team.getByRole("table")).toContainText("Total");
  await expect(
    team.getByRole("link", { name: "Download CSV" }),
  ).toHaveAttribute("href", "/api/app-usage/events.csv");

  // Nobody else sees it.
  expect((await api(page, "GET", "/api/app-usage")).status).toBe(403);
});
