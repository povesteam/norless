import { expect, test } from "@playwright/test";
import { api, logInAs, openSteadyPage, pickLayout } from "../helpers";
import { rows, servicePlaylist } from "./playlist";

// Every test here changes the one room's live state, so they run one after another.
test.describe.configure({ mode: "serial" });

test("a practice room runs beside the service: its slides don't touch the main screens, others join it by its link", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ioana@example.com");
  const id = await servicePlaylist(page);
  // The main room blank, whatever the tests before left live in it.
  await api(page, "POST", "/api/communities/unu-unu/live", {
    type: "blank",
    blank: true,
  });
  const ro = await browser.newPage();
  await ro.goto("/unu-unu/projector/ro");

  await page.goto(`/unu-unu/playlists/${id}`);
  // The room is this device's (live-control spec, This device), remembered open.
  await page.getByRole("button", { name: "This device" }).click();
  await page.getByRole("button", { name: /^Room: Main room/ }).click();
  await page.getByRole("menuitem", { name: "Start a practice room" }).click();
  const dialog = page.getByRole("dialog", { name: "Start a practice room" });
  await dialog.getByRole("button", { name: "Start" }).click();
  await expect(
    page.getByRole("button", { name: "Room: Practice · Ioana" }),
  ).toBeVisible();
  // Other tests make playlists too: this one's, in the practice room still.
  await page.goto(`/unu-unu/playlists/${id}`);
  await expect(
    page.getByRole("button", { name: "Room: Practice · Ioana" }),
  ).toBeVisible();

  await rows(page).first().dblclick();
  await expect(rows(page).first()).toContainText("Live");
  // The main projector shows nothing new.
  await expect(ro.getByText("Amazing grace how sweet")).toHaveCount(0);

  const [room] = (await api(page, "GET", "/api/communities/unu-unu/rooms"))
    .body as { id: string }[];
  const singer = await (await browser.newContext()).newPage();
  await logInAs(singer, "ana@example.com");
  await singer.goto(`/unu-unu/join/${room?.id}`);
  await singer.getByRole("button", { name: "Follow this room" }).click();
  await singer.getByRole("link", { name: "Vocals" }).click();
  await expect(singer.getByText("Amazing grace how sweet")).toBeVisible();
  await expect(singer.getByText("Practice room")).toBeVisible();

  // Ended: its devices are back in the main room.
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Room: Practice · Ioana" }).click();
  await page.getByRole("menuitem", { name: "End this room" }).click();
  await expect(
    page.getByRole("button", { name: /^Room: Main room/ }),
  ).toBeVisible();
  await expect(singer.getByText("Practice room")).toHaveCount(0);
});

test("on a laptop the team picks Controller, Running order or Big now and next", async ({
  page,
}) => {
  // Its own team member: the layout chosen is the member's, on every laptop.
  await logInAs(page, "sorin@example.com");
  const id = await servicePlaylist(page);
  await page.goto(`/unu-unu/playlists/${id}`);
  await rows(page).first().click();
  await page.keyboard.press("Enter");

  // Controller: the live song's parts in the middle, both languages side by side,
  // and a preview of each projector.
  const slides = page.getByRole("list", { name: "Slides" });
  await expect(slides.getByRole("listitem").first()).toContainText(
    "Amazing grace",
  );
  await expect(slides.getByRole("listitem").first()).toContainText(
    "Слава Тобі",
  );
  const previews = page.getByRole("group", {
    name: "What the projectors show",
  });
  await expect(previews.getByText("Amazing grace how sweet")).toBeVisible();
  // The whole slide, as small as the card: its text inside it, not cut off.
  const card = await previews.getByLabel("Projector RO").boundingBox();
  const line = await previews
    .getByLabel("Projector RO")
    .getByText("Amazing grace how sweet")
    .boundingBox();
  expect(line?.x).toBeGreaterThanOrEqual(card?.x ?? 0);
  expect((line?.x ?? 0) + (line?.width ?? 0)).toBeLessThanOrEqual(
    (card?.x ?? 0) + (card?.width ?? 0),
  );

  await pickLayout(page, "Running order");
  const order = page.getByRole("list", { name: "Running order" });
  await expect(
    order.getByRole("listitem", { name: "Isus e Domn" }),
  ).toContainText("Cântăm cu bucurie");

  await pickLayout(page, "Big now and next");
  await expect(page.getByText("Next: Refrain")).toBeVisible();
  // The choice stays for laptops.
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Layout: Big now and next" }),
  ).toBeVisible();
  await pickLayout(page, "Controller");
});

