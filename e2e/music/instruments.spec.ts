import { type Page } from "@playwright/test";
import {
  accessibilityProblems,
  api,
  expect,
  logInAs,
  pickLayout,
  swipe,
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
  // On the wheel the song's key, E, is in the middle, each key with how far it moves.
  await expect(dialog.getByRole("radio", { name: /^E\s*0$/ })).toBeChecked();
  await dialog.locator('[data-key="D"]').click();
  await expect(dialog.getByRole("radio", { name: /^D\s*−2$/ })).toBeChecked();
  await dialog.getByRole("button", { name: "Save for this service" }).click();
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
  await page.getByRole("button", { name: "Save as the song’s key" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  const song = await api(
    page,
    "GET",
    `/api/communities/formatia/songs/${songId}`,
  );
  expect(song.body).toMatchObject({ keySignature: "D" });
  expect(JSON.stringify(song.body)).toContain("| D    | A/C#");
});

test("a musician sees each chord in its degree's color, unless they chose plain chords", async ({
  page,
}) => {
  await page.goto("/formatia");
  const { songId, entryId } = await liveSongInE(page);
  await page.goto("/account");
  const plainChords = page.getByRole("switch", {
    name: "Plain chords (one color)",
  });
  await expect(plainChords).not.toBeChecked();
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

  // Plain chords: one color, no legend.
  await page.goto("/account");
  const saved = page.waitForResponse("/api/me/preferences");
  await page.getByText("Plain chords (one color)").click();
  expect((await saved).status()).toBe(204);
  await expect(page.getByText("Suffixes:")).toHaveCount(0);
  await page.goto("/formatia/musicians");
  await expect(page.getByText("C#m").first()).toBeVisible();
  await expect(page.locator("[data-degree]")).toHaveCount(0);
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

test("a song without chords links an editor to its Chords mode", async ({
  page,
}) => {
  await logInAs(page, "maria@example.com");
  const song = await api(page, "POST", "/api/communities/formatia/songs", {
    versions: [
      { language: "ro", title: "Fără acorduri", text: "1:\nDoar cuvinte" },
    ],
  });
  const songId = (song.body as { id: string }).id;
  await logInAs(page, "radu@example.com");
  const playlist = await api(
    page,
    "POST",
    "/api/communities/formatia/playlists",
    { title: "Fără acorduri" },
  );
  const playlistId = (playlist.body as { id: string }).id;
  const entry = await api(
    page,
    "POST",
    `/api/communities/formatia/playlists/${playlistId}/entries`,
    { kind: "song", songId },
  );
  const live = await api(page, "POST", "/api/communities/formatia/live", {
    type: "go",
    entryId: (entry.body as { id: string }).id,
  });
  expect(live.status).toBe(200);
  await logInAs(page, "maria@example.com");
  await page.goto("/formatia/musicians");
  await pickLayout(page, "Chords over words");
  await expect(page.getByText("This song has no chords yet.")).toBeVisible();
  await page.getByRole("link", { name: "Add chords" }).click();
  await expect(page).toHaveURL(new RegExp(`/formatia/songs/${songId}/chords`));
  await expect(page.getByText("This page doesn't exist.")).toHaveCount(0);

  // Without the Chords mode switched on, nothing to lead to.
  await page.route("**/api/communities/formatia", async (route) => {
    const community = (await (await route.fetch()).json()) as {
      switches: object;
    };
    await route.fulfill({
      json: {
        ...community,
        switches: { ...community.switches, chords: false },
      },
    });
  });
  await page.goto("/formatia/musicians");
  await expect(page.getByText("This song has no chords yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Add chords" })).toHaveCount(0);
});

test("the playlist shows each song's key, without the change from the song before", async ({
  page,
}) => {
  await logInAs(page, "maria@example.com");
  const ids: string[] = [];
  for (const [title, key] of [
    ["În E", "E"],
    ["În D", "D"],
  ]) {
    const song = await api(page, "POST", "/api/communities/formatia/songs", {
      keySignature: key,
      versions: [{ language: "ro", title, text: "1:\n.| C |\n Cuvinte" }],
    });
    ids.push((song.body as { id: string }).id);
  }
  await logInAs(page, "radu@example.com");
  const playlist = await api(
    page,
    "POST",
    "/api/communities/formatia/playlists",
    { title: "Două tonalități" },
  );
  const playlistId = (playlist.body as { id: string }).id;
  for (const songId of ids)
    await api(
      page,
      "POST",
      `/api/communities/formatia/playlists/${playlistId}/entries`,
      { kind: "song", songId },
    );
  await page.goto(`/formatia/playlists/${playlistId}`);
  const entries = page.getByRole("grid", { name: "Entries" });
  await expect(entries.getByRole("row", { name: /În D/ })).toContainText("D");
  await expect(entries).not.toContainText("half step");
});

test("Whole song enlarges the live part without wrapping its lines", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await logInAs(page, "maria@example.com");
  const song = await api(page, "POST", "/api/communities/formatia/songs", {
    versions: [
      {
        language: "ro",
        title: "Rânduri lungi",
        text: "1:\nEste un rând mai lung decât\nȘi încă unul la fel de lung\n\n2:\nScurt",
      },
    ],
  });
  await logInAs(page, "radu@example.com");
  const playlist = await api(
    page,
    "POST",
    "/api/communities/formatia/playlists",
    { title: "Rânduri lungi" },
  );
  const entry = await api(
    page,
    "POST",
    `/api/communities/formatia/playlists/${(playlist.body as { id: string }).id}/entries`,
    { kind: "song", songId: (song.body as { id: string }).id },
  );
  await api(page, "POST", "/api/communities/formatia/live", {
    type: "go",
    entryId: (entry.body as { id: string }).id,
  });
  await page.goto("/formatia/vocalists");
  const live = page
    .getByRole("list", { name: "Parts" })
    .locator('[aria-current="true"] [lang]')
    .first();
  await expect(live).toContainText("Este un rând");
  const { fits, size } = await live.evaluate((el) => ({
    fits: el.scrollWidth <= el.clientWidth,
    size: parseFloat(getComputedStyle(el).fontSize),
  }));
  expect(fits).toBe(true);
  // Bigger than the other parts' 18 pixels, at most 24.
  expect(size).toBeGreaterThan(18);
  expect(size).toBeLessThanOrEqual(24);
});

test("Sideways leaves out the bar to look at other songs, which Whole song keeps", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // A song is live in a playlist since the tests above.
  await logInAs(page, "maria@example.com");
  await page.goto("/formatia/vocalists");
  const earlier = page.getByRole("button", { name: "Earlier song" });
  await expect(earlier).toBeVisible();
  // Each part's mark, faint in its corner, its name only read out.
  const first = page
    .getByRole("list", { name: "Parts" })
    .getByRole("listitem")
    .first();
  await expect(first.locator("[data-mark]")).toHaveAttribute("data-mark", "1");
  await expect(first.getByText("Verse 1")).toHaveClass(/sr-only/);
  await page.getByRole("radio", { name: "Sideways" }).click();
  await expect(earlier).toHaveCount(0);
});

