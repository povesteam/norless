import { devices, expect, type Page, test } from "@playwright/test";
import { api, logInAs, withoutPhoneLogin } from "./helpers";

/** Logs in through the login page, with the pretend Google of development. */
async function logIn(page: Page, email: string) {
  await withoutPhoneLogin(page);
  await page.getByRole("link", { name: "Log in" }).click();
  await page.getByRole("button", { name: "Other ways to log in" }).click();
  await page.getByRole("link", { name: "Continue with Google" }).click();
  await expect(page.getByText(/this isn't Google/)).toBeVisible();
  await page.getByLabel("Another account's email").fill(email);
  await page.getByRole("button", { name: "Continue" }).click();
}

test("a member logs in, stays logged in, and logs out", async ({ page }) => {
  await page.goto("/unu-unu/playlists/steady");
  await logIn(page, "ana@example.com");

  // Back where they started, logged in.
  await expect(page).toHaveURL("/unu-unu/playlists/steady");
  await expect(
    page.getByRole("link", { name: "Ana", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Ask your community for an invitation"),
  ).toBeHidden();
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Ana", exact: true }),
  ).toBeVisible();

  // Logging out is on My account's Logins, and asks first.
  await page.getByRole("link", { name: "Ana", exact: true }).click();
  await page.getByRole("tab", { name: "Logins" }).click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Log out of Norless?" });
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toBeHidden();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await confirm.getByRole("button", { name: "Log out" }).click();
  await expect(
    page.getByRole("link", { name: "Log in" }).first(),
  ).toBeVisible();
});

test("someone who isn't a member is asked to get an invitation", async ({
  page,
}) => {
  await page.goto("/unu-unu");
  await logIn(page, "stranger@example.com");

  await expect(page.getByRole("link", { name: "stranger" })).toBeVisible();
  await expect(
    page.getByText("Ask your community for an invitation to edit or control."),
  ).toBeVisible();
});

test("an imported person who wasn't invited can't log in yet", async ({
  page,
}) => {
  await page.goto("/unu-unu");
  await logIn(page, "ion@example.com");

  await expect(
    page.getByText("Ask your community for an invitation to edit or control."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test("back from Google without a login, the login page says why", async ({
  page,
}) => {
  await withoutPhoneLogin(page);
  await page.goto("/login?google=unverified");
  await expect(
    page.getByText(/Google hasn't verified this account's email/),
  ).toBeVisible();
});

test("logging out can end the sessions on the other devices too", async ({
  browser,
}) => {
  const phone = await (await browser.newContext()).newPage();
  const laptop = await (await browser.newContext()).newPage();
  // Its own person: logging out everywhere would end other tests' sessions.
  for (const page of [phone, laptop])
    await logInAs(page, "two-devices@example.com");
  await laptop.goto("/account/logins");
  await laptop.getByRole("button", { name: "Log out", exact: true }).click();
  const confirm = laptop.getByRole("dialog", { name: "Log out of Norless?" });
  await confirm.getByText("Also on my other devices").click();
  await confirm.getByRole("button", { name: "Log out" }).click();
  await expect(
    laptop.getByRole("link", { name: "Log in" }).first(),
  ).toBeVisible();
  const me = await api(phone, "GET", "/api/me");
  expect((me.body as { user: unknown }).user).toBeNull();
});

test("a laptop shows the QR first, the code only on asking, and the other ways one tap away", async ({
  page,
}) => {
  await page.goto("/login");
  const qr = page.getByRole("img", {
    name: "QR code to log in from your phone",
  });
  await expect(qr).toBeVisible();
  // In a card in the middle, without a Log in link of its own.
  const box = await qr.boundingBox();
  const middle = (page.viewportSize()?.width ?? 0) / 2;
  // Centered in its card.
  expect(Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - middle)).toBeLessThan(
    4,
  );
  await expect(page.getByRole("link", { name: "Log in" })).toHaveCount(0);
  await expect(page.getByText(/under Log in another device/)).toHaveCount(0);
  await expect(page.getByTestId("device-number")).toHaveCount(0);
  await expect(page.getByLabel("Email")).toHaveCount(0);
  await page.getByRole("button", { name: /Can't scan/ }).click();
  await expect(page.getByText(/under Log in another device/)).toBeVisible();
  await page.getByRole("button", { name: "Other ways to log in" }).click();
  // In the QR's place, all within the window.
  await expect(qr).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Continue with Google" }),
  ).toBeInViewport();
  await expect(page.getByLabel("Email")).toBeInViewport();
  await page.getByRole("button", { name: "Log in with your phone" }).click();
  await expect(qr).toBeVisible();
});

test("My account leads back to the community this device opened", async ({
  page,
}) => {
  await logInAs(page, "maria@example.com");
  await page.goto("/unu-unu/playlists");
  // The community remembered once it has loaded.
  await expect(
    page.getByRole("link", { name: "Unu-Unu" }).first(),
  ).toBeVisible();
  await page.goto("/account");
  await page.getByRole("link", { name: "Back to Unu-Unu" }).click();
  await expect(page).toHaveURL(/\/unu-unu/);
});

test.describe("on a phone", () => {
  const { viewport, isMobile, hasTouch, userAgent } = devices["Pixel 7"];
  test.use({ viewport, isMobile, hasTouch, userAgent });

  test("Google first, email and another phone under Other ways; in development the email's link shows here", async ({
    page,
  }) => {
    await withoutPhoneLogin(page);
    await page.goto("/login?next=%2Funu-unu%2Fplaylists%2Fsteady");
    await expect(
      page.getByRole("link", { name: "Continue with Google" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveCount(0);
    await expect(
      page.getByRole("img", { name: "QR code to log in from your phone" }),
    ).toHaveCount(0);

    // The other ways take Google's place, and Google is a tap back.
    const otherWays = page.getByRole("button", {
      name: "Other ways to log in",
    });
    await otherWays.click();
    await expect(
      page.getByRole("link", { name: "Continue with Google" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page.getByLabel("Email")).toHaveCount(0);
    await otherWays.click();
    await page.getByLabel("Email").fill("ana@example.com");
    await page.getByRole("button", { name: "Email me a login link" }).click();
    await expect(page.getByText(/link Norless would email/)).toBeVisible();
    await page.getByRole("link", { name: "Open the link" }).click();
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL("/unu-unu/playlists/steady");
  });
});

test.describe("on a phone, with Google set up", () => {
  const { viewport, isMobile, hasTouch, userAgent } = devices["Pixel 7"];
  test.use({ viewport, isMobile, hasTouch, userAgent });

  test("Continue with Google shows it's loading until Google comes", async ({
    page,
  }) => {
    await withoutPhoneLogin(page);
    // As in production, with Google's script held back, as on a slow phone.
    await page.route("**/api/auth/methods", async (route) => {
      const methods = (await (await route.fetch()).json()) as object;
      await route.fulfill({
        json: { ...methods, google: true, fakeGoogle: false },
      });
    });
    await page.route("https://accounts.google.com/**", () => {});
    await page.goto("/login");
    const google = page.getByRole("link", { name: "Continue with Google" });
    await expect(google).not.toHaveAttribute("aria-busy", "true");
    await google.click();
    await expect(google).toHaveAttribute("aria-busy", "true");
    await expect(page).toHaveURL(/\/login/);
  });
});

/** A 1×1 PNG, as a phone's photo would arrive. */
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);

test("a photo uploaded on My account shows on the account button; initials take it away", async ({
  page,
}) => {
  await logInAs(page, "eva@example.com");
  await page.goto("/account/profile");
  await expect(
    page.getByText("A Google login brings your Google photo"),
  ).toBeVisible();
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "eva.png", mimeType: "image/png", buffer: pixel });
  await expect(page.getByText("Your own photo.")).toBeVisible();
  const photo = page.getByRole("banner").locator('img[src^="/api/images/"]');
  await expect(photo).toBeVisible();

  await page.getByRole("button", { name: "Use my initials" }).click();
  await expect(
    page.getByText("Your initials: no photo is kept."),
  ).toBeVisible();
  await expect(photo).toHaveCount(0);

  // Google's photo again: it comes at the next Google login.
  await page.getByRole("button", { name: "Use my Google photo" }).click();
  await expect(
    page.getByText("A Google login brings your Google photo"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Use my Google photo" }),
  ).toHaveCount(0);
});

test("a member sees where they're logged in, and logs out another place from here", async ({
  page,
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    baseURL,
    userAgent:
      "Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0",
  });
  const phone = await context.newPage();
  await logInAs(phone, "luca@example.com");
  await phone.goto("/unu-unu");

  await logInAs(page, "luca@example.com");
  await page.goto("/account/logins");
  const places = page.getByRole("region", { name: "Where you're logged in" });
  // This device first; the phone by its browser, last used today.
  await expect(places.getByRole("listitem").first()).toContainText(
    "this device",
  );
  const android = places
    .getByRole("listitem")
    .filter({ hasText: "Firefox on Android" });
  await expect(android).toContainText("used today");
  await android
    .getByRole("button", { name: "Log out of Firefox on Android" })
    .click();
  await expect(android).toHaveCount(0);
  // The phone is logged out.
  await phone.reload();
  await expect(
    phone.getByRole("link", { name: "Log in" }).first(),
  ).toBeVisible();
  await context.close();
});