test("in Classic, an empty playlist disables the live buttons and offers songs not played lately", async ({
  page,
}) => {
  // Sorin's layout is his own on every laptop; it goes back to Controller at the end.
  await logInAs(page, "sorin@example.com");
  const live = await servicePlaylist(page);
  await page.goto(`/unu-unu/playlists/${live}`);
  await pickLayout(page, "Classic");
  await rows(page).first().dblclick();
  await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();

  const { body } = await api(
    page,
    "POST",
    "/api/communities/unu-unu/playlists",
    {
      title: "Goală",
    },
  );
  await page.goto(`/unu-unu/playlists/${(body as { id: string }).id}`);
  for (const name of ["Blank", "Previous", "Next"])
    await expect(page.getByRole("button", { name })).toBeDisabled();
  const lately = page.getByRole("list", { name: "Not played lately" });
  await lately.getByRole("button", { name: /Isus e Domn/ }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Isus e Domn");
  await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();
  await expect(lately).toHaveCount(0);
  await pickLayout(page, "Controller");
});

test("media keys, once switched on, move the slides and blank, and name the song for the lock screen", async ({
  page,
}) => {
  // The browser's media session, with the actions the page gives it to call.
  await page.addInitScript(() => {
    const handlers = new Map<string, () => void>();
    (window as unknown as { media: typeof handlers }).media = handlers;
    const session = navigator.mediaSession;
    const set = session.setActionHandler.bind(session);
    session.setActionHandler = (action, handler) => {
      if (handler) handlers.set(action, handler as () => void);
      else handlers.delete(action);
      set(action, handler);
    };
  });
  const press = (key: string) =>
    page.evaluate(
      (key) =>
        (window as unknown as { media: Map<string, () => void> }).media.get(
          key,
        )?.(),
      key,
    );
  const room = async () =>
    (await api(page, "GET", "/api/communities/unu-unu/live")).body as {
      slide: number;
      blank: boolean;
    };
  await logInAs(page, "ioana@example.com");
  const id = await servicePlaylist(page);
  await page.goto(`/unu-unu/playlists/${id}`);
  await rows(page).first().click();
  await page.keyboard.press("Enter");
  await expect(rows(page).first()).toContainText("Live");

  // Off, the keys stay with whatever else plays; under This device, remembered open.
  await page.getByRole("button", { name: "This device" }).click();
  const toggle = page.getByRole("button", { name: "Media keys" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await press("nexttrack");
  expect((await room()).slide).toBe(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await press("nexttrack");
  await expect.poll(async () => (await room()).slide).toBe(1);
  await press("previoustrack");
  await expect.poll(async () => (await room()).slide).toBe(0);
  await press("pause");
  await expect.poll(async () => (await room()).blank).toBe(true);
  await press("play");
  await expect.poll(async () => (await room()).blank).toBe(false);
  expect(
    await page.evaluate(() => navigator.mediaSession.metadata?.title),
  ).toBe("Har minunat");

  // Remembered on this device.
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Media keys" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Media keys" }).click();
});

test("an editor edits a song in the middle column, and the preview and controls stay", async ({
  page,
}) => {
  await logInAs(page, "ana@example.com");
  await openSteadyPage(page);
  await pickLayout(page, "Controller");
  await rows(page).first().click();
  await page.getByRole("button", { name: "Edit song" }).click();
  await expect(page.getByRole("heading", { name: "Edit song" })).toBeVisible();
  await expect(
    page.getByRole("group", { name: "What the projectors show" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Next" })).toBeVisible();
  await expect(page).toHaveURL("/unu-unu/playlists/steady");

  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("list", { name: "Slides" })).toBeVisible();
});

test("in Controller, the previews keep their column while the next song loads", async ({
  page,
}) => {
  await logInAs(page, "ioana@example.com");
  const id = await servicePlaylist(page);
  await page.goto(`/unu-unu/playlists/${id}`);
  const previews = page.getByRole("group", {
    name: "What the projectors show",
  });
  await rows(page).first().click();
  await expect(page.getByRole("list", { name: "Slides" })).toBeVisible();
  const before = await previews.boundingBox();
  // A slow song: nothing moves while it loads.
  await page.route("**/songs/isus", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await rows(page).nth(2).click();
  await page.waitForTimeout(300);
  expect(await previews.boundingBox()).toEqual(before);
  await expect(page.getByRole("list", { name: "Slides" })).toBeVisible();
  expect(await previews.boundingBox()).toEqual(before);
});
