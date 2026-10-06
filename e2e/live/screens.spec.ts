import { expect, test } from "@playwright/test";
import { api, expectTitleSafe, logInAs, openSteadyPage } from "../helpers";
import { base, rows, servicePlaylist } from "./playlist";

// Every test here changes the one room's live state, so they run one after another.
test.describe.configure({ mode: "serial" });

test("the owner adds a screen in two languages; a new link stops the old one", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ana@example.com");
  const id = await servicePlaylist(page);
  await page.goto("/unu-unu/settings/screens");
  await page.getByRole("button", { name: "Add a screen" }).click();
  await page.getByLabel("Name").fill("Proiector RO + UK");
  await page.getByRole("button", { name: /Second language/ }).click();
  await page.getByRole("option", { name: "Ukrainian" }).click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const row = page.getByRole("listitem", { name: "Proiector RO + UK" });
  await expect(row).toContainText("RO + UK");
  const link = await row
    .getByRole("link", { name: "Open" })
    .getAttribute("href");
  if (!link) throw new Error("no link");

  const screen = await browser.newPage();
  await screen.goto(link);
  await page.goto(`/unu-unu/playlists/${id}`);
  await rows(page).first().click();
  await page.keyboard.press("Enter");
  // Both languages at once.
  await expect(screen.getByText("Amazing grace how sweet")).toBeVisible();
  await expect(screen.getByText("Слава Тобі")).toBeVisible();
  // Inside a TV's title-safe area, 5% from each edge.
  await expectTitleSafe(screen, [
    screen.getByText("Amazing grace how sweet"),
    screen.getByText("Слава Тобі"),
  ]);

  page.once("dialog", (dialog) => void dialog.accept());
  await page.goto("/unu-unu/settings/screens");
  await row.getByRole("button", { name: "New link" }).click();
  await expect(
    screen.getByText("This screen's link no longer works."),
  ).toBeVisible();
  await screen.close();
});

test("a broadcast overlay shows the slide as a lower third on its background", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ana@example.com");
  const { body } = await api(page, "POST", "/api/communities/unu-unu/screens", {
    name: "Stream",
    type: "overlay",
    languages: ["ro"],
    settings: { overlayBackground: "green" },
  });
  const secret = (body as { secret: string }).secret;
  const id = await servicePlaylist(page);
  const overlay = await browser.newPage();
  await overlay.goto(`/s/${secret}`);
  await page.goto(`/unu-unu/playlists/${id}`);
  await rows(page).first().click();
  await page.keyboard.press("Enter");

  await expect(overlay.getByText("Amazing grace how sweet")).toBeVisible();
  await expect(overlay.locator("body")).toHaveCSS(
    "background-color",
    "rgb(0, 177, 64)",
  );
  // Blank leaves only the background.
  await page.keyboard.press("Escape");
  await expect(overlay.getByText("Amazing grace how sweet")).toBeHidden();
  await overlay.close();
});

test("the owner adds a start page; the team projects it until a song goes live", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ana@example.com");
  await page.goto("/unu-unu/settings/pages");
  await page.getByRole("button", { name: "Add a page" }).click();
  await page.getByLabel("Name").fill("Start");
  await page
    .getByLabel("Address", { exact: true })
    .fill("https://norless.test/start");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("listitem", { name: "Start" })).toBeVisible();
  await page.getByRole("button", { name: "Add a page" }).click();
  await page.getByLabel("Name").fill("Final");
  await page
    .getByLabel("Address", { exact: true })
    .fill("https://norless.test/final");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("listitem", { name: "Final" })).toBeVisible();

  const id = await servicePlaylist(page);
  const ro = await browser.newPage();
  await ro.goto("/unu-unu/projector/ro");
  await page.goto(`/unu-unu/playlists/${id}`);
  // Service or rehearsal is a status from the schedule, not a switch, under This device.
  await page.getByRole("button", { name: "This device" }).click();
  await expect(page.getByLabel(/^Mode: \w+, from the schedule$/)).toBeVisible();
  await expect(page.getByRole("button", { name: /^Mode:/ })).toHaveCount(0);
  // One small Pages menu; while a page shows, the button names it.
  await page.getByRole("button", { name: "Pages" }).click();
  await page.getByRole("menuitemradio", { name: "Start" }).click();
  const showing = page.getByRole("button", {
    name: "Pages: Start on the screens",
  });
  await expect(showing).toBeVisible();
  await expect(ro.locator('iframe[title="Start"]')).toHaveAttribute(
    "src",
    "https://norless.test/start",
  );
  // Its menu switches to another page, and takes the page off.
  await showing.click();
  await expect(
    page.getByRole("menuitemradio", { name: "Start", checked: true }),
  ).toBeVisible();
  await page.getByRole("menuitemradio", { name: "Final" }).click();
  await expect(ro.locator('iframe[title="Final"]')).toBeVisible();
  await page
    .getByRole("button", { name: "Pages: Final on the screens" })
    .click();
  await page
    .getByRole("menuitem", { name: "Take “Final” off the screens" })
    .click();
  await expect(ro.locator("iframe")).toHaveCount(0);
  await page.getByRole("button", { name: "Pages" }).click();
  await page.getByRole("menuitemradio", { name: "Start" }).click();
  await expect(showing).toBeVisible();
  // Esc takes it down too, once the menu has closed, and the button shows Pages again.
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(ro.locator('iframe[title="Start"]')).toHaveCount(0);
  await expect(showing).toHaveCount(0);
  await page.getByRole("button", { name: "Pages" }).click();
  await page.getByRole("menuitemradio", { name: "Start" }).click();
  await expect(showing).toBeVisible();

  await rows(page).first().click();
  await page.keyboard.press("Enter");
  await expect(ro.locator('iframe[title="Start"]')).toHaveCount(0);
  await expect(showing).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Pages" })).toBeVisible();
  await ro.close();
});

