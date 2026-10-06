// The welcome page, in Big screen's community "ecran-mare", whose
// room only the tests of this project change, one at a time.
import { api, expect, logInAs, test } from "../helpers";

const base = "/api/communities/ecran-mare";

test("owners write announcements; the team puts the welcome page up with a countdown, and a song takes it down", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ana@example.com");
  await page.goto("/ecran-mare/settings/pages");
  await page
    .getByLabel("Announcements")
    .fill("**Bine ați venit!**\n\nJoi la 19:00: repetiție");
  await page.getByRole("button", { name: "Save" }).first().click();
  await expect
    .poll(() =>
      api(page, "GET", `${base}/welcome`).then(
        ({ body }) => (body as { announcements: string[] }).announcements,
      ),
    )
    .toEqual(["**Bine ați venit!**", "Joi la 19:00: repetiție"]);
  // A service in an hour and a half.
  const start = new Date(Date.now() + 90 * 60_000);
  const local = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Bucharest",
      hourCycle: "h23",
      ...options,
    }).format(start);
  await api(page, "POST", `${base}/schedule`, {
    name: "Serviciu de seară",
    type: "service",
    kind: "one_off",
    date: local({ year: "numeric", month: "2-digit", day: "2-digit" }),
    startTime: local({ hour: "2-digit", minute: "2-digit" }),
    endTime: "23:59",
  });

  await logInAs(page, "ioana@example.com");
  await page.goto("/ecran-mare/playlists/big-sunday");
  const projector = await (await browser.newContext()).newPage();
  await projector.goto("/ecran-mare/projector/ro");
  await page.getByRole("button", { name: "Pages" }).click();
  await page.getByRole("menuitemradio", { name: "Welcome" }).click();
  await expect(
    projector.getByRole("heading", { name: "Ecran mare" }),
  ).toBeVisible();
  await expect(
    projector.getByText(/^Serviciu de seară starts in 1:29:\d\d$/),
  ).toBeVisible();
  await expect(
    projector.getByText(/Bine ați venit!|Joi la 19:00/),
  ).toBeVisible();
  // The button names it while it's up; a song takes it down.
  await expect(page.getByRole("button", { name: /Welcome/ })).toBeVisible();
  await api(page, "POST", `${base}/live`, { type: "go", entryId: "big-e1" });
  await expect(
    projector.getByRole("heading", { name: "Ecran mare" }),
  ).toHaveCount(0);
});
