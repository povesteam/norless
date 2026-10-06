import { expect, test } from "@playwright/test";
import { api, createSong, logInAs, openFromBar } from "./helpers";

test.beforeEach(async ({ page }) => logInAs(page, "ana@example.com"));

test("an editor fixes one section from the song page", async ({ page }) => {
  const id = await createSong(
    page,
    "Cu o greșeală",
    "1:\nVers unu\n\nR:\nRefren gresit",
  );
  await page.goto(`/unu-unu/songs/${id}`);

  await page.getByRole("button", { name: "Edit section" }).nth(1).click();
  const text = page.getByRole("textbox", { name: "Text" });
  await expect(text).toHaveValue("R:\nRefren gresit");
  await text.fill("R:\nRefren corect");
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(page.getByText("Refren corect")).toBeVisible();
  await expect(page.getByText("Vers unu")).toBeVisible();
});

test("Ctrl/Cmd+S saves the whole song and keeps the editor open", async ({
  page,
}) => {
  const id = await createSong(page, "De editat", "1:\nVers");
  await page.goto(`/unu-unu/songs/${id}`);
  await page.getByRole("link", { name: "Edit song" }).click();

  await page.getByLabel("Key").fill("Em");
  await page.getByRole("combobox", { name: "Tags" }).fill("har");
  await page.getByRole("option", { name: "har", exact: true }).click();
  // The chosen tags sit above the box, so its list never covers them.
  const tag = page
    .getByRole("grid", { name: "Tags" })
    .getByRole("row", { name: "har" });
  await expect(tag).toBeVisible();
  const tagBox = await tag.boundingBox();
  const box = await page.getByRole("combobox", { name: "Tags" }).boundingBox();
  expect((tagBox?.y ?? 0) + (tagBox?.height ?? 0)).toBeLessThanOrEqual(
    box?.y ?? -1,
  );
  await page.keyboard.press("ControlOrMeta+s");

  await expect(page.getByText("Saved")).toBeVisible();
  await expect(page).toHaveURL(`/unu-unu/songs/${id}/edit`);
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByText("Key: Em")).toBeVisible();
  await expect(page.getByText("har", { exact: true })).toBeVisible();
});

test("closing with unsaved changes asks first", async ({ page }) => {
  const id = await createSong(page, "Nesalvat", "1:\nVers");
  await page.goto(`/unu-unu/songs/${id}/edit`);
  await page.getByRole("radio", { name: "One language" }).click();
  await page.getByRole("tabpanel").getByLabel("Text").fill("1:\nAltceva");

  const dialogs: string[] = [];
  page.once("dialog", (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });
  await page.getByRole("button", { name: "Close" }).click();
  expect(dialogs).toEqual(["Discard your unsaved changes?"]);
  await expect(page).toHaveURL(`/unu-unu/songs/${id}/edit`);

  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL(`/unu-unu/songs/${id}`);
  await expect(page.getByText("Vers", { exact: true })).toBeVisible();
});

test("a new song opens in its editor once saved", async ({ page }) => {
  await page.goto("/unu-unu");
  await openFromBar(page, "New song");
  await page.getByRole("radio", { name: "One language" }).click();
  const panel = page.getByRole("tabpanel");
  await panel.getByLabel("Title").fill("Cântare nouă de test");
  await panel.getByLabel("Text").fill("1:\nPrima strofă");
  await page.keyboard.press("ControlOrMeta+s");

  await expect(page).toHaveURL(/\/unu-unu\/songs\/[0-9A-Za-z]{12}\/edit$/);
  await expect(panel.getByLabel("Title")).toHaveValue("Cântare nouă de test");
});