test("the team sees an indicator only while there's a problem, and the entries it's about", async ({
  page,
}) => {
  await logInAs(page, "ana@example.com");
  // A projector per language, as in Unu-Unu.
  for (const language of ["ro", "uk"])
    await api(page, "POST", "/api/communities/unu-unu/screens", {
      name: `Proiector ${language.toUpperCase()}`,
      type: "projector",
      languages: [language],
    });
  const { body } = await api(page, "POST", base, { title: "Cu probleme" });
  const id = (body as { id: string }).id;
  await api(page, "POST", `${base}/${id}/entries`, {
    kind: "song",
    songId: "isus",
  });
  await page.goto(`/unu-unu/playlists/${id}`);

  // "Isus e Domn" has no Ukrainian version, and a screen shows Ukrainian.
  await page.getByRole("button", { name: /^\d+ problems?$/ }).click();
  await expect(page.getByText("No Ukrainian version").first()).toBeVisible();
  await expect(
    rows(page)
      .first()
      .getByLabel(/No Ukrainian version/),
  ).toBeVisible();

  // A playlist with nothing wrong shows no indicator.
  const { body: fine } = await api(page, "POST", base, {
    title: "Fără probleme",
  });
  await page.goto(`/unu-unu/playlists/${(fine as { id: string }).id}`);
  await expect(page.getByLabel("Estimated end")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^\d+ problems?$/ }),
  ).toHaveCount(0);
});

test("a screen's look: background image, clock, and a style per section type", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ana@example.com");
  const { body } = await api(page, "POST", "/api/communities/unu-unu/screens", {
    name: "Proiector cu fundal",
    type: "projector",
    languages: ["ro"],
    settings: {
      backgroundImage: "https://norless.test/fundal.jpg",
      imageOpacity: 0.3,
      sectionStyles: { refrain: { italic: false, bold: true } },
    },
  });
  const screen = body as { secret: string };
  await api(page, "POST", "/api/communities/unu-unu/live", {
    type: "go",
    entryId: "steady-1",
    slide: 1,
  });
  const projector = await browser.newPage();
  await projector.goto(`/s/${screen.secret}`);
  const refrain = projector.locator("[data-fit] > div").first();
  await expect(refrain).toHaveCSS("font-weight", "700");
  await expect(refrain).toHaveCSS("font-style", "normal");
  await expect(projector.locator('[aria-hidden="true"].bg-cover')).toHaveCSS(
    "opacity",
    "0.3",
  );

  // The clock, switched on in the settings.
  await page.goto("/unu-unu/settings/screens");
  await page
    .getByRole("listitem", { name: "Proiector cu fundal" })
    .getByRole("button", { name: "Edit" })
    .click();
  await page.getByText("Show the time").click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(projector.getByText(/^\d{1,2}:\d{2}/)).toBeVisible();
  await projector.close();
});

