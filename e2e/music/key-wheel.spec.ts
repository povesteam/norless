import { api, expect, logInAs, test } from "../helpers";

test("the key wheel opens on the key, glides a tapped or dragged key to the middle, and keeps its buttons", async ({
  page,
}) => {
  await logInAs(page, "maria@example.com");
  const song = await api(page, "POST", "/api/communities/formatia/songs", {
    keySignature: "E",
    versions: [{ language: "ro", title: "Roata", text: "1:\n Text" }],
  });
  const songId = (song.body as { id: string }).id;
  await logInAs(page, "radu@example.com");
  const playlist = await api(
    page,
    "POST",
    "/api/communities/formatia/playlists",
    { title: "Roata cheilor" },
  );
  const id = (playlist.body as { id: string }).id;
  await api(page, "POST", `/api/communities/formatia/playlists/${id}/entries`, {
    kind: "song",
    songId,
  });
  await page.goto(`/formatia/playlists/${id}`);
  await page.getByRole("row", { name: "Roata" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Key for this service" }).click();
  const dialog = page.getByRole("dialog");
  const middle = (key: string) =>
    dialog.locator(`[data-key="${key}"]`).evaluate((item) => {
      const strip = item.parentElement?.getBoundingClientRect();
      const box = item.getBoundingClientRect();
      return strip
        ? Math.abs(
            Math.round(box.left + box.width / 2 - strip.left - strip.width / 2),
          )
        : NaN;
    });
  // Opened on the song's key, at once.
  expect(await middle("E")).toBe(0);
  // Both ways to save are there; the song's own key can't become its key.
  const forGood = dialog.getByRole("button", {
    name: "Save as the song’s key",
  });
  await expect(forGood).toBeDisabled();
  await dialog.locator('[data-key="D"]').click();
  await expect(dialog.getByRole("radio", { name: /^D\s*−2$/ })).toBeChecked();
  await expect(forGood).toBeEnabled();
  await expect.poll(() => middle("D")).toBe(0);

  // A mouse drags the strip a key to the left: the next key up comes to the middle.
  const key = await dialog.locator('[data-key="D"]').boundingBox();
  if (!key) throw new Error("no key");
  const y = key.y + key.height / 2;
  await page.mouse.move(key.x + key.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(key.x - 30, y, { steps: 5 });
  await page.mouse.move(key.x - key.width / 2 - 8, y, { steps: 5 });
  await page.mouse.up();
  await expect(dialog.getByRole("radio", { name: /^Eb\s*−1$/ })).toBeChecked();
  await expect.poll(() => middle("Eb")).toBe(0);
});
