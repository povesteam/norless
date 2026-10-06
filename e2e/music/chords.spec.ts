import { type Music, musicOfTexts } from "../../src/shared/music/chord-track";
import { type Page } from "@playwright/test";
import { api, expect, logInAs, test } from "../helpers";

const text = "1:\nCântați Domnului toți\nCe mare e El";

/** A song in A of its own for a test, added by Maria, the editor. */
async function songInA(page: Page) {
  await logInAs(page, "maria@example.com");
  const { status, body } = await api(
    page,
    "POST",
    "/api/communities/unu-unu/songs",
    {
      keySignature: "A",
      versions: [{ language: "ro", title: "Cântați Domnului", text }],
    },
  );
  expect(status).toBe(201);
  return (body as { id: string }).id;
}

test("a team member places chords by tapping and sets the tempo", async ({
  page,
}) => {
  const id = await songInA(page);
  await logInAs(page, "ioana@example.com");
  await page.goto(`/unu-unu/songs/${id}`);
  await page.getByRole("link", { name: "Chords" }).click();
  await expect(
    page.getByRole("heading", { name: "Chords: Cântați Domnului" }),
  ).toBeVisible();

  // Chords from the key's, over "Cântați" and "Domnului".
  for (const [word, chord] of [
    ["Cântați", "A"],
    ["Domnului", "D"],
  ]) {
    await page.getByRole("button", { name: word, exact: true }).click();
    const picker = page.getByRole("dialog", { name: `Chord over “${word}”` });
    await picker.getByRole("button", { name: chord, exact: true }).click();
    await expect(picker).toBeHidden();
  }

  // A chord over "El", from the song's chords, then the key's.
  await page.getByRole("button", { name: "El", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Chord over “El”" });
  await expect(
    picker.getByRole("button").filter({ hasText: /^[A-G][#b]?m?$/ }),
  ).toHaveText(["A", "D", "Bm", "C#m", "E", "F#m"]);
  await picker.getByRole("button", { name: "E", exact: true }).click();
  await expect(picker).toBeHidden();

  // Tapping gives a tempo; typing sets it exactly.
  const tempo = page.getByRole("textbox", { name: "Tempo (BPM)" });
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "Tap" }).click();
  await expect(tempo).not.toHaveValue("");
  await tempo.fill("72");
  await tempo.blur();
  await page.getByRole("button", { name: "Save" }).click();

  await expect(page).toHaveURL(new RegExp(`/songs/${id}$`));
  await expect(page.getByText("Tempo: 72 BPM")).toBeVisible();
  for (const chord of ["A", "D", "E"])
    await expect(page.getByText(chord, { exact: true }).first()).toBeVisible();

  // Members see who changed what, from the song's ⋯ menu.
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "History" }).click();
  await expect(page.getByText(/^Ioana, /)).toHaveCount(2);
  await expect(page.getByText("Tempo: (none) → 72")).toBeVisible();
});

test("chords set on one verse show on every verse, or only there; a chord moves a letter", async ({
  page,
}) => {
  await logInAs(page, "maria@example.com");
  const { body } = await api(page, "POST", "/api/communities/unu-unu/songs", {
    keySignature: "G",
    versions: [
      {
        language: "ro",
        title: "Strofe la fel",
        text: "1:\nCântați Domnului\n\n2:\nLăudați pe Domnul",
      },
    ],
  });
  const id = (body as { id: string }).id;
  await logInAs(page, "ioana@example.com");
  await page.goto(`/unu-unu/songs/${id}/chords`);

  // A chord on verse 2 goes to every verse: the verses share their chords.
  await page.getByRole("button", { name: "Lăudați", exact: true }).click();
  let picker = page.getByRole("dialog");
  await picker.getByRole("button", { name: "C", exact: true }).click();
  await expect(page.getByRole("button", { name: "C Cântați" })).toBeVisible();

  // "Only this one" changes verse 2 alone.
  // A tap on a chord changes it.
  await page
    .getByRole("button", { name: "C Lăudați" })
    .locator(".text-chord") // the chord over the word
    .click();
  picker = page.getByRole("dialog");
  await picker.getByRole("radio", { name: "Only this one" }).click();
  await picker.getByRole("button", { name: "D", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "D Lăudați", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "C Cântați" })).toBeVisible();

  // A chord moves a letter right, from its picker.
  const letter = () =>
    page
      .getByRole("button", { name: "C Cântați" })
      .locator(".text-chord")
      .evaluate((e) => Number(e.closest("[data-at]")?.getAttribute("data-at")));
  const before = await letter();
  await page
    .getByRole("button", { name: "C Cântați" })
    .locator(".text-chord") // the chord over the word
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Move the chord a letter right" })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  expect(await letter()).toBe(before + 1);
  // Or it's dragged to a letter.
  const word = page.getByRole("button", { name: "C Cântați" });
  const from = await word.locator(".text-chord").boundingBox();
  const target = word.locator("[data-at]").last();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("no chord or letter");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  expect(await letter()).toBe(Number(await target.getAttribute("data-at")));
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(new RegExp(`/songs/${id}$`));
  const saved = await api(page, "GET", `/api/communities/unu-unu/songs/${id}`);
  const music = (saved.body as { music: Music }).music;
  expect(music.patterns.verse?.rows).toMatchObject([
    { line: 0, chords: [{ name: "C" }] },
  ]);
  expect(music.sections["verse.2"]?.follows).toBe(false);
});

