import { expect, logInAs, test } from "./helpers";

test.use({ viewport: { width: 1440, height: 900 } });

test("a member sends an idea from the menu; the owner reads and archives it", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ioana@example.com");
  await page.goto("/clasic/playlists/classic-sunday");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Ideas and feedback" }).click();
  await page
    .getByRole("textbox", { name: "Your idea, or what could work better" })
    .fill("Aș vrea tonalitatea următoarei cântări.");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(/Thank you!/)).toBeVisible();
  // Its own Close, not the menu's behind it.
  await page
    .getByRole("dialog")
    .filter({ hasText: /Thank you!/ })
    .getByRole("button", { name: "Close" })
    .click();

  const owner = await (await browser.newContext()).newPage();
  await logInAs(owner, "ana@example.com");
  await owner.goto("/clasic/ideas");
  const idea = owner
    .getByRole("listitem")
    .filter({ hasText: "Aș vrea tonalitatea următoarei cântări." });
  await expect(idea).toContainText("Ioana");
  await expect(idea).toContainText("/clasic/playlists/classic-sunday");
  await idea.getByRole("button", { name: "Archive" }).click();
  await expect(idea).toHaveCount(0);
  await owner.getByText("Show archived").click();
  await expect(idea).toBeVisible();
});

test("owners find Ideas and feedback once in the menu, and send theirs from the Ideas page", async ({
  page,
}) => {
  await logInAs(page, "ana@example.com");
  await page.goto("/clasic/playlists/classic-sunday");
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(page.getByText("Ideas and feedback")).toHaveCount(1);
  await page.getByRole("link", { name: "Ideas and feedback" }).click();
  await page.getByRole("button", { name: "Send an idea" }).click();
  await page
    .getByRole("textbox", { name: "Your idea, or what could work better" })
    .fill("Ideea proprietarului");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(/Thank you!/)).toBeVisible();
});

test("visitors have no feedback box, and the team can't read the ideas", async ({
  page,
}) => {
  await page.goto("/clasic/playlists/classic-sunday");
  await page.getByRole("button", { name: "Menu" }).click();
  await expect(
    page.getByRole("button", { name: "Ideas and feedback" }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");

  await logInAs(page, "ioana@example.com");
  await page.goto("/clasic/ideas");
  await expect(
    page.getByText("Only owners can read the ideas and feedback."),
  ).toBeVisible();
});

test("a member sends an idea to the Norless app team, who read it on their own page", async ({
  page,
  browser,
}) => {
  // Maria: Ioana's ideas in the other tests would make her wait 10 seconds.
  await logInAs(page, "maria@example.com");
  await page.goto("/clasic/playlists/classic-sunday");
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Ideas and feedback" }).click();
  await page.getByText("The Norless app team").click();
  await page
    .getByRole("textbox", { name: "Your idea, or what could work better" })
    .fill("Un mod pentru concerte.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText(/people who make Norless/)).toBeVisible();

  const team = await (await browser.newContext()).newPage();
  await logInAs(team, "app-team@example.com");
  await team.goto("/");
  await team.goto("/app-ideas");
  const idea = team
    .getByRole("listitem")
    .filter({ hasText: "Un mod pentru concerte." });
  await expect(idea).toContainText("Maria");
  await expect(idea).toContainText("Clasic");

  // The community's owners don't get it.
  const owner = await (await browser.newContext()).newPage();
  await logInAs(owner, "ana@example.com");
  await owner.goto("/clasic/ideas");
  await expect(owner.getByText("Un mod pentru concerte.")).toHaveCount(0);
});
