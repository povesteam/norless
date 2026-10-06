import { type Page } from "@playwright/test";
import en from "../../../src/client/locales/en.json" with { type: "json" };
import { type View, playlist, team } from "../views";

/** Points between a playlist's second and third rows, and opens the + menu there. */
const gapMenu = async (page: Page) => {
  await page.goto(playlist);
  const row = page
    .getByRole("grid", { name: en.playlist.entries })
    .getByRole("row")
    .nth(2);
  await row.waitFor();
  const box = await row.boundingBox();
  if (!box) throw new Error("not shown");
  await page.mouse.move(box.x + box.width / 3, box.y + 4);
  await page.getByRole("button", { name: en.playlist.insertHere }).click();
  await page.getByRole("menuitem", { name: en.playlist.songHere }).waitFor();
};

/**
 * Adding between rows, with the Extras set: the + and its menu,
 * the search box waiting for the song, and a phone row's actions.
 */
export const insertBetween: View[] = [
  { name: "insert-between", as: team, sizes: ["laptop"], go: gapMenu },
  {
    name: "song-here",
    as: team,
    sizes: ["laptop"],
    go: async (page) => {
      await gapMenu(page);
      await page.getByRole("menuitem", { name: en.playlist.songHere }).click();
      await page.getByText(/^After “/).waitFor();
    },
  },
  {
    name: "row-menu-above",
    as: team,
    sizes: ["phone"],
    go: async (page) => {
      await page.goto(playlist);
      await page.getByRole("button", { name: "Actions: Prayer" }).click();
    },
  },
];
