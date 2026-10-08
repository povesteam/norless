import { api, expect, logInAs, test } from "../helpers";

test.describe.configure({ mode: "serial" });
test.use({
  launchOptions: {
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  },
  permissions: ["microphone"],
});

const base = "/api/communities/tempo";

test("a device listens; the stage shows the band speeding up; the measured tempo is suggested and used", async ({
  page,
  browser,
}) => {
  await logInAs(page, "maria@example.com");
  const song = await api(page, "POST", `${base}/songs`, {
    versions: [{ language: "ro", title: "Ce mare ești", text: "Ce mare ești" }],
  });
  const songId = (song.body as { id: string }).id;
  await logInAs(page, "radu@example.com");
  await api(page, "PUT", `${base}/songs/${songId}/tempo`, { bpm: 72 });
  const playlist = await api(page, "POST", `${base}/playlists`, {
    title: "Duminică",
  });
  const playlistId = (playlist.body as { id: string }).id;
  const entry = await api(
    page,
    "POST",
    `${base}/playlists/${playlistId}/entries`,
    {
      kind: "song",
      songId,
    },
  );
  await api(page, "POST", `${base}/live`, {
    type: "go",
    entryId: (entry.body as { id: string }).id,
  });

  // This device listens, through the (fake) microphone.
  await page.goto("/tempo/instruments");
  await page
    .getByRole("button", { name: "Listen for tempo", exact: true })
    .click();
  await page.getByRole("button", { name: "Start listening" }).click();
  const listening = page.getByRole("button", { name: /^Listening · / });
  await expect(listening).toBeVisible();
  // A level of what it hears: the fake microphone beeps once a second; on a busy
  // machine the audio may take a few seconds to start.
  const level = listening.locator("[data-level] > span");
  await expect
    .poll(
      () =>
        level.evaluate(
          (bar) => new DOMMatrix(getComputedStyle(bar).transform).a,
        ),
      { timeout: 10_000, intervals: [100] },
    )
    .toBeGreaterThan(0);

  // What the listening device sends when the band is off for long enough.
  const stage = await (await browser.newContext()).newPage();
  await stage.goto("/tempo/stage");
  await api(page, "POST", `${base}/live/tempo`, {
    listening: true,
    measured: 77,
    drift: "fast",
  });
  await expect(stage.getByText("Speeding up · 77 → 72")).toBeVisible();
  await api(page, "POST", `${base}/live/tempo`, {
    listening: true,
    drift: null,
  });
  await expect(stage.getByText("Speeding up · 77 → 72")).toBeHidden();
  // Stopping goes straight back to Listen for tempo, not "instead of" itself.
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { seen: string[] }).seen = seen;
    new MutationObserver(() => seen.push(document.body.innerText)).observe(
      document.body,
      { subtree: true, childList: true, characterData: true },
    );
  });
  await page.getByRole("button", { name: /^Listening/ }).click();
  await expect(
    page.getByRole("button", { name: "Listen for tempo", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(500);
  expect(
    (
      await page.evaluate(() => (window as unknown as { seen: string[] }).seen)
    ).filter((text) => text.includes("instead of")),
  ).toEqual([]);
  // In the stage views' row the icon opens the choice each time, with the input's
  // level (no arrow beside it).
  await page
    .getByRole("button", { name: "Listen for tempo", exact: true })
    .click();
  await expect(page.getByText("Input level")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Choose the input to listen for tempo" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close" }).click();

  // Checks from past services: the song suggests their median.
  for (const bpm of [70, 69, 71])
    await api(page, "POST", `${base}/songs/${songId}/tempo-checks`, { bpm });
  await page.goto(`/tempo/songs/${songId}`);
  await expect(page.getByText("Measured: 70 BPM")).toBeVisible();
  await page.getByRole("button", { name: "Use it" }).click();
  await expect(page.getByText("Tempo: 70 BPM")).toBeVisible();
  await expect(page.getByText("Measured: 70 BPM")).toHaveCount(0);
});
