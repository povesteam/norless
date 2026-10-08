import en from "../../../src/client/locales/en.json" with { type: "json" };
import {
  slug,
  type View,
  playlist,
  team,
  musician,
  singer,
  open,
} from "../views";

export const stage: View[] = [
  {
    name: "control",
    as: team,
    sizes: ["phone", "tablet"],
    go: open(playlist),
  },
  {
    // The Chords mode, a chord's picker open: all the verses or only this one
    //.
    name: "chords-mode",
    as: team,
    sizes: ["phone", "laptop"],
    go: async (page) => {
      await page.goto(`/${slug}/songs/grace/chords?language=en`);
      await page
        .getByRole("button", { name: /sound/ })
        .first()
        .locator(".text-chord")
        .first()
        .click();
      await page.getByRole("dialog").waitFor();
    },
  },
  {
    name: "control-opened",
    as: team,
    sizes: ["phone"],
    go: async (page) => {
      await page.goto(playlist);
      await page.getByRole("button", { name: en.live.moreControls }).click();
    },
  },
  {
    // A song's parts in one language, with the choice above them.
    name: "control-song",
    as: team,
    sizes: ["phone"],
    go: async (page) => {
      await page.goto(playlist);
      await page
        .getByRole("grid")
        .getByRole("row")
        .filter({ hasText: /Tatăl nostru|The Lord's Prayer/ })
        .click();
      await page
        .getByRole("region", { name: en.controller.phone.song })
        .getByRole("radiogroup", { name: en.song.language })
        .waitFor();
    },
  },
  {
    name: "musicians",
    as: musician,
    sizes: ["phone", "tablet"],
    go: open(`/${slug}/instruments`),
  },
  {
    name: "vocalists",
    as: singer,
    sizes: ["phone", "tablet"],
    go: open(`/${slug}/vocals`),
  },
  {
    name: "stage-monitor",
    sizes: ["screen", "phone"],
    go: open("/s/demo-stage"),
  },
  {
    name: "musicians-screen",
    sizes: ["screen"],
    go: open("/s/demo-musicians"),
  },
];
