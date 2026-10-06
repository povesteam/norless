import { type Page } from "@playwright/test";
import {
  accessibilityProblems,
  api,
  expect,
  logInAs,
  pickLayout,
  test,
} from "../helpers";

test.describe.configure({ mode: "serial" });

const text = [
  "1:",
  ".| E    | B/D#  | C#m   | A     |",
  " Cântați Domnului toți",
  ".| E    | B     |",
  " Ce mare e El",
  "! drums: rim and hats",
  "! all: softer",
  "",
  "R:",
  ".| A    | E     | B7    | E     |",
  " Aleluia, aleluia",
].join("\n");

/** A song in E, live in a playlist of the band's own community, sent by Radu (team). */
async function liveSongInE(page: Page) {
  await logInAs(page, "maria@example.com");
  const song = await api(page, "POST", "/api/communities/formatia/songs", {
    keySignature: "E",
    versions: [{ language: "ro", title: "Cântați Domnului", text }],
  });
  const songId = (song.body as { id: string }).id;
  await logInAs(page, "radu@example.com");
  const playlist = await api(
    page,
    "POST",
    "/api/communities/formatia/playlists",
    {
      title: "Repetiție",
    },
  );
  const playlistId = (playlist.body as { id: string }).id;
  const entry = await api(
    page,
    "POST",
    `/api/communities/formatia/playlists/${playlistId}/entries`,
    { kind: "song", songId },
  );
  const entryId = (entry.body as { id: string }).id;
  const live = await api(page, "POST", "/api/communities/formatia/live", {
    type: "go",
    entryId,
  });
  expect(live.status).toBe(200);
  return { songId, playlistId, entryId };
}

test("a guitarist with C and G shapes plays capo 4; a drummer sees the bars and their notes", async ({
  page,
}) => {
  await page.goto("/formatia");
  await liveSongInE(page);
  const saved = await api(page, "PUT", "/api/me/preferences", {
    musician: { instruments: ["guitar"], main: "guitar", shapes: ["C", "G"] },
  });
  expect(saved.status).toBe(204);

  // On a laptop, a guitarist's main layout is the chart.
  await page.goto("/formatia/musicians");
  await expect(page.getByText("Capo 4")).toBeVisible();
  await expect(page.getByText("C shapes")).toBeVisible();
  await expect(page.getByText("G/B", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("img", { name: "Am" })).toBeVisible();
  await expect(page.getByText("rim and hats")).toHaveCount(0);

  await expect(
    page.getByRole("button", { name: "Layout: Guitar: chart" }),
  ).toBeVisible();
  await pickLayout(page, "Drums: parts by bars");
  await expect(page.getByText("6 bars")).toBeVisible();
  await expect(page.getByText("rim and hats")).toBeVisible();
  await expect(page.getByText("softer")).toBeVisible();
});

test("a key for the service moves the musicians' chords and shows on the projector, and can become the song's key", async ({
  page,
  browser,
}) => {
  await page.goto("/formatia");
  const { songId, playlistId } = await liveSongInE(page);
  const visitor = await (await browser.newContext()).newPage();
  await visitor.goto("/formatia/musicians");
  await expect(visitor.getByText("C#m", { exact: true })).toBeVisible();

  await page.goto(`/formatia/playlists/${playlistId}`);
  await page
    .getByRole("row", { name: "Cântați Domnului" })
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "Key for this service" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: /Key$/ }).click();
  await page.getByRole("option", { name: "D · down 2 half steps" }).click();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("D (song: E)")).toBeVisible();

  // Down a whole step for the band, at once.
  await expect(visitor.getByText("Bm", { exact: true })).toBeVisible();
  await expect(visitor.getByText("A/C#", { exact: true })).toBeVisible();
  await visitor.goto("/formatia/projector/ro");
  await expect(visitor.getByText("D", { exact: true })).toBeVisible();

  await page
    .getByRole("row", { name: "Cântați Domnului" })
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "Key for this service" }).click();
  await page.getByRole("button", { name: "Make it the song’s key" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  const song = await api(
    page,
    "GET",
    `/api/communities/formatia/songs/${songId}`,
  );
  expect(song.body).toMatchObject({ keySignature: "D" });
  expect(JSON.stringify(song.body)).toContain("| D    | A/C#");
});

test("a musician who chose chord colors sees each chord in its degree's color", async ({
  page,
}) => {
  await page.goto("/formatia");
  const { songId, entryId } = await liveSongInE(page);
  await page.goto("/account");
  const colors = page.getByRole("switch", {
    name: "Color chords by their degree in the key",
  });
  await expect(colors).not.toBeChecked();
  const saved = page.waitForResponse("/api/me/preferences");
  await page.getByText("Color chords by their degree in the key").click();
  expect((await saved).status()).toBe(204);
  // Relative pairs only, no scheme to pick; the colors' legend.
  await expect(page.getByRole("radio", { name: /Relative pairs/ })).toHaveCount(
    0,
  );
  await expect(page.getByText("Suffixes:")).toBeVisible();

  // In E: E is 1, B/D# is 5 over 7, C#m is 6 and A is 4, in the bar grid.
  await page.goto("/formatia/musicians");
  await pickLayout(page, "Bar grid");
  const chord = (text: string) =>
    page.locator("[data-degree]", { hasText: new RegExp(`^${text}$`) }).first();
  await expect(chord("C#m")).toHaveAttribute("data-degree", "6");
  await expect(chord("B")).toHaveAttribute("data-degree", "5");
  await expect(chord("/D#")).toHaveAttribute("data-degree", "7");
  await expect(chord("A")).toHaveAttribute("data-degree", "4");
  // The stage view's own text color, which the bar's box inherits.
  const plain = await chord("E").evaluate(
    (el) => getComputedStyle(el.parentElement ?? el).color,
  );
  await expect(chord("E")).toHaveCSS("color", plain);
  await expect(chord("A")).not.toHaveCSS("color", plain);
  // B7's suffix in its own color, apart from its letter's.
  const seventh = page
    .locator("[data-degree] + span", { hasText: /^7$/ })
    .first();
  await expect(seventh).not.toHaveCSS("color", plain);
  const letter = await chord("B").evaluate((el) => getComputedStyle(el).color);
  await expect(seventh).not.toHaveCSS("color", letter);

  // The colors read: 4.5:1 contrast, the suffixes blended with their letter too.
  // Other tests send their songs live in this community meanwhile.
  await api(page, "POST", "/api/communities/formatia/live", {
    type: "go",
    entryId,
  });
  await page.reload();
  // The layout chosen may not be saved yet: Radu plays drums (a test above).
  await pickLayout(page, "Bar grid");
  await expect(chord("C#m")).toHaveAttribute("data-degree", "6");
  expect(await accessibilityProblems(page)).toEqual([]);

  // While editing too (decision review).
  await page.goto(`/formatia/songs/${songId}/chords`);
  await expect(chord("C#m")).toHaveAttribute("data-degree", "6");
});

