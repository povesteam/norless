import { type Page } from "@playwright/test";
import { api, expect, logInAs, pickLayout, test } from "../helpers";

/** A MIDI piano the page can play: `play` holds notes, `release` lets them go. */
const fakePiano = (page: Page) =>
  page.addInitScript(() => {
    type Input = {
      name: string;
      onmidimessage: ((e: { data: Uint8Array }) => void) | null;
    };
    const input: Input = { name: "Test piano", onmidimessage: null };
    const send = (bytes: number[]) =>
      input.onmidimessage?.({ data: Uint8Array.from(bytes) });
    Object.assign(navigator, {
      requestMIDIAccess: async () => ({
        inputs: new Map([["piano", input]]),
        onstatechange: null,
      }),
    });
    Object.assign(window, {
      play: (notes: number[]) => notes.forEach((n) => send([0x90, n, 100])),
      release: (notes: number[]) => notes.forEach((n) => send([0x80, n, 0])),
    });
  });
const play = (page: Page, notes: number[]) =>
  page.evaluate(
    (n) => (window as unknown as { play(n: number[]): void }).play(n),
    notes,
  );
const release = (page: Page, notes: number[]) =>
  page.evaluate(
    (n) => (window as unknown as { release(n: number[]): void }).release(n),
    notes,
  );

test("a chord played on a MIDI piano goes over the letter tapped", async ({
  page,
}) => {
  await fakePiano(page);
  await logInAs(page, "ioana@example.com");
  await page.goto("/acorduri/songs/detect-song/chords");
  const panel = page.getByRole("region", { name: "Play a chord" });
  await panel.getByRole("button", { name: "Use a piano" }).click();
  await expect(panel.getByText("Piano: Test piano")).toBeVisible();

  await page.getByRole("button", { name: "Domnului", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // C, E and G held: the panel and the wheel name C; let go, it's placed.
  await play(page, [48, 52, 55]);
  await expect(panel.getByLabel("Chord played")).toHaveText("C");
  await expect(
    panel.getByRole("img", { name: "Circle of fifths, C played" }),
  ).toBeVisible();
  await release(page, [48, 52, 55]);
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("button", { name: "C Domnului" })).toBeVisible();
});

test("one note names its chord at once; a chord held while a letter is tapped goes there", async ({
  page,
}) => {
  await fakePiano(page);
  await logInAs(page, "ioana@example.com");
  await page.goto("/acorduri/songs/detect-song/chords");
  const panel = page.getByRole("region", { name: "Play a chord" });
  await panel.getByRole("button", { name: "Use a piano" }).click();
  await expect(panel.getByText("Piano: Test piano")).toBeVisible();

  // A alone is A major; with C a minor third above, A minor.
  await play(page, [57]);
  await expect(panel.getByLabel("Chord played")).toHaveText("A");
  await play(page, [60]);
  await expect(panel.getByLabel("Chord played")).toHaveText("Am");
  // Held, then the letter tapped: placed at once, with no picker.
  await page.getByRole("button", { name: "Cântați", exact: true }).click();
  await expect(page.getByRole("button", { name: "Am Cântați" })).toBeVisible();
  await expect(page.getByRole("dialog")).toBeHidden();
  // Letting go doesn't place it again.
  await release(page, [57, 60]);
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Domnului", exact: true }),
  ).toBeVisible();
});

test("the team shares the chord played; musicians see it in the Live chord layout", async ({
  page,
  browser,
}) => {
  await fakePiano(page);
  await logInAs(page, "ioana@example.com");
  await api(page, "POST", "/api/communities/acorduri/live", {
    type: "go",
    entryId: "detect-1",
  });
  await page.goto("/acorduri/musicians");
  await page.getByRole("button", { name: "Share chords" }).click();
  await page.getByRole("menuitem", { name: "From a MIDI piano" }).click();
  await play(page, [57, 60, 64]);
  await expect(
    page.getByRole("button", { name: "Stop sharing (Am)" }),
  ).toBeVisible();

  const maria = await (await browser.newContext()).newPage();
  await logInAs(maria, "maria@example.com");
  await maria.goto("/acorduri/musicians");
  await pickLayout(maria, "Live chord");
  await expect(maria.getByLabel("Chord played")).toHaveText("Am");
  await expect(maria.getByText("From Ioana's piano")).toBeVisible();

  // Stopping: nobody shares.
  await page.getByRole("button", { name: "Stop sharing (Am)" }).click();
  await expect(maria.getByText(/Nobody is sharing chords/)).toBeVisible();
});
