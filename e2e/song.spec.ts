import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { api, createSong, expect, logInAs, test } from "./helpers";

test("a song's page shows its slides with chords, notes and details", async ({
  page,
}) => {
  const dialogs: string[] = [];
  page.on(
    "dialog",
    (dialog) =>
      void dialog.dismiss().then(() => dialogs.push(dialog.message())),
  );
  await page.goto("/unu-unu/songs/grace");

  await expect(
    page.getByRole("heading", { name: "Har minunat" }),
  ).toBeVisible();
  // The key with its icon instead of "Key:".
  await expect(
    page.getByRole("img", { name: "Key" }).first().locator(".."),
  ).toHaveText("G");
  await expect(page.getByText("Time: 3/4")).toBeVisible();
  await expect(page.getByText("har", { exact: true })).toBeVisible();

  // Chords sit above the text they start: a G just above "mazing".
  const lyricBox = await page
    .getByText("mazing", { exact: true })
    .boundingBox();
  const chords = await page
    .getByText("G", { exact: true })
    .evaluateAll((all) => all.map((e) => e.getBoundingClientRect().y));
  const above = (lyricBox?.y ?? 0) - 40;
  expect(chords.some((y) => y < (lyricBox?.y ?? 0) && y > above)).toBe(true);

  // The refrain, then its repeat; markup outside the allowlist stays text.
  await expect(page.getByText("<script>alert(1)</script>")).toHaveCount(2);
  await expect(page.getByText("ție", { exact: true }).first()).toHaveCSS(
    "font-style",
    "italic",
  );
  await expect(page.getByText("unison").first()).toBeVisible();
  // The last line ends with the final mark; it shares the verses' chords, which split
  // its words.
  await expect(page.getByText("*", { exact: true }).first()).toBeVisible();
  expect(dialogs).toEqual([]);

  // On a laptop both languages side by side, each named, every part too.
  const ukrainian = page.getByRole("region", { name: "Ukrainian" });
  await expect(ukrainian).toContainText("Тобі");
  await expect(ukrainian.getByText("*", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Romanian" }).getByText("Verse 1"),
  ).toBeVisible();
});

test("an unknown song is not found", async ({ page }) => {
  await page.goto("/unu-unu/songs/nothing");

  await expect(page.getByText("This page doesn't exist.")).toBeVisible();
});

test("a song played in a streamed service: Watch again opens the stream where it began", async ({
  page,
}) => {
  await logInAs(page, "maria@example.com");
  const id = await createSong(page, "Din nou", "1:\nCântăm din nou");
  // Sunday's stream from 07:00, the song live at 07:10.
  const db = new Database(join(tmpdir(), "norless-e2e.db"));
  db.prepare(
    `INSERT OR IGNORE INTO streams (id, community_id, video_id, started_at, ended_at, created_at, updated_at)
     VALUES ('replay-stream', 'c', 'sunday1234', '2026-01-04T07:00:00.000Z', '2026-01-04T09:00:00.000Z', 'x', 'x')`,
  ).run();
  db.prepare(
    `INSERT INTO plays (id, community_id, song_id, mode, played_at, created_at, updated_at)
     VALUES (?, 'c', ?, 'service', '2026-01-04T07:10:00.000Z', 'x', 'x')`,
  ).run(`replay-${id}`, id);
  db.close();
  // Owners switch it on.
  await logInAs(page, "ana@example.com");
  const { body } = await api(page, "GET", "/api/communities/unu-unu");
  await api(page, "PUT", "/api/communities/unu-unu/switches", {
    switches: { ...(body as { switches: object }).switches, replays: true },
  });

  await page.goto(`/unu-unu/songs/${id}`);
  const replays = page.getByRole("region", { name: "Watch again" });
  await expect(
    replays.getByRole("link", { name: "January 4, 2026" }),
  ).toHaveAttribute(
    "href",
    "https://www.youtube.com/watch?v=sunday1234&t=600s",
  );
});
