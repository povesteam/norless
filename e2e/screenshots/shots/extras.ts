import { type Page, expect } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import en from "../../../src/client/locales/en.json" with { type: "json" };
import { api, pickLayout } from "../../helpers";
import {
  slug,
  sizes,
  type View,
  playlist,
  team,
  editor,
  owner,
  musician,
  singer,
  open,
  switchesOf,
} from "../views";

/** Waits until the demo deck's pages are drawn by the converter. */
const slidesReady = async (page: Page) => {
  await expect
    .poll(
      async () => {
        const { body } = await api(
          page,
          "GET",
          `/api/communities/${slug}/playlists/p-sun`,
        );
        const entry = (
          body as {
            entries: { id: string; slides?: { files: { state: string }[] } }[];
          }
        ).entries.find((e) => e.id === "e-slides");
        return entry?.slides?.files[0]?.state;
      },
      { timeout: 60_000 },
    )
    .toBe("ready");
};

export const extras: View[] = [
  {
    // The welcome page, put up from the Pages menu.
    name: "projector-welcome",
    sizes: ["screen"],
    go: async (page) => {
      await api(page, "POST", "/api/auth/dev-login", { email: owner });
      await api(page, "PUT", `/api/communities/${slug}/welcome`, {
        announcements: [
          "# Welcome!\nFind a seat near the front: the first songs start soon.",
          "Thursday at 19:00: band rehearsal.",
        ],
      });
      await api(page, "POST", `/api/communities/${slug}/live`, {
        type: "page",
        pageId: "welcome",
      });
      await page.goto("/s/demo-projector-ro");
      await page.getByRole("heading", { name: "Example Church" }).waitFor();
    },
  },
  {
    // Big screen: every screen, and three of the band's devices.
    name: "big-screen",
    as: team,
    sizes: ["fhd", "qhd", "4k"],
    go: async (page) => {
      const browser = page.context().browser();
      if (!browser) throw new Error("No browser");
      const contexts = await Promise.all(
        (
          [
            [musician, sizes.phone, "musicians"],
            [singer, sizes.phone, "vocalists"],
            [editor, sizes.tablet, "musicians"],
          ] as const
        ).map(async ([email, size, view]) => {
          const context = await browser.newContext({
            ...size,
            locale: "en-US",
            serviceWorkers: "block",
          });
          const device = await context.newPage();
          await api(device, "POST", "/api/auth/dev-login", { email });
          await device.goto(`/${slug}/${view}`);
          return context;
        }),
      );
      // The devices go with the view's page, before the next view.
      page.on("close", () => void Promise.all(contexts.map((c) => c.close())));
      await page.goto(playlist);
      await pickLayout(page, en.controller.layouts["big-screen"]);
      await expect(
        page.getByRole("button", { name: /^Open Andrei Lungu/ }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /^Open Mihai Ionescu/ }),
      ).toBeVisible();
      await page.evaluate(() => window.scrollTo(0, 0));
    },
  },
  {
    // Slides from a file: its pages where a song's parts show.
    name: "slides",
    as: team,
    sizes: ["laptop"],
    live: "e-slides",
    go: async (page) => {
      await slidesReady(page);
      await page.goto(playlist);
      await page.getByRole("list", { name: en.live.slides }).waitFor();
    },
  },
  {
    // A presentation dropped onto the playlist: added as a PDF exported from it
    //.
    name: "slides-as-pdf",
    as: team,
    sizes: ["laptop"],
    go: async (page) => {
      await page.goto(playlist);
      const dataTransfer = await page.evaluateHandle(() => {
        const transfer = new DataTransfer();
        transfer.items.add(new File(["PK"], "Anunturi 12 oct.pptx"));
        return transfer;
      });
      await page.dispatchEvent("[data-entry]", "drop", { dataTransfer });
      await page.getByRole("status").getByText(en.slides.asPdf).waitFor();
    },
  },
  {
    name: "projector-slides",
    sizes: ["screen"],
    live: "e-slides",
    go: async (page) => {
      await slidesReady(page);
      await page.goto("/s/demo-projector-ro");
      await page.locator('img[src*="/api/slide-pages/"]').waitFor();
    },
  },
  {
    name: "stage-monitor-slides",
    sizes: ["screen"],
    live: "e-slides",
    go: async (page) => {
      await slidesReady(page);
      await page.goto("/s/demo-stage");
      await page.locator('img[src*="/api/slide-pages/"]').first().waitFor();
    },
  },
  {
    name: "follow-slides",
    sizes: ["phone"],
    live: "e-slides",
    go: async (page) => {
      await slidesReady(page);
      await page.goto(`/${slug}/follow`);
      await page.locator('img[src*="/api/slide-pages/"]').waitFor();
    },
  },
  {
    // Offline on one laptop: what it kept, a playlist made
    // there, a song found by its words.
    name: "offline",
    as: owner,
    sizes: ["laptop"],
    go: async (page) => {
      const url = `/api/communities/${slug}`;
      const { body } = await api(page, "GET", url);
      await api(page, "PUT", `${url}/switches`, {
        switches: {
          ...(body as { switches?: object }).switches,
          offline: true,
        },
      });
      await page.evaluate(
        (key) => localStorage.setItem(key, "1"),
        `norless:offline:${slug}`,
      );
      // The frame keeps the songs as it opens.
      await page.goto(playlist);
      await expect
        .poll(() =>
          page.evaluate(
            async (key) => !!(await caches.match(key)),
            `/api/communities/${slug}/offline`,
          ),
        )
        .toBe(true);
      await page.goto(`/${slug}/offline`);
      await page.getByLabel("New playlist").fill("Campfire");
      await page.getByRole("button", { name: "Create the playlist" }).click();
      await page.getByLabel("Add a song").fill("grace");
      await page
        .getByRole("button", { name: /Amazing Grace/ })
        .first()
        .click();
      await page.getByLabel("Add a song").fill("well");
    },
  },
  {
    name: "side-by-side-editor",
    as: editor,
    sizes: ["laptop"],
    go: open(`/${slug}/songs/father/edit`),
  },
  {
    name: "dark-mode",
    as: team,
    sizes: ["phone", "laptop"],
    dark: true,
    go: open(playlist),
  },
  {
    // The tree at Extras, most of it lit, in dark mode.
    name: "features-dark",
    as: owner,
    sizes: ["laptop"],
    dark: true,
    go: open(`/${slug}/features`),
  },
  {
    name: "keyboard-shortcuts",
    as: team,
    sizes: ["laptop"],
    go: async (page) => {
      await page.goto(playlist);
      // Once the page listens; the list of shortcuts is a dialog.
      await page.waitForLoadState("networkidle");
      await page.keyboard.press("?");
      await page.getByRole("dialog").waitFor();
    },
  },
  {
    // Chords colored by their degree, chosen on My account, in
    // relative pairs, suffixes blended with their letter.
    name: "chord-colors",
    as: musician,
    // It Is Well with My Soul: every degree, and a chord from outside the key.
    live: "e-8",
    sizes: ["phone", "tablet"],
    go: async (page) => {
      await api(page, "PUT", "/api/me/preferences", {
        musician: { chordColors: true },
      });
      await page.goto(`/${slug}/musicians`);
    },
  },
  {
    // What the member plays, asked the first time and from Display
    //.
    name: "what-do-you-play",
    as: musician,
    sizes: ["phone"],
    go: async (page) => {
      await page.goto(`/${slug}/musicians`);
      await page.getByRole("button", { name: "Display" }).click();
      await page.getByRole("button", { name: "What I play" }).click();
      await page.getByRole("dialog", { name: "What do you play?" }).waitFor();
    },
  },
  {
    // Likes and dislikes on a song; the owner reads why.
    name: "song-feedback",
    as: owner,
    sizes: ["laptop", "phone"],
    go: async (page) => {
      for (const [email, opinion, reason] of [
        [team, "like", ""],
        [musician, "like", ""],
        [singer, "dislike", "Too high for the altos"],
        [owner, "like", ""],
      ]) {
        await api(page, "POST", "/api/auth/dev-login", { email });
        await api(
          page,
          "PUT",
          `/api/communities/${slug}/songs/father/opinion`,
          {
            opinion,
            reason,
          },
        );
      }
      await api(
        page,
        "PUT",
        `/api/communities/${slug}/songs/father/reference-links`,
        {
          links: [
            {
              url: "https://www.youtube.com/watch?v=example",
              title: "The Lord’s Prayer (live)",
              site: "YouTube",
              image: null,
            },
            {
              url: "https://open.spotify.com/track/example",
              title: "Acoustic, slower",
              site: "Spotify",
              image: null,
            },
          ],
        },
      );
      await page.goto(`/${slug}/songs/father`);
    },
  },
  {
    name: "song-feedback-settings",
    as: owner,
    sizes: ["laptop"],
    go: open(`/${slug}/settings/songs`),
  },
  {
    name: "statistics",
    as: team,
    sizes: ["laptop", "phone"],
    go: open(`/${slug}/statistics`),
  },
  {
    // A song's moments in the services' streams: streams
    // around the most played song's last services.
    name: "watch-again",
    as: team,
    sizes: ["laptop"],
    go: async (page) => {
      const db = new Database(join(tmpdir(), "norless-screenshots.db"));
      const plays = db
        .prepare(
          "SELECT song_id AS song, played_at AS at FROM plays WHERE mode = 'service' ORDER BY played_at DESC",
        )
        .all() as { song: string; at: string }[];
      const song = plays[0]?.song ?? "";
      const insert = db.prepare(
        `INSERT OR REPLACE INTO streams (id, community_id, video_id, started_at, ended_at, created_at, updated_at)
             VALUES (?, 'c', ?, ?, ?, ?, ?)`,
      );
      plays
        .filter((p) => p.song === song)
        .slice(0, 4)
        .forEach((p, i) => {
          const at = Date.parse(p.at);
          insert.run(
            `demo-stream-${i}`,
            `demoVideo0${i}`,
            new Date(at - 7 * 60_000).toISOString(),
            new Date(at + 2 * 3_600_000).toISOString(),
            p.at,
            p.at,
          );
        });
      db.close();
      await api(page, "POST", "/api/auth/dev-login", { email: owner });
      await api(page, "PUT", `/api/communities/${slug}/switches`, {
        switches: { ...switchesOf(5), replays: true },
      });
      await api(page, "POST", "/api/auth/dev-login", { email: team });
      await page.goto(`/${slug}/songs/${song}`);
      await page
        .getByRole("region", { name: en.replays.title })
        .scrollIntoViewIfNeeded();
    },
  },
  {
    name: "practice-rooms",
    as: team,
    sizes: ["laptop"],
    go: async (page) => {
      await page.goto(playlist);
      await page.getByRole("button", { name: en.live.thisDevice }).click();
      await page
        .getByRole("button", {
          name: new RegExp(`^${en.rooms.menu.split("{{")[0]}`),
        })
        .first()
        .click();
    },
  },
  {
    name: "searches-not-found",
    as: owner,
    sizes: ["laptop"],
    go: async (page) => {
      for (const q of ["Oceans", "Oceans", "Way Maker"])
        await api(page, "POST", `/api/communities/${slug}/search-misses`, {
          q,
        });
      await page.goto(`/${slug}/statistics`);
      await page
        .getByRole("heading", { name: en.misses.title })
        .scrollIntoViewIfNeeded();
    },
  },
  {
    name: "changes",
    as: owner,
    sizes: ["laptop"],
    go: async (page) => {
      // Two changes of the owner's, so the page shows what it's for.
      const playlists = `/api/communities/${slug}/playlists`;
      const { body } = await api(page, "POST", playlists, {
        title: "Youth night",
      });
      const { id } = body as { id: string };
      await api(page, "PATCH", `${playlists}/${id}`, {
        title: "Youth night: songs of hope",
      });
      await page.goto(`/${slug}/changes`);
    },
  },
  {
    name: "statistics-year",
    as: team,
    sizes: ["laptop"],
    go: async (page) => {
      await page.goto(`/${slug}/statistics`);
      await page
        .getByRole("button", { name: new RegExp(en.statistics.period) })
        .click();
      await page
        .getByRole("option", { name: String(new Date().getFullYear()) })
        .click();
    },
  },
  {
    // On a phone only: a laptop shows the grid on the statistics page's picture.
    name: "services-grid",
    as: team,
    sizes: ["phone"],
    go: async (page) => {
      await page.goto(`/${slug}/statistics`);
      await page
        .getByRole("heading", { name: en.grid.title })
        .scrollIntoViewIfNeeded();
    },
  },
  {
    name: "host",
    as: team,
    sizes: ["phone"],
    go: async (page) => {
      await api(
        page,
        "PATCH",
        `/api/communities/${slug}/playlists/p-sun/entries/e-0`,
        {
          hostWords: {
            en: "Let's stand and sing together.",
            ro: "Să ne ridicăm și să cântăm împreună.",
          },
        },
      );
      await page.goto(`/${slug}/host`);
    },
  },
  {
    name: "host-words",
    as: team,
    sizes: ["laptop"],
    go: async (page) => {
      await page.goto(playlist);
      await page
        .getByRole("grid", { name: en.playlist.entries })
        .getByRole("row")
        .first()
        .click({ button: "right" });
      await page.getByRole("menuitem", { name: en.host.words }).click();
    },
  },
  {
    name: "youtube-chapters",
    as: team,
    sizes: ["laptop"],
    go: async (page) => {
      await page.goto(playlist);
      await page.getByRole("button", { name: en.playlist.actions }).click();
      await page.getByRole("menuitem", { name: en.chapters.title }).click();
    },
  },
  {
    // Chord detection, switched on by the owner since it arrives off
    //: the Chords mode's panel with the wheel.
    name: "chords-play",
    as: team,
    sizes: ["laptop"],
    go: async (page) => {
      await api(page, "POST", "/api/auth/dev-login", { email: owner });
      await api(page, "PUT", `/api/communities/${slug}/switches`, {
        switches: {
          ...switchesOf(5),
          midiChords: true,
          audioChords: true,
          chordWheel: true,
          liveChord: true,
        },
      });
      await api(page, "POST", "/api/auth/dev-login", { email: team });
      await page.goto(`/${slug}/songs/grace/chords?language=en`);
      await page.getByRole("region", { name: en.detect.title }).waitFor();
    },
  },
  {
    // The Live chord layout, the team sharing from a piano.
    name: "live-chord",
    as: team,
    sizes: ["phone", "laptop"],
    go: async (page) => {
      await api(page, "POST", `/api/communities/${slug}/live/chord`, {
        sharing: true,
        source: "midi",
        chord: "D",
      });
      await page.goto(`/${slug}/musicians`);
      await pickLayout(page, en.musicians.layouts["live-chord"]);
      await page.getByText("D", { exact: true }).first().waitFor();
    },
  },
];