test("in Vocals, swipes and the map of the parts move the team's live part, and a singer's own view", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  await logInAs(page, "radu@example.com");
  const { entryId } = await liveSongInE(page);
  const slide = async () =>
    (
      (await api(page, "GET", "/api/communities/formatia/live")).body as {
        slide: number;
      }
    ).slide;

  // The team, Sideways: a swipe to the left sends the next part live.
  await page.goto("/formatia/vocalists");
  await page.getByRole("radio", { name: "Sideways" }).click();
  await swipe(page, -1);
  await expect.poll(slide).toBe(1);
  await swipe(page, 1);
  await expect.poll(slide).toBe(0);

  // Whole song: the map moves live at a tap.
  await page.getByRole("radio", { name: "Whole song" }).click();
  await page
    .getByRole("navigation", { name: "Map of the parts" })
    .getByText("R", { exact: true })
    .click();
  await expect.poll(slide).toBe(1);

  // A singer who doesn't control live swipes on their own phone only.
  await api(page, "POST", "/api/communities/formatia/live", {
    type: "go",
    entryId,
    slide: 0,
  });
  const singer = await (
    await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    })
  ).newPage();
  await logInAs(singer, "maria@example.com");
  await singer.goto("/formatia/vocalists");
  await singer.getByRole("radio", { name: "Sideways" }).click();
  await expect(singer.locator("[data-mark]").first()).toHaveAttribute(
    "data-mark",
    "1",
  );
  await swipe(singer, -1);
  await expect(singer.locator("[data-mark]").first()).toHaveAttribute(
    "data-mark",
    "R",
  );
  expect(await slide()).toBe(0);
});
