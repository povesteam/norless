import { api, expect, logInAs, test } from "./helpers";

test("the team writes the host's words; the Host view shows what's live and next", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ana@example.com");
  const base = "/api/communities/unu-unu/playlists";
  const { body } = await api(page, "POST", base, { title: "Cu prezentator" });
  const id = (body as { id: string }).id;
  const { body: entry } = await api(page, "POST", `${base}/${id}/entries`, {
    kind: "text",
    text: "Colecta",
  });
  await api(page, "POST", `${base}/${id}/entries`, {
    kind: "text",
    text: "Predica",
  });

  await page.goto(`/unu-unu/playlists/${id}`);
  await page.getByRole("row", { name: "Colecta" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Host's words" }).click();
  const dialog = page.getByRole("dialog", { name: "Host's words: Colecta" });
  await dialog
    .getByRole("textbox", { name: "In Romanian" })
    .fill("Acum strângem darurile");
  await dialog
    .getByRole("textbox", { name: "In Ukrainian" })
    .fill("Зараз збираємо пожертви");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toHaveCount(0);

  // A member follows along; other tests may drive the room too, so go live until seen.
  const host = await (await browser.newContext()).newPage();
  await logInAs(host, "maria@example.com");
  await host.goto("/unu-unu/host");
  await host.getByRole("radio", { name: "All" }).click();
  await expect(async () => {
    await api(page, "POST", "/api/communities/unu-unu/live", {
      type: "go",
      entryId: (entry as { id: string }).id,
    });
    const now = host.getByRole("region", { name: "Live" });
    await expect(now).toContainText("Colecta", { timeout: 2000 });
    await expect(now).toContainText("Acum strângem darurile");
    await expect(now).toContainText("Зараз збираємо пожертви");
    await expect(host.getByRole("region", { name: "Next" })).toContainText(
      "Next: Predica",
    );
  }).toPass();
  await host.context().close();
});
