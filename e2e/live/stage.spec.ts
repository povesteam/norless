import { expect, test } from "@playwright/test";
import {
  api,
  createSong,
  expectTitleSafe,
  logInAs,
  openFromBar,
  pickLayout,
} from "../helpers";
import { base, rows, servicePlaylist } from "./playlist";

// Every test here changes the one room's live state, so they run one after another.
test.describe.configure({ mode: "serial" });

test("the stage monitor shows the current and next part, messages, and the sermon's countdown", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ana@example.com");
  const { body } = await api(page, "POST", "/api/communities/unu-unu/screens", {
    name: "Monitor",
    type: "stage",
    languages: ["ro"],
  });
  const secret = (body as { secret: string }).secret;
  const { body: list } = await api(page, "POST", base, { title: "Cu predică" });
  const id = (list as { id: string }).id;
  for (const entry of [
    { kind: "song", songId: "grace" },
    { kind: "divider", text: "Predica", plannedMinutes: 45 },
    { kind: "song", songId: "isus" },
  ])
    await api(page, "POST", `${base}/${id}/entries`, entry);

  const stage = await browser.newPage();
  await stage.goto(`/s/${secret}`);
  const projector = await browser.newPage();
  await projector.goto("/unu-unu/projector/ro");
  // The musicians see the messages too, and so does the stage monitor opened from the
  // menu, without a screen set up.
  const musicians = await browser.newPage();
  await musicians.goto("/unu-unu/instruments");
  await page.goto(`/unu-unu/playlists/${id}`);
  await openFromBar(page, "Stage monitor");
  await expect(page).toHaveURL(/\/unu-unu\/stage$/);
  const quick = page.url();
  const monitor = await browser.newPage();
  await monitor.goto(quick);
  await page.goto(`/unu-unu/playlists/${id}`);
  await rows(page).first().click();
  await page.keyboard.press("Enter");
  await expect(stage.getByText("Verse 1")).toBeVisible();
  await expect(stage.getByText("Next: Refrain")).toBeVisible();
  // Held upright, like a phone, the next part goes under the live part.
  await stage.setViewportSize({ width: 390, height: 844 });
  const live = await stage.getByText("Verse 1").boundingBox();
  const next = await stage.getByText("Next: Refrain").boundingBox();
  expect(next?.y).toBeGreaterThan((live?.y ?? 0) + (live?.height ?? 0));
  await stage.setViewportSize({ width: 1280, height: 720 });
  // The note for singers shows on the stage, not on the projector.
  await expect(stage.getByText("unison").first()).toBeVisible();

  const message = page.getByRole("textbox", { name: "Message…" });
  await message.fill("5 minutes");
  await message.press("Enter");
  await expect(stage.getByRole("status")).toHaveText("5 minutes");
  // Inside a TV's title-safe area, 5% from each edge.
  await expectTitleSafe(stage, [
    stage.getByRole("status"),
    stage.getByText("Verse 1"),
    stage.getByText("Next: Refrain"),
  ]);
  for (const other of [musicians, monitor])
    await expect(
      other.getByRole("status").filter({ hasText: "5 minutes" }),
    ).toBeVisible();
  // On its own line: the song moves down under it rather than being covered.
  const shown = await musicians
    .getByRole("status")
    .filter({ hasText: "5 minutes" })
    .boundingBox();
  const title = await musicians
    .getByRole("heading", { level: 2 })
    .boundingBox();
  expect(title?.y).toBeGreaterThanOrEqual(
    (shown?.y ?? 0) + (shown?.height ?? 0),
  );
  await expect(projector.getByText("5 minutes")).toHaveCount(0);
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(stage.getByRole("status")).toHaveCount(0);

  // After the song's last slide comes the sermon: a countdown, and nothing projected.
  // One step at a time, each seen on the stage.
  for (const part of ["Refrain", "Refrain", "Verse 2"]) {
    await page.keyboard.press("PageDown");
    await expect(stage.getByText(part, { exact: true })).toBeVisible();
  }
  await page.keyboard.press("PageDown");
  await expect(stage.getByLabel("Minutes left")).toHaveText(/^4[45]:\d\d$/);
  await expect(stage.getByText("Next: Isus e Domn")).toBeVisible();
  await expect(projector.getByText("Predica")).toHaveCount(0);
  await stage.close();
  await projector.close();
});

