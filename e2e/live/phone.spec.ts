import { expect, test } from "@playwright/test";
import { api, logInAs } from "../helpers";
import { base, rows, servicePlaylist } from "./playlist";

// Every test here changes the one room's live state, so they run one after another.
test.describe.configure({ mode: "serial" });

test.describe("on a phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("the team swipes between Order, Song and Screens, with next always at the bottom", async ({
    page,
  }) => {
    await logInAs(page, "ioana@example.com");
    const id = await servicePlaylist(page);
    await page.goto(`/unu-unu/playlists/${id}`);
    await expect(page.getByRole("region", { name: "Order" })).toBeVisible();
    await page.getByRole("button", { name: "Song", exact: true }).click();
    await expect(page.getByRole("region", { name: "Song" })).toBeInViewport();
    await expect(page.getByRole("button", { name: "Next" })).toBeInViewport();
  });

  test("the Song view shows one language, chosen above the parts and kept on the phone", async ({
    page,
  }) => {
    await logInAs(page, "ioana@example.com");
    await page.goto("/unu-unu/playlists/steady");
    await rows(page).first().click();
    const song = page.getByRole("region", { name: "Song" });
    await expect(song).toBeInViewport();
    await expect(song.getByText("Amazing grace how sweet")).toBeVisible();
    await expect(song.getByText("Слава Тобі")).toHaveCount(0);
    await song.getByRole("radio", { name: "UA" }).click();
    await expect(song.getByText("Слава Тобі")).toBeVisible();
    await expect(song.getByText("Amazing grace how sweet")).toHaveCount(0);
    await page.reload();
    await rows(page).first().click();
    await expect(song.getByText("Слава Тобі")).toBeVisible();
  });

  test("the live bar shows only the title and Previous, Blank and Next until it's opened, and stays as chosen", async ({
    page,
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
    await page.goto(`/unu-unu/playlists/${id}`);
    const parts = page.getByRole("group", { name: "Parts" });
    await expect(page.getByRole("button", { name: "Next" })).toBeInViewport();
    // Nothing in the views beside Order widens the page, which would zoom it out.
    expect(await page.evaluate(() => innerWidth)).toBe(390);
    await expect(page.getByRole("button", { name: "Blank" })).toBeVisible();
    await expect(parts).toHaveCount(0);

    await page.getByRole("button", { name: "More controls" }).click();
    await expect(parts).toBeVisible();
    await page.reload();
    await expect(parts).toBeVisible();
    await page.getByRole("button", { name: "Fewer controls" }).click();
    await expect(parts).toHaveCount(0);

    // The title opens and folds it too: a tap, or a drag up and down.
    const title = async () => {
      const bar = await page.locator("[data-bottom-bar]").boundingBox();
      return { x: (bar?.x ?? 0) + 200, y: (bar?.y ?? 0) + 24 };
    };
    const drag = async (by: number) => {
      const { x, y } = await title();
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y + by, { steps: 4 });
      await page.mouse.up();
    };
    let at = await title();
    await page.touchscreen.tap(at.x, at.y);
    await expect(parts).toBeVisible();
    at = await title();
    await page.touchscreen.tap(at.x, at.y);
    await expect(parts).toHaveCount(0);
    await drag(-40);
    await expect(parts).toBeVisible();
    // A drag selects nothing: the next would drag the selected text instead.
    expect(await page.evaluate(() => getSelection()?.toString())).toBe("");
    await drag(40);
    await expect(parts).toHaveCount(0);
  });

  test("the stage monitor colors the phone's bars and offers full screen; vocalists wrap long lines", async ({
    page,
  }) => {
    await logInAs(page, "ana@example.com");
    const { body } = await api(page, "POST", "/api/communities/unu-unu/songs", {
      versions: [
        {
          language: "ro",
          title: "Rând lung",
          text: "R:\nVoi proclama domnia Ta pe pământ și-n ceruri, în veci de veci",
        },
      ],
    });
    const songId = (body as { id: string }).id;
    const list = (
      (await api(page, "POST", base, { title: "Rânduri lungi" })).body as {
        id: string;
      }
    ).id;
    const entry = (
      (
        await api(page, "POST", `${base}/${list}/entries`, {
          kind: "song",
          songId,
        })
      ).body as { id: string }
    ).id;
    await api(page, "POST", "/api/communities/unu-unu/live", {
      type: "go",
      entryId: entry,
    });

    await page.goto("/unu-unu/stage");
    await expect(page.getByText("Voi proclama")).toBeVisible();
    await expect(
      page.locator('meta[name="theme-color"]').first(),
    ).toHaveAttribute("content", "rgb(0, 0, 0)");
    await expect(
      page.getByRole("button", { name: "Fullscreen" }),
    ).toBeVisible();

    await page.goto("/unu-unu/vocals");
    await page.getByRole("radio", { name: "Whole song" }).click();
    await expect(page.getByText("Voi proclama")).toBeVisible();
    // Nothing scrolls sideways: the long line continues on the next row.
    expect(
      await page.evaluate(
        () =>
          [...document.querySelectorAll("*")].filter(
            (e) =>
              getComputedStyle(e).overflowY === "auto" &&
              e.scrollWidth > e.clientWidth + 1,
          ).length,
      ),
    ).toBe(0);
  });

  test("a tap on an entry shows its parts without sending it live; Go live sends it", async ({
    page,
  }) => {
    await logInAs(page, "ioana@example.com");
    const id = await servicePlaylist(page);
    await page.goto(`/unu-unu/playlists/${id}`);
    await rows(page).filter({ hasText: "Isus e Domn" }).tap();
    const song = page.getByRole("region", { name: "Song" });
    await expect(song).toBeInViewport();
    await expect(song.getByText("Cântăm cu bucurie")).toBeVisible();
    await expect(
      rows(page).filter({ hasText: "Isus e Domn" }),
    ).not.toContainText("Live");
    await song.getByRole("button", { name: "Go live" }).click();
    await expect(rows(page).filter({ hasText: "Isus e Domn" })).toContainText(
      "Live",
    );
  });

  test("Project here fills the phone's page; taps go next and back; Back returns, still projecting", async ({
    page,
  }) => {
    let windows = 0;
    page.on("popup", () => windows++);
    await page.goto("/unu-unu/songs/grace");
    await page.getByRole("button", { name: "Project here" }).click();
    const projector = page.getByRole("dialog", { name: "Projector" });
    await expect(projector.getByText("Amazing grace how sweet")).toBeVisible();
    const box = (await projector.boundingBox()) ?? { width: 0, height: 0 };
    await page.mouse.click(box.width * 0.75, box.height / 2);
    await expect(
      projector.locator("[data-fit]").getByText(/Slavă/),
    ).toBeVisible();
    await page.mouse.click(box.width * 0.25, box.height / 2);
    await expect(projector.getByText("Amazing grace how sweet")).toBeVisible();
    await page.goBack();
    await expect(projector).toHaveCount(0);
    await expect(page).toHaveURL("/unu-unu/songs/grace");
    await page.getByRole("button", { name: "Projector window" }).click();
    await expect(projector.getByText("Amazing grace how sweet")).toBeVisible();
    expect(windows).toBe(0);
  });
});
