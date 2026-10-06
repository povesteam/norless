import { type Browser, expect, test } from "@playwright/test";
import { logInAs } from "./helpers";

// The "functii" community starts with only Classic's set; these tests switch features on
// and off, one after the other.
test.describe.configure({ mode: "serial" });

const playlist = "/functii/playlists/switches-sunday";
async function as(browser: Browser, email: string) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await logInAs(page, email);
  return page;
}

test("the owner switches features on and off; the team sees what's new once", async ({
  browser,
}) => {
  const team = await as(browser, "ioana@example.com");
  await team.goto(playlist);
  // Classic, and nothing to announce on a first visit.
  await expect(team.getByRole("button", { name: "Menu" })).toBeVisible();
  const bubble = team.getByRole("button", { name: /^What's new/ });
  await expect(bubble).toHaveCount(0);

  const owner = await as(browser, "ana@example.com");
  // The feature tree fits the laptop's window.
  await owner.goto("/functii/features");
  for (const corner of [
    /^Webhooks/,
    /^Church calendar/,
    /^Log in from a phone/,
  ])
    await expect(owner.getByRole("button", { name: corner })).toBeInViewport({
      ratio: 1,
    });
  // The laptop layouts, with the app menu they need.
  await owner.getByRole("button", { name: /^Laptop layouts/ }).click();
  const laptop = owner.getByRole("dialog");
  await expect(
    laptop.getByText("Switching it on also switches on: App menu"),
  ).toBeVisible();
  await laptop.getByText("On for everyone").click();
  await expect(
    laptop.getByRole("switch", { name: "On for everyone" }),
  ).toBeChecked();
  await laptop.getByRole("button", { name: "Close" }).click();

  await team.reload();
  await expect(bubble).toHaveAccessibleName("What's new: 2");
  await expect(
    team.getByRole("button", { name: "Layout: Controller" }),
  ).toBeVisible();
  // It starts at the left; dragged, it snaps to the nearer side, the right, and stays
  // there on this device.
  const left = async () => (await bubble.boundingBox())?.x ?? Infinity;
  await expect.poll(left).toBeLessThan(40);
  const from = await bubble.boundingBox();
  const width = team.viewportSize()?.width ?? 1280;
  await team.mouse.move((from?.x ?? 0) + 28, (from?.y ?? 0) + 28);
  await team.mouse.down();
  await team.mouse.move(width - 300, 420, { steps: 5 });
  await team.mouse.move(width - 250, 440, { steps: 5 });
  await team.mouse.up();
  await expect.poll(left).toBeGreaterThan(width - 100);
  await expect(team.getByRole("dialog")).toHaveCount(0);
  await team.reload();
  await expect.poll(left).toBeGreaterThan(width - 100);
  // Seen once its dialog opens, saved with the account.
  const saved = team.waitForResponse((r) =>
    r.url().endsWith("/api/me/preferences"),
  );
  await bubble.click();
  const news = team.getByRole("dialog");
  await expect(news).toContainText("New in Norless: App menu, Laptop layouts");
  await saved;
  await expect(bubble).toHaveCount(0);
  await news.getByRole("button", { name: "Got it" }).click();
  await expect(news).toHaveCount(0);
  await team.reload();
  await expect(
    team.getByRole("button", { name: "Layout: Controller" }),
  ).toBeVisible();
  await expect(bubble).toHaveCount(0);

  // The app menu off: no notice, and Classic again.
  await owner.getByRole("button", { name: /^App menu/ }).click();
  await owner.getByRole("dialog").getByText("On for everyone").click();
  await expect(
    owner.getByRole("dialog").getByRole("switch", { name: "On for everyone" }),
  ).not.toBeChecked();
  await owner
    .getByRole("dialog")
    .getByRole("button", { name: "Close" })
    .click();
  await team.reload();
  await expect(team.getByRole("button", { name: "Menu" })).toBeVisible();
  await expect(team.getByRole("button", { name: /^Layout/ })).toHaveCount(0);
  await expect(bubble).toHaveCount(0);
});

test("the owner unlocks a feature with its path in the tree, and a member asks for a planned one", async ({
  browser,
}) => {
  const team = await as(browser, "ioana@example.com");
  await team.goto(playlist);
  await expect(team.getByRole("button", { name: "Menu" })).toBeVisible();

  // Practice rooms need the laptop layouts (still on), which need the app menu (off).
  const owner = await as(browser, "ana@example.com");
  await owner.goto("/functii/features");
  await owner.getByRole("button", { name: /^Practice rooms/ }).click();
  const dialog = owner.getByRole("dialog");
  await expect(dialog.getByText("Needs Laptop layouts")).toBeVisible();
  await expect(
    dialog.getByText("Switching it on also switches on: App menu"),
  ).toBeVisible();
  await dialog.getByText("On for everyone").click();
  await expect(
    dialog.getByRole("switch", { name: "On for everyone" }),
  ).toBeChecked();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(
    owner.getByRole("button", { name: "Laptop layouts, On" }),
  ).toBeVisible();

  // The team saw the menu and the layouts before, so only practice rooms are new.
  await team.reload();
  await expect(
    team.getByRole("button", { name: "Layout: Controller" }),
  ).toBeVisible();
  const seen = team.waitForResponse((r) =>
    r.url().endsWith("/api/me/preferences"),
  );
  await team.getByRole("button", { name: "What's new: 1" }).click();
  const news = team.getByRole("dialog");
  await expect(news).toContainText("New in Norless: Practice rooms");
  await seen;
  // Its name opens the feature in the tree.
  await news.getByRole("link", { name: "Practice rooms" }).click();
  await expect(team).toHaveURL("/functii/features?feature=practiceRooms");
  await expect(
    team.getByRole("dialog").getByRole("heading", { name: "Practice rooms" }),
  ).toBeVisible();
  await team.keyboard.press("Escape");

  // A member asks for a feature that's still planned; the owners read it with the ideas.
  await team.goto("/functii/features");
  await team.getByRole("button", { name: /^Chords from a piano/ }).click();
  const ask = team.getByRole("dialog");
  await ask
    .getByLabel("Why you'd like it (optional)")
    .fill("For the new piano");
  await ask.getByRole("button", { name: "Ask the owners" }).click();
  await expect(ask.getByText("1 asked")).toBeVisible();
  await ask.getByRole("button", { name: "Close" }).click();
  await expect(
    team.getByRole("button", { name: /^Chords from a piano.*1 asked/ }),
  ).toBeVisible();
  await owner.goto("/functii/ideas");
  const asked = owner.getByRole("region", { name: "Asked-for features" });
  await expect(asked.getByText("Chords from a piano")).toBeVisible();
  await expect(asked.getByText(": For the new piano")).toBeVisible();

  // The app menu off again: Classic, and practice rooms locked.
  await owner.goto("/functii/features");
  await owner.getByRole("button", { name: /^App menu/ }).click();
  await owner.getByRole("dialog").getByText("On for everyone").click();
  await owner
    .getByRole("dialog")
    .getByRole("button", { name: "Close" })
    .click();
  await expect(
    owner.getByRole("button", {
      name: /^Practice rooms.*Needs Laptop layouts/,
    }),
  ).toBeVisible();
  await team.goto(playlist);
  await expect(team.getByRole("button", { name: "Menu" })).toBeVisible();
});

test("light and dark follow the system, Classic included", async ({
  browser,
}) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto(playlist);
  await expect(page.getByRole("grid", { name: "Entries" })).toBeVisible();
  await expect(page.locator("html")).toHaveClass(/dark/);
  // The page's background is dark too, not just its text.
  const background = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  );
  const [r = 255, g = 255, b = 255] =
    background.match(/\d+/g)?.map(Number) ?? [];
  expect(r + g + b).toBeLessThan(200);
});

test("in Classic a song's page has no history; it comes with its switch", async ({
  browser,
}) => {
  const team = await as(browser, "ioana@example.com");
  const { entries } = await team.evaluate(async (url) => {
    const response = await fetch(url);
    return (await response.json()) as { entries: { song?: { id: string } }[] };
  }, "/api/communities/functii/playlists/switches-sunday");
  const song = entries.find((e) => e.song)?.song?.id;
  expect(song).toBeTruthy();
  await team.goto(`/functii/songs/${song}`);
  await expect(team.getByRole("heading", { level: 2 })).toBeVisible();
  // History is in the song's ⋯ menu only where its feature is on.
  const more = team.getByRole("button", { name: "More actions" });
  if (await more.count()) {
    await more.click();
    await expect(team.getByRole("menuitem", { name: "History" })).toHaveCount(
      0,
    );
  }
});
