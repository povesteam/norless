import en from "../../../src/client/locales/en.json" with { type: "json" };
import type { Page } from "@playwright/test";
import { api } from "../../helpers";
import {
  slug,
  type View,
  playlist,
  team,
  editor,
  owner,
  singer,
  open,
  menu,
} from "../views";

/** As Chrome on Android does: it offers to install, so the start page's main button is Install. */
const offerInstall = (page: Page) =>
  page.evaluate(() =>
    window.dispatchEvent(
      Object.assign(new Event("beforeinstallprompt"), {
        prompt: async () => {},
      }),
    ),
  );

export const classic: View[] = [
  {
    // The page while the app's code loads: its scripts never come.
    name: "loading",
    as: team,
    sizes: ["phone", "laptop"],
    go: async (page) => {
      await page.route("**/assets/*.js", (route) => route.abort());
      await page.goto(`/${slug}/playlists`);
    },
  },
  {
    name: "playlist",
    as: team,
    sizes: ["phone", "tablet", "laptop"],
    go: open(playlist),
  },
  {
    // The title in the bar, being renamed; on a phone, from the
    // actions the title opens.
    name: "rename",
    as: team,
    sizes: ["phone", "laptop"],
    go: async (page, size) => {
      await open(playlist)(page);
      await page.locator("[data-bar-title] button").click();
      if (size === "phone")
        await page.getByRole("menuitem", { name: en.playlist.rename }).click();
    },
  },
  {
    // On a phone, the title opens the playlist's actions.
    name: "playlist-actions",
    as: team,
    sizes: ["phone"],
    go: async (page) => {
      await open(playlist)(page);
      await page.locator("[data-bar-title] button").click();
    },
  },
  {
    name: "song-slides",
    as: team,
    sizes: ["phone"],
    go: async (page) => {
      await page.goto(playlist);
      await page.getByRole("row", { name: /Holy, Holy, Holy/ }).tap();
    },
  },
  {
    name: "entry-actions",
    as: team,
    sizes: ["laptop"],
    go: async (page) => {
      await page.goto(playlist);
      await page
        .getByRole("row", { name: /Holy, Holy, Holy/ })
        .click({ button: "right" });
    },
  },
  {
    name: "row-menu",
    as: team,
    sizes: ["phone"],
    go: async (page) => {
      await page.goto(playlist);
      await page.getByRole("button", { name: "Actions: Prayer" }).click();
    },
  },
  {
    name: "pages-menu",
    as: team,
    sizes: ["laptop"],
    go: async (page) => {
      await page.goto(playlist);
      await page.getByRole("button", { name: en.pages.title }).click();
    },
  },
  { name: "menu", as: team, sizes: ["phone", "laptop"], go: menu },
  // The photo: Google's, an uploaded one, or initials; the way
  // back to the community opened before.
  {
    name: "account",
    as: team,
    sizes: ["phone", "laptop"],
    go: async (page) => {
      await open(playlist)(page);
      await page.getByRole("button", { name: en.app.menu }).waitFor();
      await page.goto("/account");
      await page.getByRole("link", { name: /^Back to / }).waitFor();
    },
  },
  {
    name: "search",
    as: team,
    sizes: ["phone", "laptop"],
    go: async (page, size) => {
      await page.goto(playlist);
      await page
        .getByRole("combobox", { name: en.search.placeholder })
        .fill("grace");
      await page.getByRole("option").first().waitFor();
      // A laptop shows the highlighted song's words beside the results.
      if (size === "laptop")
        await page.getByRole("region", { name: "Amazing Grace" }).waitFor();
    },
  },
  {
    // The empty box: what else goes in a playlist, then songs worth suggesting, each
    // with its reason.
    name: "search-empty",
    as: team,
    sizes: ["phone", "laptop"],
    go: async (page) => {
      await page.goto(playlist);
      await page.getByRole("combobox", { name: en.search.placeholder }).click();
      await page
        .getByRole("option", { name: /last played/ })
        .first()
        .waitFor();
    },
  },
  {
    name: "song-editor",
    as: editor,
    sizes: ["phone", "laptop"],
    go: async (page, size) => {
      await page.goto(playlist);
      if (size === "phone")
        await page.getByRole("row", { name: /The Lord's Prayer/ }).tap();
      await page.getByRole("button", { name: en.editor.editSong }).click();
    },
  },
  {
    name: "new-song",
    as: editor,
    sizes: ["laptop"],
    go: async (page) => {
      await menu(page);
      await page.getByRole("button", { name: en.classic.newSong }).click();
    },
  },
  {
    name: "empty-playlist",
    as: team,
    sizes: ["laptop"],
    go: open(`/${slug}/playlists/p-thu`),
  },
  { name: "visitor", sizes: ["phone", "laptop"], go: open(playlist) },
  {
    name: "song-page",
    sizes: ["phone", "laptop"],
    go: open(`/${slug}/songs/light`),
  },
  {
    // The bare address on a browser that never opened a community.
    name: "start",
    sizes: ["phone", "laptop"],
    go: async (page) => {
      await page.goto("/");
      await page.getByText(en.about.what).waitFor();
      await offerInstall(page);
    },
  },
  {
    name: "login",
    sizes: ["phone", "laptop"],
    go: open(`/login?next=${encodeURIComponent(playlist)}`),
  },
  {
    name: "login-other-ways",
    sizes: ["phone", "laptop"],
    go: async (page) => {
      await open(`/login?next=${encodeURIComponent(playlist)}`)(page);
      await page.getByRole("button", { name: en.auth.otherWays }).click();
    },
  },
  {
    name: "send-idea",
    as: singer,
    sizes: ["phone"],
    go: async (page) => {
      await menu(page);
      await page.getByRole("button", { name: en.feedback.open }).click();
      await page
        .getByRole("textbox", { name: en.feedback.label })
        .fill("Could the vocalists' page show the key too?");
    },
  },
  {
    name: "ideas",
    as: owner,
    sizes: ["laptop"],
    go: open(`/${slug}/ideas`),
  },
  {
    // The screens' section, so it isn't the members' picture again; on a phone, the
    // list of sections.
    name: "settings",
    as: owner,
    sizes: ["laptop", "phone"],
    go: async (page, size) => {
      await page.goto(`/${slug}/settings${size === "phone" ? "" : "/screens"}`);
    },
  },
  {
    // Every feature in a graph of what each needs; a phone
    // scrolls it both ways. The owner's, who switches them.
    name: "features",
    as: owner,
    sizes: ["phone", "laptop"],
    go: open(`/${slug}/features`),
  },
  {
    // The schedule, and the YouTube channel for chapters.
    name: "settings-schedule",
    as: owner,
    sizes: ["laptop"],
    go: open(`/${slug}/settings/schedule`),
  },
  {
    name: "members",
    as: owner,
    sizes: ["phone", "laptop"],
    go: open(`/${slug}/members`),
  },
  {
    name: "projector-ro",
    sizes: ["screen"],
    go: open("/s/demo-projector-ro"),
  },
  {
    name: "projector-en",
    sizes: ["screen"],
    go: open("/s/demo-projector-en"),
  },
  {
    // A verse projected from bible.com, on Norless's own screen
    //; the next step's entry takes it down.
    name: "projector-verse",
    as: team,
    sizes: ["screen"],
    go: async (page) => {
      await api(page, "POST", `/api/communities/${slug}/live`, {
        type: "verse",
        verse: {
          ro: {
            reference: "Ioan 3:16",
            text: "Fiindcă atât de mult a iubit Dumnezeu lumea, că a dat pe singurul Lui Fiu, pentru ca oricine crede în El să nu piară, ci să aibă viața veșnică.",
          },
          en: {
            reference: "John 3:16",
            text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
          },
        },
      });
      await page.goto("/s/demo-projector-ro");
    },
  },
];
