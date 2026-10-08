import { expect, test } from "@playwright/test";
import {
  api,
  logInAs,
  openFromBar,
  openSteadyPage,
  withoutPhoneLogin,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await logInAs(page, "ana@example.com");
  await page.goto("/unu-unu");
  // Under the settings, their first tab.
  await openFromBar(page, "Settings");
  await expect(page.getByRole("tab", { name: "Members" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("heading", { name: "Members" })).toBeVisible();
});

test("the owner invites an imported person with a role", async ({ page }) => {
  await page.getByRole("button", { name: /Roles of Vasile/ }).click();
  await page.getByRole("option", { name: "Team" }).click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("row", { name: /Vasile/ })
    .getByRole("button", { name: "Invite" })
    .click();

  const row = page.getByRole("row", { name: /Vasile/ });
  await expect(row.getByText("Invited")).toBeVisible();
  // Removing is in the row's ⋯ menu, not a button on every row.
  await expect(row.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await row.getByRole("button", { name: "Actions: Vasile" }).click();
  await expect(page.getByRole("menuitem", { name: "Remove" })).toBeVisible();
  await page.keyboard.press("Escape");
});

test("the owner deletes an imported account", async ({ page }) => {
  page.once("dialog", (dialog) => void dialog.accept());
  await page
    .getByRole("row", { name: /Petru/ })
    .getByRole("button", { name: "Actions: Petru" })
    .click();
  await page.getByRole("menuitem", { name: "Delete" }).click();

  await expect(page.getByText("Petru")).toHaveCount(0);
});

test("the owner invites someone new and changes their roles", async ({
  page,
}) => {
  await page.getByRole("textbox", { name: "Email" }).fill("nou@example.com");
  await page.getByRole("button", { name: /Roles$/ }).click();
  await page.getByRole("option", { name: "Editor" }).click();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Invite", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("row", { name: /nou@example.com/ }),
  ).toBeVisible();
  // They get an email with a login link to the community.
  await expect(
    page.getByText("Invited: nou@example.com gets an email with a login link."),
  ).toBeVisible();
  const mail = (await (
    await page.request.get("/api/auth/dev-mail?to=nou@example.com")
  ).json()) as { subject: string; text: string };
  expect(mail.subject).toBe("Ana invited you to Unu-Unu on Norless");
  expect(mail.text).toMatch(/\/login\/link\//);

  await page.getByRole("button", { name: /Roles of nou/ }).click();
  // The invitation's role list may still be closing.
  await page
    .getByRole("listbox", { name: /Roles of nou/ })
    .getByRole("option", { name: "Team" })
    .click();
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(
    page.getByRole("row", { name: /nou@example.com/ }),
  ).toContainText("Team");
});

test("the last owner can't drop their owner role", async ({ page }) => {
  await page.getByRole("button", { name: /Roles of Ana/ }).click();
  await page.getByRole("option", { name: "Editor" }).click();
  await page.getByRole("option", { name: "Owner" }).click(); // deselects it
  await page.keyboard.press("Escape");

  await expect(page.getByText("The community needs an owner")).toBeVisible();
  await expect(page.getByRole("row", { name: /Ana/ })).toContainText("Owner");
});

test("members who aren't owners can't manage members", async ({ page }) => {
  await logInAs(page, "maria@example.com");
  await page.goto("/unu-unu");
  await expect(page.getByRole("link", { name: "Members" })).toHaveCount(0);

  // The old address leads to the settings, for owners only.
  await page.goto("/unu-unu/members");
  await expect(page).toHaveURL(/\/unu-unu\/settings\/members$/);
  await expect(
    page.getByText("Only owners can change the settings."),
  ).toBeVisible();
});

test("members see who is online, and on which device", async ({
  page,
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) Mobile/15E148",
  });
  const phone = await context.newPage();
  await logInAs(phone, "marta@example.com");
  await phone.goto("/unu-unu");

  // In a playlist's title row.
  await openSteadyPage(page);
  // Avatars only, the name and devices in a tooltip.
  const online = page.getByRole("group", { name: "Online" });
  // Marta, whom no other test logs in.
  const marta = online.getByLabel(/^Marta · phone/);
  await expect(marta).toBeVisible();
  await expect(marta).toHaveText(/^[A-Z]{1,2}$/);
  // Never oneself, even on another computer.
  await expect(online.getByLabel(/^Ana/)).toHaveCount(0);
  // React Aria shows tooltips on hover once a pointer was used on the page.
  await page.mouse.click(0, 0);
  // Others' tests bring Ana or Ioana online or offline, moving Marta from under the
  // mouse before her tooltip opens: hover her again until it does.
  await expect(async () => {
    await marta.hover();
    await expect(page.getByRole("tooltip")).toHaveText(/^Marta · phone/, {
      timeout: 1000,
    });
  }).toPass();

  await context.close();
  await expect(online.getByLabel(/^Marta/)).toBeHidden();
});

test("someone deletes their own account from My account", async ({ page }) => {
  await logInAs(page, "leaving@example.com");
  await openSteadyPage(page);
  // The photo opens My account, where deleting is apart from the rest.
  await page.getByRole("link", { name: "leaving", exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete my account…" }).click();
  await expect(
    page.getByRole("link", { name: "Log in" }).first(),
  ).toBeVisible();
  // Logged out everywhere.
  const me = await api(page, "GET", "/api/me");
  expect((me.body as { user: unknown }).user).toBeNull();
});

test("someone logs in with an email link, once", async ({ page }) => {
  await withoutPhoneLogin(page);
  await page.goto("/login?next=/unu-unu/playlists");
  await page.getByRole("button", { name: "Other ways to log in" }).click();
  const form = page.locator("form").filter({
    has: page.getByRole("button", { name: "Email me a login link" }),
  });
  await form.getByLabel("Email").fill("ioana@example.com");
  await form.getByRole("button", { name: "Email me a login link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  // The email the link would have been sent in, kept by the dev login.
  const mail = (await (
    await page.request.get("/api/auth/dev-mail?to=ioana@example.com")
  ).json()) as { text: string };
  const link = /http\S+\/login\/link\/\S+/.exec(mail.text)?.[0] ?? "";
  await page.goto(link);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL("/unu-unu/playlists");
  await expect(
    page.getByRole("link", { name: "Ioana", exact: true }),
  ).toBeVisible();

  await page.goto(link);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByText("This login link has expired")).toBeVisible();
});
