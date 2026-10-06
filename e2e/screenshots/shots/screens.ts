import en from "../../../src/client/locales/en.json" with { type: "json" };
import { slug, type View, playlist, team, open } from "../views";

export const screens: View[] = [
  {
    name: "screens-menu",
    as: team,
    sizes: ["laptop"],
    go: async (page) => {
      await page.goto(playlist);
      await page.getByRole("button", { name: en.screens.title }).click();
    },
  },
  {
    name: "pair-a-tv",
    as: team,
    sizes: ["laptop"],
    go: async (page) => {
      await page.goto(playlist);
      await page.getByRole("button", { name: en.screens.title }).click();
      await page.getByRole("menuitem", { name: en.pair.menu }).click();
    },
  },
  { name: "broadcast", sizes: ["screen"], go: open("/s/demo-broadcast") },
  {
    // A visitor projects on a laptop's own screen, from the live bar; on a phone,
    // the projector fills the page.
    name: "project-here",
    sizes: ["laptop", "phone"],
    go: async (page, size) => {
      if (size === "phone") {
        await page.goto(`/${slug}/songs/father`);
        await page.getByRole("button", { name: en.local.start }).tap();
        return;
      }
      await page.goto(playlist);
      await Promise.all([
        page.waitForEvent("popup"),
        page.getByRole("button", { name: en.local.start }).click(),
      ]);
    },
  },
];
