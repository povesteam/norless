import { expect, test } from "@playwright/test";
import { api, logInAs, openSteadyPage } from "../helpers";
import { rows } from "./playlist";

// Every test here changes the one room's live state, so they run one after another.
test.describe.configure({ mode: "serial" });

test("the team sends slides to the bible.com projection windows mapped on their device", async ({
  page,
}) => {
  // The extension, accepting messages from Norless; window 2 is turned off in it.
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const sent: { action: string; payload?: Record<string, unknown> }[] = [];
    w.sent = sent;
    w.chrome = {
      runtime: {
        sendMessage: async (
          _id: string,
          message: { action: string; payload?: { index?: number } },
        ) => {
          sent.push(message);
          return { status: message.payload?.index === 2 ? 404 : 200 };
        },
      },
    };
  });
  await logInAs(page, "ioana@example.com");
  const lastText = () =>
    page.evaluate(() => {
      const sent = (
        window as unknown as {
          sent: { action: string; payload?: { index: number; text: string } }[];
        }
      ).sent.filter((m) => m.action === "updateText");
      const last = sent[sent.length - 1]?.payload;
      return last ? `${last.index}: ${last.text}` : "";
    });

  await openSteadyPage(page);
  await page.getByRole("button", { name: "Screens", exact: true }).click();
  await page.getByRole("menuitem", { name: "bible.com windows…" }).click();
  const dialog = page.getByRole("dialog", { name: "bible.com projection" });
  await expect(dialog.getByRole("status")).toHaveText(/is ready/);
  await dialog.getByRole("button", { name: "Romanian" }).click();
  await page.getByRole("option", { name: "Window 1" }).click();
  await dialog.getByRole("button", { name: "Close" }).click();

  await rows(page).first().click();
  await page.keyboard.press("Enter");
  await expect
    .poll(lastText)
    .toMatch(/^1: <h1 class="reference">#1\/4 · G · Har minunat<\/h1>/);
  await page.keyboard.press("Escape");
  await expect.poll(lastText).toBe("1: ");

  // Window 2 is off in the extension.
  await page.getByRole("button", { name: "Screens", exact: true }).click();
  await page.getByRole("menuitem", { name: "bible.com windows…" }).click();
  await dialog.getByRole("button", { name: "Ukrainian" }).click();
  await page.getByRole("option", { name: "Window 2" }).click();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Open bible.com projection window 2 first",
  );
});

test("a verse projected from bible.com shows on Norless's screens, until the team goes back", async ({
  page,
  browser,
}) => {
  // The extension: it says which windows are open, and posts what it projects.
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    const listeners: ((message: unknown) => void)[] = [];
    w.project = (message: unknown) => listeners.forEach((l) => l(message));
    w.chrome = {
      runtime: {
        sendMessage: async (_id: string, message: { action: string }) =>
          message.action === "status"
            ? { status: 200, windows: [1, 2] }
            : { status: 200 },
        connect: () => ({
          onMessage: {
            addListener: (l: (m: unknown) => void) => listeners.push(l),
          },
          onDisconnect: { addListener: () => {} },
          disconnect: () => {},
        }),
      },
    };
  });
  await logInAs(page, "ioana@example.com");
  await openSteadyPage(page);
  await page.getByRole("button", { name: "Screens", exact: true }).click();
  await page.getByRole("menuitem", { name: "bible.com windows…" }).click();
  const dialog = page.getByRole("dialog", { name: "bible.com projection" });
  for (const [language, window] of [
    ["Romanian", "Window 1"],
    ["Ukrainian", "Window 2"],
  ]) {
    await dialog.getByRole("button", { name: language }).click();
    // The list that just closed may still be fading out.
    await page.getByRole("option", { name: window }).last().click();
  }
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(
    page.getByText("bible.com extension connected, windows 1, 2 open."),
  ).toBeVisible();

  await rows(page).first().click();
  await page.keyboard.press("Enter");
  // John 3:16 in both windows: Romanian in 1, Ukrainian in 2.
  await page.evaluate(() => {
    const project = (window as unknown as { project: (m: unknown) => void })
      .project;
    project({
      action: "verse",
      payload: {
        index: 1,
        reference: "Ioan 3:16",
        text: "Fiindcă atât de mult",
      },
    });
    project({
      action: "verse",
      payload: {
        index: 2,
        reference: "Івана 3:16",
        text: "Бо так полюбив Бог",
      },
    });
  });
  await expect(
    page.getByText("Verse from bible.com: Ioan 3:16 · Івана 3:16"),
  ).toBeVisible();
  // Every screen gets it, and phones following along.
  await expect
    .poll(async () => {
      const { body } = await api(page, "GET", "/api/communities/unu-unu/live");
      return (body as { verse: unknown }).verse;
    })
    .toEqual({
      ro: { reference: "Ioan 3:16", text: "Fiindcă atât de mult" },
      uk: { reference: "Івана 3:16", text: "Бо так полюбив Бог" },
    });
  const phone = await (await browser.newContext()).newPage();
  await phone.goto("/unu-unu/follow");
  await expect(phone.getByText("Fiindcă atât de mult")).toBeVisible();
  await phone.context().close();

  await page.getByRole("button", { name: "Back to the playlist" }).click();
  await expect(page.getByText(/Verse from bible.com/)).toHaveCount(0);
});