test("the team opens a screen full screen on the projector, and the display is remembered", async ({
  page,
}) => {
  // A laptop with a projector as its second display, in a browser that lets pages choose.
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    // Granted before, so opening a screen doesn't ask again.
    const query = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = (async (descriptor: PermissionDescriptor) =>
      descriptor.name === ("window-management" as PermissionName)
        ? ({ state: "granted" } as PermissionStatus)
        : query(descriptor)) as typeof navigator.permissions.query;
    w.getScreenDetails = async () => ({
      screens: [
        {
          label: "Built-in",
          isPrimary: true,
          availLeft: 0,
          availTop: 0,
          availWidth: 1440,
          availHeight: 900,
        },
        {
          label: "Projector",
          isPrimary: false,
          availLeft: 1440,
          availTop: 0,
          availWidth: 1920,
          availHeight: 1080,
        },
      ],
    });
    w.opened = [];
    w.open = (url: string, _target: string, features: string) => {
      (w.opened as string[]).push(`${url} ${features}`);
      return null;
    };
  });
  await logInAs(page, "ana@example.com");
  const { body } = await api(page, "POST", "/api/communities/unu-unu/screens", {
    name: "Proiector pe afișaj",
    type: "projector",
    languages: ["ro"],
  });
  const { secret } = body as { secret: string };
  const lastOpened = () =>
    page.evaluate(() => {
      const opened = (window as unknown as { opened: string[] }).opened;
      return opened[opened.length - 1] ?? "";
    });
  const menu = () =>
    page.getByRole("button", { name: "Screens", exact: true }).click();

  await openSteadyPage(page);
  await menu();
  await page
    .getByRole("menuitem", { name: "Open Proiector pe afișaj" })
    .click();
  await expect.poll(lastOpened).toContain(`/s/${secret}`);
  expect(await lastOpened()).toMatch(/fullscreen,left=1440,top=0,width=1920/);

  // Chosen on the laptop's own display, the screen opens there from now on.
  await menu();
  await page.getByRole("menuitem", { name: "Choose displays" }).click();
  await menu();
  await page
    .getByRole("group", { name: "Proiector pe afișaj" })
    .getByRole("menuitem", { name: "Display 1" })
    .click();
  await expect.poll(lastOpened).toMatch(/left=0,top=0,width=1440/);
  await page.reload();
  await menu();
  await page
    .getByRole("menuitem", { name: "Open Proiector pe afișaj" })
    .click();
  await expect.poll(lastOpened).toMatch(/left=0,top=0,width=1440/);
});

test("the team pairs a TV with its code; it stays the screen after a restart, until unpaired", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ioana@example.com");
  await api(page, "POST", "/api/communities/unu-unu/live", {
    type: "go",
    entryId: "steady-1",
    slide: 0,
  });
  const owner = await (await browser.newContext()).newPage();
  await logInAs(owner, "ana@example.com");
  await api(owner, "POST", "/api/communities/unu-unu/screens", {
    name: "Proiector TV",
    type: "projector",
    languages: ["ro"],
  });
  await owner.context().close();

  const tv = await (await browser.newContext()).newPage();
  await tv.goto("/pair");
  const code = tv.getByLabel("Pairing code");
  await expect(code).toHaveText(/^\d{3} \d{3}$/);

  await openSteadyPage(page);
  await page.getByRole("button", { name: "Screens", exact: true }).click();
  await page.getByRole("menuitem", { name: "Pair a device…" }).click();
  const dialog = page.getByRole("dialog", { name: "Pair a device" });
  await dialog
    .getByRole("textbox", { name: "Pairing code" })
    .fill((await code.textContent()) ?? "");
  await dialog.getByRole("button", { name: "Screen" }).click();
  await page.getByRole("option", { name: "Proiector TV" }).click();
  await dialog.getByRole("button", { name: "Pair", exact: true }).click();
  await expect(tv.getByText("Amazing grace how sweet")).toBeVisible();
  await tv.reload();
  await expect(tv.getByText("Amazing grace how sweet")).toBeVisible();

  await dialog
    .getByRole("listitem", { name: "Proiector TV" })
    .getByRole("button", { name: "Unpair" })
    .click();
  await expect(tv.getByLabel("Pairing code")).toHaveText(/^\d{3} \d{3}$/);
  await tv.context().close();
});

test("the TV's QR code opens the pairing dialog with the code filled in", async ({
  page,
  browser,
}) => {
  const tv = await (await browser.newContext()).newPage();
  await tv.goto("/pair");
  const shown = tv.getByLabel("Pairing code");
  await expect(shown).toHaveText(/^\d{3} \d{3}$/);
  await expect(
    tv.getByRole("img", { name: "QR code to pair this device from a phone" }),
  ).toHaveAttribute("src", /^data:image\/svg\+xml/);
  const code = ((await shown.textContent()) ?? "").replace(" ", "");

  // Where the QR code leads, on the phone of someone on the team.
  await logInAs(page, "ana@example.com");
  await api(page, "POST", "/api/communities/unu-unu/screens", {
    name: "Scena TV",
    type: "stage",
    languages: ["ro"],
  });
  await page.goto(`/pair/${code}`);
  const dialog = page.getByRole("dialog", { name: "Pair a device" });
  await expect(
    dialog.getByRole("textbox", { name: "Pairing code" }),
  ).toHaveValue(code);
  await dialog.getByRole("button", { name: "Screen" }).click();
  await page.getByRole("option", { name: "Scena TV" }).click();
  await dialog.getByRole("button", { name: "Pair", exact: true }).click();
  await expect(
    dialog.getByRole("listitem", { name: "Scena TV" }),
  ).toBeVisible();
  await expect(tv.getByLabel("Pairing code")).toHaveCount(0);
  await tv.context().close();
});
