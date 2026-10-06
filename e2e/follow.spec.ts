import { type Page } from "@playwright/test";
import { api, expect, logInAs, test } from "./helpers";

test.describe.configure({ mode: "serial" });

const live = (page: Page, action: object) =>
  api(page, "POST", "/api/communities/urmarim/live", action);

/** A song in both languages, live in follow-along's community, sent by Radu (team). */
async function liveSong(page: Page) {
  await logInAs(page, "maria@example.com");
  const song = await api(page, "POST", "/api/communities/urmarim/songs", {
    versions: [
      {
        language: "ro",
        title: "Cântați Domnului",
        text: "1:\nCântați Domnului toți\n\nR:\nAleluia, aleluia",
      },
      {
        language: "uk",
        title: "Співайте Господу",
        text: "1:\nСпівайте Господу всі\n\nR:\nАлілуя, алілуя",
      },
    ],
  });
  await logInAs(page, "radu@example.com");
  const playlist = await api(
    page,
    "POST",
    "/api/communities/urmarim/playlists",
    {
      title: "Duminică",
    },
  );
  const playlistId = (playlist.body as { id: string }).id;
  const entry = await api(
    page,
    "POST",
    `/api/communities/urmarim/playlists/${playlistId}/entries`,
    { kind: "song", songId: (song.body as { id: string }).id },
  );
  const entryId = (entry.body as { id: string }).id;
  expect((await live(page, { type: "go", entryId })).status).toBe(200);
  return entryId;
}

test("a visitor follows the live song on a phone, in both languages, without controls", async ({
  page,
  browser,
}) => {
  const entryId = await liveSong(page);
  const visitor = await (await browser.newContext()).newPage();

  // The community's address opens follow-along while something is live.
  await visitor.goto("/urmarim");
  await expect(visitor).toHaveURL(/\/urmarim\/follow$/);
  await expect(visitor.getByText("Cântați Domnului toți")).toBeVisible();
  await expect(visitor.getByText("Співайте Господу всі")).toHaveCount(0);
  await visitor.getByRole("radio", { name: "Both" }).click();
  await expect(visitor.getByText("Співайте Господу всі")).toBeVisible();

  const parts = visitor
    .getByRole("list", { name: "Parts" })
    .getByRole("listitem");
  await live(page, { type: "go", entryId, slide: 1 });
  await expect(parts.nth(1)).toHaveAttribute("aria-current", "true");

  // A tap on a part sends nothing live.
  await parts.first().click();
  const now = await api(page, "GET", "/api/communities/urmarim/live");
  expect(now.body).toMatchObject({ slide: 1 });
  // Visitors never get members' names.
  const asVisitor = await api(visitor, "GET", "/api/communities/urmarim/live");
  expect(asVisitor.body).toMatchObject({ changedBy: null });
});

test("a start page shows the QR code to follow along", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ana@example.com");
  const created = await api(page, "POST", "/api/communities/urmarim/pages", {
    name: "Start",
    url: "https://norless.test/start",
  });
  const pageId = (created.body as { id: string }).id;
  await page.goto("/urmarim/settings/pages");
  await page.getByText("QR code to follow along").click();
  await expect(
    page.getByRole("switch", { name: "QR code to follow along" }),
  ).toBeChecked();

  await logInAs(page, "radu@example.com");
  const projector = await (await browser.newContext()).newPage();
  await projector.goto("/urmarim/projector/ro");
  await live(page, { type: "page", pageId });
  await expect(
    projector.getByRole("img", {
      name: "QR code: follow the songs on your phone",
    }),
  ).toBeVisible();
  await expect(projector.getByText(/\/urmarim$/)).toBeVisible();
  await live(page, { type: "page", pageId: null });
});

test("a phone following along loads the follow page's code, not the whole app", async ({
  browser,
}) => {
  const phone = await (await browser.newContext()).newPage();
  let script = 0;
  phone.on("response", (response) => {
    if (/\/assets\/.+\.js$/.test(response.url()))
      void response.body().then((body) => (script += body.length));
  });
  await phone.goto("/urmarim/follow");
  await expect(phone.getByRole("radio", { name: "RO" })).toBeVisible();
  await phone.waitForLoadState("networkidle");
  // About 650 kB (uncompressed) in October 2026; the whole app was 1.7 MB.
  expect(script).toBeLessThan(800_000);
});
