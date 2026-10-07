import { devices, expect, test } from "@playwright/test";
import { logInAs } from "./helpers";

test("a phone on the same wifi is offered the laptop's login, and logs it in as the community's laptop", async ({
  browser,
}) => {
  const phone = await (
    await browser.newContext({ ...devices["Pixel 7"] })
  ).newPage();
  await logInAs(phone, "dan@example.com");
  await phone.goto("/sala-mica");

  const laptop = await (await browser.newContext()).newPage();
  await laptop.goto("/login?next=%2Fsala-mica");
  await expect(
    laptop.getByRole("img", { name: "QR code to log in from your phone" }),
  ).toBeVisible();
  // The number to compare waits until a phone opens the code.
  await expect(laptop.getByTestId("device-number")).toHaveCount(0);

  // Norless open on the phone offers it; reviewing it shows the laptop the number.
  const offer = phone.getByRole("alert");
  await expect(offer).toContainText("Log in the laptop at Sala mică?");
  await offer.getByRole("button", { name: "Review" }).click();
  const number = (
    await laptop.getByTestId("device-number").textContent()
  )?.trim();
  expect(number).toMatch(/^\d\d$/);
  await expect(phone.getByText(number ?? "-", { exact: true })).toBeVisible();
  await phone
    .getByRole("button", { name: "As the community's laptop" })
    .click();
  await expect(phone.getByText("The device is logged in.")).toBeVisible();
  // What was logged in, where to manage it, and the way back.
  await expect(
    phone.getByText("It's logged in as the community's laptop."),
  ).toBeVisible();
  await expect(
    phone.getByRole("link", { name: /Your logged-in devices/ }),
  ).toHaveAttribute("href", "/account#devices");
  // Back to it later, it says so again, not that its code ran out.
  await phone.goto("/account");
  await phone.goBack();
  await expect(phone.getByText("The device is logged in.")).toBeVisible();

  // The laptop opens the community, logged in as its laptop, with the team role only.
  await expect(laptop).toHaveURL(/\/sala-mica$/);
  await laptop.goto("/account");
  await expect(laptop.getByRole("article")).toContainText("Laptop (Dan)");
  await expect(
    laptop.getByRole("button", { name: "Delete my account…" }),
  ).toHaveCount(0);

  // Dan sees it on My account, and ends it.
  await phone.goto("/account");
  const device = phone
    .getByRole("listitem")
    .filter({ hasText: "Laptop (Dan)" });
  await device.getByRole("button", { name: "End" }).click();
  await expect(device).toHaveCount(0);
  await laptop.reload();
  await expect(
    laptop.getByRole("link", { name: "Log in" }).first(),
  ).toBeVisible();
});

test("a guest musician: the band member's guest QR logs the guest's phone in, and so does approving the guest's own login page", async ({
  browser,
}) => {
  const small = { viewport: { width: 390, height: 844 } };
  const dan = await (await browser.newContext(small)).newPage();
  await logInAs(dan, "dan@example.com");
  await dan.goto("/account");
  const name = dan.getByRole("textbox", { name: "The guest's name" });
  // A phone's keyboard starts each word with a capital.
  await expect(name).toHaveAttribute("autocapitalize", "words");
  await name.fill("Vlad");
  const created = dan.waitForResponse(
    "/api/communities/sala-mica/guest-passes",
  );
  await dan.getByRole("button", { name: "Show a guest QR code" }).click();
  const { code } = (await (await created).json()) as { code: string };
  await expect(
    dan.getByRole("img", { name: "QR code for the guest's phone" }),
  ).toBeVisible();

  // Vlad's camera opens the QR's link: the QR goes from Dan's phone, and another phone
  // finds the pass gone.
  const vlad = await (await browser.newContext(small)).newPage();
  await vlad.goto(`/guest/${code}`);
  await expect(
    vlad.getByRole("heading", {
      name: "Log in as Vlad (guest of Dan) for 4 hours?",
    }),
  ).toBeVisible();
  await expect(
    dan.getByText("Opened on a phone. Waiting for Vlad to log in."),
  ).toBeVisible();
  await expect(
    dan.getByRole("img", { name: "QR code for the guest's phone" }),
  ).toHaveCount(0);
  const other = await (await browser.newContext(small)).newPage();
  await other.goto(`/guest/${code}`);
  await expect(other.getByText(/run out|expired/i).first()).toBeVisible();
  // A reload on Vlad's phone keeps it his.
  await vlad.reload();
  await vlad.getByRole("button", { name: "Log in" }).click();
  await expect(vlad).toHaveURL(/\/sala-mica\/musicians$/);
  await expect(
    dan.getByText(/^Vlad \(guest of Dan\) is in, until/),
  ).toBeVisible();
  await expect(
    dan.getByRole("listitem").filter({ hasText: "Vlad (guest of Dan)" }),
  ).toBeVisible();
  expect(
    await vlad.evaluate(
      async () => (await (await fetch("/api/me")).json()).user,
    ),
  ).toMatchObject({ displayName: "Vlad (guest of Dan)", device: "guest" });

  // Or Ilie's phone shows its login page, and Dan approves it as a guest.
  const ilie = await (await browser.newContext(small)).newPage();
  await ilie.goto("/login");
  // A phone's login page offers Google first; another phone is one of the other ways.
  await ilie.getByRole("button", { name: "Other ways to log in" }).click();
  await ilie.getByRole("button", { name: /Can't scan/ }).click();
  const shown = (await ilie.getByText(/type:/).textContent()) ?? "";
  await dan.goto("/login/device");
  await dan
    .getByRole("textbox", { name: "Code" })
    .fill(shown.replace(/\D/g, ""));
  await dan.getByRole("button", { name: "Continue" }).click();
  const number = ilie.getByTestId("device-number");
  await expect(number).toHaveText(/^\d\d$/);
  await expect(
    dan.getByText(await number.innerText(), { exact: true }),
  ).toBeVisible();
  const guestName = dan.getByRole("textbox", { name: "The guest's name" });
  await expect(guestName).toHaveAttribute("autocapitalize", "words");
  await guestName.fill("Ilie");
  await dan.getByRole("button", { name: "As a guest musician" }).click();
  await expect(dan.getByText("The device is logged in.")).toBeVisible();
  await expect(ilie).toHaveURL(/\/$/);
  await expect(
    ilie.getByRole("button", { name: "Ilie (guest of Dan)" }),
  ).toBeVisible();
});
