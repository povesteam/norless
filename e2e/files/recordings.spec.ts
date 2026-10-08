import { type Page } from "@playwright/test";
import { api, expect, logInAs, test } from "../helpers";

test.describe.configure({ mode: "serial" });
// Chromium's fake microphone plays a tone, without asking.
test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
  permissions: ["microphone"],
});

const base = "/api/communities/repetitii";

async function twoSongs(page: Page) {
  await logInAs(page, "maria@example.com");
  const ids: string[] = [];
  for (const [title, text] of [
    ["Cântați Domnului", "1:\nCântați Domnului toți\n\nR:\nAleluia"],
    ["Mare ești Tu", "Mare ești Tu, Doamne"],
  ]) {
    const song = await api(page, "POST", `${base}/songs`, {
      versions: [{ language: "ro", title, text }],
    });
    ids.push((song.body as { id: string }).id);
  }
  await logInAs(page, "radu@example.com");
  const playlist = await api(page, "POST", `${base}/playlists`, {
    title: "Repetiție de joi",
  });
  const playlistId = (playlist.body as { id: string }).id;
  const entries: string[] = [];
  for (const songId of ids) {
    const entry = await api(
      page,
      "POST",
      `${base}/playlists/${playlistId}/entries`,
      {
        kind: "song",
        songId,
      },
    );
    entries.push((entry.body as { id: string }).id);
  }
  return { entries, songs: ids, playlistId };
}

test("a team member records a rehearsal through two songs and plays the refrain again; another asks and is let in", async ({
  page,
  browser,
}) => {
  const {
    entries: [first, second],
    songs: [firstSong],
  } = await twoSongs(page);
  await api(page, "POST", `${base}/live`, { type: "go", entryId: first });

  await page.goto("/repetitii/instruments");
  await page.getByRole("button", { name: "Record", exact: true }).click();
  // The first time on this device: everyone in the room is recorded.
  await expect(page.getByText("Tell them before you start")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.getByText("Recording · Radu")).toBeVisible();
  // A visitor's stage screen shows it, without the name.
  const stage = await (await browser.newContext()).newPage();
  await stage.goto("/repetitii/vocals");
  await expect(stage.getByText("Recording", { exact: true })).toBeVisible();

  await page.waitForTimeout(3000);
  await api(page, "POST", `${base}/live`, {
    type: "go",
    entryId: first,
    slide: 1,
  });
  await page.waitForTimeout(3000);
  await api(page, "POST", `${base}/live`, { type: "go", entryId: second });
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: /^Stop/ }).click();
  await expect(
    page.getByRole("button", { name: "Record", exact: true }),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(stage.getByText("Recording", { exact: true })).toBeHidden();

  // A file per song, the first with its parts.
  await page.goto("/repetitii/recordings");
  await page.getByRole("link", { name: /\d/ }).first().click();
  const files = page.getByRole("listitem");
  await expect(files).toHaveCount(2);
  await expect(files.first()).toContainText("Cântați Domnului");
  await expect(files.nth(1)).toContainText("Mare ești Tu");
  // Saved under the date and the song's title, in m4a.
  await expect(
    files.first().getByRole("link", { name: "Download" }),
  ).toHaveAttribute("download", /^\d{4}-\d{2}-\d{2} Cântați Domnului\.m4a$/);
  await files.first().getByRole("button", { name: "Refrain" }).click();
  await expect
    .poll(() =>
      files
        .first()
        .locator("audio")
        .evaluate((audio: HTMLAudioElement) => audio.currentTime),
    )
    .toBeGreaterThan(2);
  const recording = page.url();

  // Ioana asks; Radu lets her listen.
  await logInAs(page, "ioana@example.com");
  await page.goto(recording);
  await expect(page.locator("audio")).toHaveCount(0);
  await page.getByRole("button", { name: "Ask for access" }).click();
  await expect(page.getByText("You asked for access")).toBeVisible();
  await logInAs(page, "radu@example.com");
  await page.goto("/repetitii/recordings");
  await expect(page.getByText("1 asking for access")).toBeVisible();
  await page.goto(recording);
  await page.getByRole("button", { name: "Let them listen" }).click();
  await expect(page.getByText("Can listen")).toBeVisible();
  await logInAs(page, "ioana@example.com");
  await page.goto(recording);
  await expect(page.locator("audio")).toHaveCount(2);

  // The song's page has its file, to play there.
  await page.goto(`/repetitii/songs/${firstSong}`);
  const onSong = page.getByRole("region", { name: "Recordings" });
  await expect(onSong.getByRole("listitem")).toHaveCount(1);
  await expect(onSong.getByRole("listitem")).toContainText("by Radu");
  await expect(onSong.locator("audio")).toHaveCount(1);
});

test("the live panel folds this device's setup, remembers it, and says while it records", async ({
  page,
}) => {
  const {
    entries: [first],
    playlistId,
  } = await twoSongs(page);
  await api(page, "POST", `${base}/live`, { type: "go", entryId: first });
  await page.goto(`/repetitii/playlists/${playlistId}`);
  const device = page.getByRole("button", { name: "This device" });
  const record = page.getByRole("button", { name: "Record", exact: true });
  await expect(device).toHaveAttribute("aria-expanded", "false");
  await expect(record).toBeHidden();
  await expect(page.getByRole("button", { name: "Next" })).toBeVisible();

  await device.click();
  await page.reload();
  await expect(device).toHaveAttribute("aria-expanded", "true");
  await record.click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Start recording" }).click();
  await expect(page.getByRole("button", { name: /^Stop/ })).toBeVisible();
  // Folded, it records on and says so.
  await device.click();
  await expect(page.getByText("Recording", { exact: true })).toBeVisible();
  await page.waitForTimeout(2000);
  await device.click();
  await page.getByRole("button", { name: /^Stop/ }).click();
  await expect(record).toBeVisible({ timeout: 20_000 });
  // The next time, this device starts at once, without the notice.
  await record.click();
  await expect(page.getByRole("button", { name: /^Stop/ })).toBeVisible();
  await expect(page.getByText("Tell them before you start")).toHaveCount(0);
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /^Stop/ }).click();
  await expect(record).toBeVisible({ timeout: 20_000 });
});

test("a song's recordings are marked on its row, leading to them", async ({
  page,
}) => {
  await logInAs(page, "ioana@example.com");
  // As if the first song had two recordings, with the recordings switched on.
  await page.route(
    "**/api/communities/unu-unu/playlists/steady",
    async (route) => {
      const playlist = (await (await route.fetch()).json()) as {
        entries: { song: { recordings?: number } | null }[];
      };
      const first = playlist.entries.find((e) => e.song);
      if (first?.song) first.song.recordings = 2;
      await route.fulfill({ json: playlist });
    },
  );
  await page.route("**/api/communities/unu-unu", async (route) => {
    const community = (await (await route.fetch()).json()) as {
      switches: object;
    };
    await route.fulfill({
      json: {
        ...community,
        switches: { ...community.switches, recordings: true },
      },
    });
  });
  await page.goto("/unu-unu/playlists/steady");
  const mark = page.getByRole("link", { name: "2 recordings" });
  await expect(mark).toHaveAttribute(
    "href",
    /\/unu-unu\/songs\/.+#recordings$/,
  );
});
