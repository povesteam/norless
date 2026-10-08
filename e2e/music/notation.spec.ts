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

const base = "/api/communities/notatie";

/** The musicians view in a layout; Radu's choice is kept from other tests. */
async function musiciansIn(page: Page, layout: string) {
  await page.goto("/notatie/instruments");
  await pickLayout(page, layout);
}

/** A song in E that Maria writes, live in Radu's playlist from its first part. */
async function liveSong(page: Page, title: string, text: string) {
  await logInAs(page, "maria@example.com");
  const song = await api(page, "POST", `${base}/songs`, {
    keySignature: "E",
    timeSignature: "4/4",
    versions: [{ language: "ro", title, text }],
  });
  const songId = (song.body as { id: string }).id;
  await logInAs(page, "radu@example.com");
  await api(page, "PUT", `${base}/songs/${songId}/tempo`, { bpm: 90 });
  const playlist = await api(page, "POST", `${base}/playlists`, { title });
  const playlistId = (playlist.body as { id: string }).id;
  const entry = await api(
    page,
    "POST",
    `${base}/playlists/${playlistId}/entries`,
    { kind: "song", songId },
  );
  const live = await api(page, "POST", `${base}/live`, {
    type: "go",
    entryId: (entry.body as { id: string }).id,
  });
  expect(live.status).toBe(200);
  return songId;
}

test("the team writes a groove in the drum grid; the drummer sees it live and plays it", async ({
  page,
}) => {
  await page.goto("/notatie");
  const songId = await liveSong(
    page,
    "Cântați Domnului",
    "I:\n.E B\n\n1:\n Cântați Domnului toți",
  );

  await page.goto(`/notatie/songs/${songId}/chords`);
  await page.getByRole("button", { name: "Add notation" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Notation for Intro" });
  await dialog.getByRole("tab", { name: "Drum grid" }).click();
  const tap = (drum: string, beat: number, step: number) =>
    dialog
      .getByRole("group", { name: drum })
      .getByRole("button", { name: `Bar 1, beat ${beat}, step ${step}` })
      .click();
  for (const beat of [1, 2, 3, 4]) {
    await tap("Hi-hat", beat, 1);
    await tap("Hi-hat", beat, 3);
  }
  await tap("Snare", 2, 1);
  await tap("Snare", 4, 1);
  await tap("Kick", 1, 1);
  await tap("Kick", 3, 1);
  await expect(
    dialog.getByRole("group", { name: "Snare" }).getByRole("button", {
      name: "Bar 1, beat 2, step 1",
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    dialog.getByRole("img", { name: "Preview" }).locator(".abcjs-note"),
  ).toHaveCount(8);
  expect(await accessibilityProblems(page)).toEqual([]);
  await dialog.getByRole("button", { name: "Use this notation" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(`/notatie/songs/${songId}`);

  const song = await api(page, "GET", `${base}/songs/${songId}`);
  expect(JSON.stringify(song.body)).toContain(
    "[gF]2g2 [gc]2g2 [gF]2g2 [gc]2g2 |]",
  );

  // The drummer sees the live intro's groove.
  await musiciansIn(page, "Drums: parts by bars");
  const groove = page.getByRole("img", { name: "Notation for Intro" });
  await expect(groove).toBeVisible();
  const sound = page.waitForResponse((r) =>
    r.url().endsWith("/soundfont/FluidR3_GM/percussion-mp3/C2.mp3"),
  );
  await page.getByRole("button", { name: "Play", exact: true }).click();
  expect((await sound).status()).toBe(200);
});

test("a piano intro shows on the keys layout and in the song editor, never on the projector", async ({
  page,
  browser,
}) => {
  await page.goto("/notatie");
  const text = [
    "I:",
    "```abc",
    "X:1",
    "L:1/8",
    "K:E",
    "E2 G2 B2 e2|",
    "```",
    "",
    "1:",
    " Ce mare ești Tu, Doamne",
  ].join("\n");
  const songId = await liveSong(page, "Ce mare ești", text);
  await musiciansIn(page, "Keys: concert pitch");
  await expect(
    page.getByRole("img", { name: "Notation for Intro" }),
  ).toBeVisible();

  const projector = await (await browser.newContext()).newPage();
  await projector.goto("/notatie/projector/ro");
  await projector.waitForLoadState("networkidle");
  await expect(projector.getByText(/E2 G2/)).toHaveCount(0);
  await expect(projector.getByRole("img", { name: /Notation/ })).toHaveCount(0);
  await api(page, "POST", `${base}/live`, { type: "next" });
  await expect(projector.getByText("Ce mare ești Tu, Doamne")).toBeVisible();

  // The song editor has the words only; the intro is in the Chords mode
  //.
  await logInAs(page, "maria@example.com");
  await page.goto(`/notatie/songs/${songId}/edit`);
  await expect(page.getByRole("textbox", { name: "Text" })).toHaveValue(
    /Ce mare ești Tu, Doamne/,
  );
  await expect(page.getByRole("textbox", { name: "Text" })).not.toHaveValue(
    /E2 G2/,
  );
  await page.goto(`/notatie/songs/${songId}/chords`);
  await expect(
    page.getByRole("img", { name: /Notation for/ }).first(),
  ).toBeVisible();
});