test("a section changed meanwhile shows both versions", async ({ page }) => {
  const id = await createSong(page, "Doi editori", "R:\nRefren");
  await page.goto(`/unu-unu/songs/${id}`);
  await page.getByRole("button", { name: "Edit section" }).click();
  await page.getByRole("textbox", { name: "Text" }).fill("R:\nRefrenul meu");

  // Someone else saves the same section first.
  await api(
    page,
    "PUT",
    `/api/communities/unu-unu/songs/${id}/versions/ro/sections/0`,
    {
      baseText: "R:\nRefren",
      text: "R:\nRefrenul lor",
    },
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();

  await expect(
    page.getByText("Someone else changed this meanwhile"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Keep mine" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("Refrenul meu")).toBeVisible();
});

test("visitors see no edit controls", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/unu-unu/songs/grace");
  await expect(
    page.getByRole("heading", { name: "Har minunat" }),
  ).toBeVisible();

  await expect(page.getByRole("link", { name: "Edit song" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit section" })).toHaveCount(
    0,
  );
});

test("members watch a section being edited, and can't edit the song meanwhile", async ({
  page: ana,
  browser,
  baseURL,
}) => {
  const id = await createSong(ana, "Prezență", "1:\nVers\n\nR:\nRefren");
  const context = await browser.newContext({ baseURL });
  const maria = await context.newPage();
  await logInAs(maria, "maria@example.com");
  await maria.goto(`/unu-unu/songs/${id}`);
  await expect(maria.getByRole("heading", { name: "Prezență" })).toBeVisible();

  await ana.goto(`/unu-unu/songs/${id}`);
  await ana.getByRole("button", { name: "Edit section" }).nth(1).click();
  await ana
    .getByRole("textbox", { name: "Text" })
    .fill("R:\nRefren scris acum");

  await expect(
    maria.getByText("Ana is editing", { exact: true }),
  ).toBeVisible();
  await expect(maria.getByText("Ana is editing this song")).toBeVisible();
  await expect(maria.getByText("Refren scris acum")).toBeVisible();
  // One editor per song: the other sections wait too.
  for (const i of [0, 1])
    await expect(
      maria.getByRole("button", { name: "Edit section" }).nth(i),
    ).toBeDisabled();

  await ana.getByRole("button", { name: "Save", exact: true }).click();
  await expect(maria.getByText("Ana is editing this song")).toBeHidden();
  await expect(maria.getByText("Refren scris acum")).toBeVisible();
  await expect(
    maria.getByRole("button", { name: "Edit section" }).nth(0),
  ).toBeEnabled();
  await context.close();
});

test("the song editor is read-only while someone else has it open", async ({
  page: ana,
  browser,
  baseURL,
}) => {
  const id = await createSong(ana, "Lacăt", "1:\nVers");
  await ana.goto(`/unu-unu/songs/${id}/edit`);
  await expect(ana.getByRole("textbox", { name: /^Text/ })).toBeEditable();

  const context = await browser.newContext({ baseURL });
  const maria = await context.newPage();
  await logInAs(maria, "maria@example.com");
  await maria.goto(`/unu-unu/songs/${id}/edit`);
  await expect(maria.getByText("Ana is editing this song")).toBeVisible();
  await expect(maria.getByRole("textbox", { name: /^Text/ })).toBeDisabled();
  await expect(
    maria.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();

  // Ana closes it: it's Maria's now, and Ana's song page waits for her.
  await ana.getByRole("button", { name: "Close" }).click();
  await expect(maria.getByText("Ana is editing this song")).toBeHidden();
  await expect(maria.getByRole("textbox", { name: /^Text/ })).toBeEditable();
  await expect(ana.getByText("Maria is editing this song")).toBeVisible();
  await context.close();
});

test("members see who added a song; visitors don't", async ({
  page,
  context,
}) => {
  const id = await createSong(page, "Cu autor", "1:\nVers");
  await page.goto(`/unu-unu/songs/${id}`);
  await expect(page.getByLabel("Added by Ana")).toBeVisible();

  await context.clearCookies();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Cu autor" })).toBeVisible();
  await expect(page.getByLabel("Added by Ana")).toHaveCount(0);
});

test("repeated lines show ×2 without the marks, and the editor flags a mark that doesn't close", async ({
  page,
}) => {
  const id = await createSong(
    page,
    "Cu repetări",
    "1:\n/:Tu mă ridici\nși eu pot sta:/\n\n2:\n/:Început deschis\n\nsfârșit:/",
  );
  await page.goto(`/unu-unu/songs/${id}`);
  await expect(page.getByText("Tu mă ridici", { exact: true })).toBeVisible();
  await expect(page.getByText("×2")).toBeVisible();
  await expect(page.getByText("/:Tu mă ridici")).toHaveCount(0);
  // The mark that doesn't close shows as written.
  await expect(page.getByText("/:Început deschis")).toBeVisible();

  await page.getByRole("link", { name: "Edit song" }).click();
  await expect(page.getByText("doesn't close in section 2, 3")).toBeVisible();
});

test("on a laptop the languages are side by side, each in one text area", async ({
  page,
}) => {
  const { body } = await api(page, "POST", "/api/communities/unu-unu/songs", {
    versions: [
      { language: "ro", title: "Alături", text: "1:\nVers unu\n\nR:\nRefren" },
      { language: "uk", title: "Поруч", text: "1:\nКуплет\n\nR:\nПриспів" },
    ],
  });
  const { id } = body as { id: string };
  await page.goto(`/unu-unu/songs/${id}/edit`);
  await page.getByRole("radio", { name: "Side by side" }).click();
  const ro = page.getByRole("textbox", { name: "Text in Romanian" });
  const uk = page.getByRole("textbox", { name: "Text in Ukrainian" });
  // The whole song in one text area per language, next to each other.
  await expect(ro).toHaveValue("1:\nVers unu\n\nR:\nRefren");
  await expect(uk).toHaveValue("1:\nКуплет\n\nR:\nПриспів");
  expect((await ro.boundingBox())?.y).toBe((await uk.boundingBox())?.y);

  await uk.fill("1:\nКуплет\n\nR:\nПриспів новий");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.getByText("Saved")).toBeVisible();
  const saved = await api(page, "GET", `/api/communities/unu-unu/songs/${id}`);
  expect(
    (saved.body as { versions: { language: string; text: string }[] }).versions,
  ).toContainEqual(
    expect.objectContaining({
      language: "uk",
      text: "1:\nКуплет\n\nR:\nПриспів новий",
    }),
  );
});

test("+ adds a version in a community language the song doesn't have", async ({
  page,
}) => {
  const id = await createSong(page, "Doar română", "1:\nVers");
  await page.goto(`/unu-unu/songs/${id}/edit`);
  await page.getByRole("radio", { name: "Side by side" }).click();
  await expect(page.getByLabel("Title in Ukrainian")).toHaveCount(0);
  await page.getByRole("button", { name: "Add a language" }).click();
  await page.getByRole("menuitem", { name: "Ukrainian" }).click();
  await page.getByLabel("Title in Ukrainian").fill("Тільки");
  await page
    .getByRole("textbox", { name: "Text in Ukrainian" })
    .fill("1:\nКуплет");
  await page.keyboard.press("ControlOrMeta+s");
  await expect(page.getByText("Saved")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add a language" }),
  ).toHaveCount(0);
});

test("an editor sets a song's authors, copyright and source; its page shows them", async ({
  page,
}) => {
  await logInAs(page, "ana@example.com");
  const { body } = await api(page, "POST", "/api/communities/unu-unu/songs", {
    versions: [{ language: "ro", title: "Cu autori", text: "1:\nVers" }],
  });
  const { id } = body as { id: string };
  await page.goto(`/unu-unu/songs/${id}/edit`);
  await page
    .getByRole("textbox", { name: "Authors" })
    .fill("Text: Ioan Bunaciu");
  await page
    .getByRole("textbox", { name: "Copyright" })
    .fill("© Editura Făclia");
  const source = page.getByRole("textbox", { name: "Source" });
  const save = page.getByRole("button", { name: "Save" });
  await source.fill("www.resursecrestine.ro");
  await expect(save).toBeDisabled();
  await source.fill("https://www.resursecrestine.ro/cantari/1");
  await save.click();
  await expect(page.getByText("Saved")).toBeVisible();

  await page.goto(`/unu-unu/songs/${id}`);
  await expect(
    page.getByText("Text: Ioan Bunaciu · © Editura Făclia"),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Source" })).toHaveAttribute(
    "href",
    "https://www.resursecrestine.ro/cantari/1",
  );
});