test("an editor restores a song as it was before a musician's change", async ({
  page,
}) => {
  const id = await songInA(page);
  await logInAs(page, "ioana@example.com");
  const { body } = await api(
    page,
    "GET",
    `/api/communities/unu-unu/songs/${id}`,
  );
  const { status } = await api(
    page,
    "PUT",
    `/api/communities/unu-unu/songs/${id}/music`,
    {
      base: (body as { music: Music }).music,
      music: musicOfTexts([text.replace("1:\n", "1:\n.Bb\n ")]),
    },
  );
  expect(status).toBe(200);

  await logInAs(page, "maria@example.com");
  await page.goto(`/unu-unu/songs/${id}`);
  await expect(page.getByText("Bb", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "History" }).click();
  await page.getByRole("button", { name: "Restore as it was before" }).click();

  await expect(page.getByText("Bb", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/^Maria, /)).toBeVisible();
});

test("the team adds recordings to learn a song from, names one; its page lists them", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ana@example.com");
  const { body } = await api(page, "POST", "/api/communities/unu-unu/songs", {
    versions: [{ language: "ro", title: "De învățat", text: "1:\nVers" }],
  });
  const { id } = body as { id: string };
  await page.goto(`/unu-unu/songs/${id}/chords`);
  const field = page.getByRole("textbox", {
    name: "Add a recording to learn it from",
  });
  const add = page.getByRole("button", { name: "Add", exact: true });
  await field.fill("http://example.com/song");
  await expect(add).toBeDisabled();
  // .invalid never resolves: no title or picture to read, so the site stands in.
  await field.fill("https://example.invalid/acoustic");
  await add.click();
  await expect(field).toHaveValue("");
  await page.getByRole("textbox", { name: "Title" }).fill("Acustic, mai rar");
  await field.fill("https://example.invalid/live");
  await add.click();
  await expect(page.getByRole("textbox", { name: "Title" })).toHaveCount(2);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(`/unu-unu/songs/${id}`);

  // Visitors see them too; they open in a new tab.
  const visitor = await browser.newPage();
  await visitor.goto(`/unu-unu/songs/${id}`);
  const links = visitor
    .getByRole("listitem")
    .getByRole("link", { name: /example\.invalid/ });
  await expect(links).toHaveCount(2);
  await expect(links.first()).toContainText("Acustic, mai rar");
  await expect(links.first()).toHaveAttribute(
    "href",
    "https://example.invalid/acoustic",
  );
  await expect(links.first()).toHaveAttribute("target", "_blank");
  await visitor.close();
});