test("musicians and vocalists screens show the live song", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ana@example.com");
  const open = async (type: string) => {
    const { body } = await api(
      page,
      "POST",
      "/api/communities/unu-unu/screens",
      { name: type, type, languages: ["ro"] },
    );
    const screen = await browser.newPage();
    await screen.goto(`/s/${(body as { secret: string }).secret}`);
    return screen;
  };
  const musicians = await open("musicians");
  const vocalists = await open("vocalists");
  const id = await servicePlaylist(page);
  await page.goto(`/unu-unu/playlists/${id}`);
  await rows(page).first().click();
  await page.keyboard.press("Enter");

  await expect(musicians.getByText("Har minunat").first()).toBeVisible();
  await expect(vocalists.getByText("Amazing grace how sweet")).toBeVisible();
  await expectTitleSafe(musicians, [
    musicians.getByText("Har minunat").first(),
  ]);
  await expectTitleSafe(vocalists, [
    vocalists.getByText("Amazing grace how sweet"),
  ]);
  await musicians.close();
  await vocalists.close();
});

test("on a phone, the vocalists' toolbar holds the key, and previous and next stay at the bottom", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logInAs(page, "ioana@example.com");
  const id = await servicePlaylist(page);
  const [grace, , , passage] = (
    (await api(page, "GET", `${base}/${id}`)).body as {
      entries: { id: string }[];
    }
  ).entries;
  const go = (entry: { id: string } | undefined) =>
    api(page, "POST", "/api/communities/unu-unu/live", {
      type: "go",
      entryId: entry?.id,
    });
  await go(grace);
  await page.goto("/unu-unu/vocals");
  await expect(
    page
      .locator("header")
      .getByRole("button", { name: "Key for this service: G" }),
  ).toBeVisible();

  // With a Bible passage live, nothing floats mid-screen.
  await go(passage);
  await expect(page.getByText("No song is live.")).toBeVisible();
  const next = await page.getByRole("button", { name: "Next" }).boundingBox();
  expect((next?.y ?? 0) + (next?.height ?? 0)).toBeGreaterThan(844 - 24);
});

test("in Whole song on a phone, the map's last part comes wholly into view above previous and next, at once", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logInAs(page, "ana@example.com");
  // Larger text, which zooms the view.
  await api(page, "PUT", "/api/me/preferences", { phone: { textSize: 1.3 } });
  // Lines too long for a phone, so the live part, drawn larger, wraps and grows.
  const verses = Array.from({ length: 8 }, (_, i) =>
    [
      `${i + 1}:`,
      "Poartă-ți lumina prin întuneric ca să-i găsești iar pe cei pierduți",
      "Poartă-ți lumina ca toți s-o vadă și să dea lumină celor din jur",
      "Privește la cei ce-s lângă tine și-n întuneric s-au rătăcit",
      "Dă-le lumina ca să-i ajute să vadă drumul spre infinit",
    ].join("\n"),
  ).join("\n\n");
  const songId = await createSong(page, "Opt strofe", verses);
  const { body } = await api(page, "POST", base, { title: "Opt strofe" });
  const id = (body as { id: string }).id;
  const entry = await api(page, "POST", `${base}/${id}/entries`, {
    kind: "song",
    songId,
  });
  await api(page, "POST", "/api/communities/unu-unu/live", {
    type: "go",
    entryId: (entry.body as { id: string }).id,
  });
  await page.goto("/unu-unu/vocals");
  const parts = page.getByRole("list", { name: "Parts" });
  await expect(parts.getByRole("listitem").first()).toHaveAttribute(
    "aria-current",
    "true",
  );
  await page
    .getByRole("navigation", { name: "Map of the parts" })
    .getByText("8", { exact: true })
    .click();
  const last = parts.getByRole("listitem").last();
  const next = page.getByRole("button", { name: "Next" });
  // Within half a second, as a finger running down the map needs.
  await expect
    .poll(
      async () => {
        const part = await last.boundingBox();
        const button = await next.boundingBox();
        return (part?.y ?? 0) + (part?.height ?? 0) <= (button?.y ?? 0);
      },
      { timeout: 500 },
    )
    .toBe(true);
});