test("the bar grid's rows are equal and aligned, a bar's chords as long as their beats", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logInAs(page, "maria@example.com");
  const song = await api(page, "POST", "/api/communities/formatia/songs", {
    keySignature: "C",
    versions: [
      {
        language: "ro",
        title: "Opt măsuri",
        text: "Intro:\n.| C G | Am | F | G | C | Am | F | G |\n\nCântați Domnului",
      },
    ],
  });
  const songId = (song.body as { id: string }).id;

  // In the Chords mode, C takes three of the first bar's four beats.
  await page.goto(`/formatia/songs/${songId}/chords`);
  // The verses share their chords, so both show the bar; the first one sets it.
  const end = page.getByRole("slider", { name: "Where C ends" }).first();
  await expect(end).toHaveValue("2");
  await end.focus();
  await page.keyboard.press("ArrowRight");
  await expect(end).toHaveValue("3");
  await page.getByRole("button", { name: "Save" }).click();
  await expect
    .poll(async () =>
      JSON.stringify(
        (await api(page, "GET", `/api/communities/formatia/songs/${songId}`))
          .body,
      ),
    )
    .toContain("C__ G");

  // Live, in the musicians bar grid on a phone.
  await logInAs(page, "radu@example.com");
  const playlist = await api(
    page,
    "POST",
    "/api/communities/formatia/playlists",
    {
      title: "Măsuri",
    },
  );
  const playlistId = (playlist.body as { id: string }).id;
  const entry = await api(
    page,
    "POST",
    `/api/communities/formatia/playlists/${playlistId}/entries`,
    { kind: "song", songId },
  );
  await api(page, "POST", "/api/communities/formatia/live", {
    type: "go",
    entryId: (entry.body as { id: string }).id,
  });
  await page.goto("/formatia/musicians");
  await pickLayout(page, "Bar grid");
  const bars = page.locator("[data-bar-grid]").first().locator(":scope > *");
  await expect(bars).toHaveCount(8);
  const boxes = await bars.evaluateAll((all) =>
    all.map((b) => b.getBoundingClientRect()),
  );
  // Rows of equal width, in columns: every box as wide as the first, and each row starting
  // where the first one does.
  const rows = [...new Set(boxes.map((b) => Math.round(b.top)))];
  expect(rows.length).toBeGreaterThan(1);
  expect(rows.length).toBeLessThanOrEqual(4);
  for (const box of boxes) {
    expect(Math.round(box.width)).toBe(Math.round(boxes[0]?.width ?? 0));
    if (Math.round(box.top) !== rows[0])
      expect([...boxes.map((b) => Math.round(b.left))]).toContain(
        Math.round(box.left),
      );
  }
  // C three times as long as G.
  const [c, g] = await bars
    .first()
    .locator(":scope > *")
    .evaluateAll((all) => all.map((e) => e.getBoundingClientRect().width));
  expect((c ?? 0) / (g ?? 1)).toBeGreaterThan(2);
});

test("the musicians view asks once what you play, and its icons name themselves on a long-press", async ({
  page,
}) => {
  await logInAs(page, "radu@example.com");
  const unasked = await api(page, "PUT", "/api/me/preferences", {
    hints: ["goLive", "search", "keys", "project"],
    musician: { instruments: [] },
  });
  expect(unasked.status).toBe(204);
  await page.goto("/formatia/musicians");
  const ask = page.getByRole("dialog", { name: "What do you play?" });
  await expect(ask).toBeVisible();
  await ask.getByRole("button", { name: "Done" }).click();
  await expect(ask).toBeHidden();

  // Not asked again; the Display menu asks.
  await page.reload();
  const tempo = page.getByRole("button", {
    name: "Listen for tempo",
    exact: true,
  });
  await expect(tempo).toBeVisible();
  await expect(ask).toHaveCount(0);
  await page.getByRole("button", { name: "Display" }).click();
  await page.getByRole("button", { name: "What I play" }).click();
  await ask.getByText("Drums").click();
  await ask.getByRole("button", { name: "Done" }).click();
  await expect(ask).toBeHidden();

  // A long-press on an icon names it, and doesn't press it.
  const touch = {
    pointerType: "touch",
    pointerId: 7,
    isPrimary: true,
    pressure: 0.5,
    bubbles: true,
  };
  await tempo.dispatchEvent("pointerdown", touch);
  await expect(page.getByRole("tooltip")).toHaveText("Listen for tempo");
  await tempo.dispatchEvent("pointerup", touch);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
