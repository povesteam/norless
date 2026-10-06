import en from "../../../src/client/locales/en.json" with { type: "json" };
import { pickLayout } from "../../helpers";
import { slug, type View, playlist, team, open } from "../views";

export const operator: View[] = [
  {
    // The bubble, and its dialog.
    name: "whats-new",
    as: team,
    sizes: ["laptop", "phone"],
    news: true,
    go: open(playlist),
  },
  {
    name: "whats-new-dialog",
    as: team,
    sizes: ["laptop", "phone"],
    news: true,
    go: async (page) => {
      await page.goto(playlist);
      await page.getByRole("button", { name: /^What's new/ }).click();
      await page.getByRole("dialog").waitFor();
    },
  },
  { name: "controller", as: team, sizes: ["laptop"], go: open(playlist) },
  {
    name: "running-order",
    as: team,
    sizes: ["laptop"],
    go: async (page) => {
      await page.goto(playlist);
      await pickLayout(page, en.controller.layouts["running-order"]);
    },
  },
  {
    name: "big-now-and-next",
    as: team,
    sizes: ["laptop"],
    go: async (page) => {
      await page.goto(playlist);
      await pickLayout(page, en.controller.layouts.big);
    },
  },
  {
    name: "playlists",
    as: team,
    sizes: ["laptop"],
    go: open(`/${slug}/playlists`),
  },
];