test("musicians see the chords as a bar grid or over the words, and the team taps parts", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ioana@example.com");
  const id = await servicePlaylist(page);
  await api(page, "POST", "/api/communities/unu-unu/live", {
    type: "go",
    entryId: (
      (await api(page, "GET", `${base}/${id}`)).body as {
        entries: { id: string }[];
      }
    ).entries[0]?.id,
  });
  const ro = await browser.newPage();
  await ro.goto("/unu-unu/projector/ro");

  await page.goto("/unu-unu/playlists/steady");
  await openFromBar(page, "Instruments");
  // The key with its icon instead of "Key:".
  await expect(
    page.getByRole("img", { name: "Key" }).first().locator(".."),
  ).toHaveText("G");
  await expect(page.getByText("Time: 3/4")).toBeVisible();
  // The team changes the key for this service from it, and back.
  await page.getByRole("button", { name: "Key for this service: G" }).click();
  const keyDialog = page.getByRole("dialog");
  await keyDialog.locator('[data-key="A"]').click();
  await keyDialog
    .getByRole("button", { name: "Save for this service" })
    .click();
  await expect(
    page.getByRole("button", { name: "Key for this service: A" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Key for this service: A" }).click();
  await page.getByRole("button", { name: "Use the song’s key" }).click();
  await expect(
    page.getByRole("button", { name: "Key for this service: G" }),
  ).toBeVisible();
  const grid = page.getByRole("list", { name: "Bar grid" });
  const verse = grid.getByRole("listitem").first();
  await expect(verse).toHaveAttribute("aria-current", "true");
  await expect(verse).toContainText("Verse 1");
  await expect(verse).toContainText("G");
  await expect(verse).toContainText("C");

  // A tap on a part sends it live.
  await grid.getByRole("listitem").nth(1).getByRole("button").click();
  await expect(ro.getByText("#2/4")).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();
  await expect(ro.getByText("#3/4")).toBeVisible();

  await pickLayout(page, "Chords over words");
  await page.getByRole("button", { name: "Previous" }).click();
  await page.getByRole("button", { name: "Previous" }).click();
  await expect(page.getByText("mazing", { exact: true })).toBeVisible();
  await expect(page.getByText("Next: Refrain")).toBeVisible();
  await ro.close();
});

test("vocalists see every part, the live one marked, in one or all languages", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ioana@example.com");
  await api(page, "POST", "/api/communities/unu-unu/live", {
    type: "go",
    entryId: "steady-1",
  });
  const ro = await browser.newPage();
  await ro.goto("/unu-unu/projector/ro");
  await page.goto("/unu-unu/playlists/steady");
  await openFromBar(page, "Vocals");

  const parts = page.getByRole("list", { name: "Parts" });
  await expect(parts.getByRole("listitem")).toHaveCount(4);
  await expect(parts.getByRole("listitem").first()).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(page.getByText("Слава Тобі")).toHaveCount(0);
  // One button for the languages, with the shown one's flag, that opens the choice.
  await page.getByRole("button", { name: "Languages" }).click();
  await page.getByRole("menuitemradio", { name: "All" }).click();
  await expect(page.getByText("Слава Тобі")).toBeVisible();

  await parts.getByRole("listitem").nth(3).getByRole("button").click();
  await expect(ro.getByText("#4/4")).toBeVisible();
  // Sideways is for phones, so a laptop isn't offered it.
  await expect(page.getByRole("radio", { name: "Sideways" })).toHaveCount(0);
  await ro.close();
});
