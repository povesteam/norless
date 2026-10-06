import { api, expect, logInAs, test } from "./helpers";

test("members like or dislike a song; owners read why, exclude it and include it again", async ({
  page,
  browser,
}) => {
  await logInAs(page, "ana@example.com");
  const { body } = await api(page, "POST", "/api/communities/unu-unu/songs", {
    versions: [
      { language: "ro", title: "Ploaia de toamnă", text: "1:\nPloaia" },
    ],
  });
  const { id } = body as { id: string };

  // A member likes it, changes their mind, and says why.
  const member = await browser.newPage();
  await logInAs(member, "maria@example.com");
  await member.goto(`/unu-unu/songs/${id}`);
  const like = member.getByRole("button", { name: /^Like/ });
  const dislike = member.getByRole("button", { name: /^Dislike/ });
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(like).toHaveText("Like 1");
  // The songs one likes come first in the empty search box.
  await member.goto("/unu-unu/playlists/steady");
  await member.getByRole("combobox", { name: "Search songs" }).click();
  const first = member.getByRole("option").first();
  await expect(first).toContainText("Ploaia de toamnă");
  await expect(first.getByLabel("You like it")).toBeVisible();
  await member.goto(`/unu-unu/songs/${id}`);

  await dislike.click();
  const dialog = member.getByRole("dialog", { name: "Dislike this song" });
  await dialog.getByLabel("Why? (optional)").fill("Too high for us");
  await dialog.getByRole("button", { name: "Dislike" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(dislike).toHaveAttribute("aria-pressed", "true");
  await expect(like).toHaveText("Like 0");
  await expect(member.getByText("Maria: Too high for us")).toHaveCount(0);

  // The owner reads why, and excludes it from the settings.
  await page.goto(`/unu-unu/songs/${id}`);
  await expect(page.getByText("Maria: Too high for us")).toBeVisible();
  await page.goto("/unu-unu/settings/songs");
  const row = page
    .getByRole("listitem")
    .filter({ hasText: "Ploaia de toamnă" });
  await expect(row).toContainText("1 dislike");
  await row.getByRole("button", { name: "Exclude" }).click();
  const exclude = page.getByRole("dialog", { name: "Exclude this song" });
  await exclude
    .getByRole("textbox", { name: "Why it isn't played here" })
    .fill("Against our doctrine");
  await exclude.getByRole("button", { name: "Exclude" }).click();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Against our doctrine" }),
  ).toContainText("Excluded by Ana");

  // Search no longer finds it, and its page says why.
  await member.goto("/unu-unu/playlists/steady");
  await member.getByRole("combobox", { name: "Search songs" }).fill("ploaia");
  await expect(member.getByText("No songs found")).toBeVisible();
  await member.goto(`/unu-unu/songs/${id}`);
  await expect(member.getByText("Not played here")).toBeVisible();
  await expect(member.getByText("Against our doctrine")).toBeVisible();
  await expect(
    member.getByRole("button", { name: "Include again" }),
  ).toHaveCount(0);

  // The owner includes it again from its page.
  await page.goto(`/unu-unu/songs/${id}`);
  await page.getByRole("button", { name: "Include again" }).click();
  await expect(page.getByText("Not played here")).toHaveCount(0);
  await page.getByRole("button", { name: "More actions" }).click();
  await expect(page.getByRole("menuitem", { name: "Exclude" })).toBeVisible();
  await member.close();
});

test("visitors see neither the buttons nor the counts", async ({ page }) => {
  await page.goto("/unu-unu/songs/grace");
  await expect(page.getByRole("heading", { level: 2 })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Like/ })).toHaveCount(0);
});
