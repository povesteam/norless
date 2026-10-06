// Screenshots of every set of features' main views on a phone, a tablet, a laptop and a
// projector, from the demo data in seed.ts, for the manual. `npm run screenshots` writes
// screenshots/<size>-<view>.png (only pictures there, sorted by device), one test per
// view, so a name stays the same when views are added: `npm run screenshots -- -g musicians` takes one again.
import { type Browser, type Page, expect, test } from "@playwright/test";
import { readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { api } from "../helpers";
import { slug, sizes, type Size, type View, owner, switchesOf } from "./views";
import { classic } from "./shots/classic";
import { operator } from "./shots/operator";
import { stage } from "./shots/stage";
import { screens } from "./shots/screens";
import { extras } from "./shots/extras";
import { insertBetween } from "./shots/insert-between";
import { teamSchedule } from "./shots/team-schedule";

/** Each set: its number, what's live during its shots, and its views. */
const sets: [number, string, View[]][] = [
  // The Lord's Prayer, in Romanian and English.
  [1, "e-3", classic],
  [2, "e-3", operator],
  // Amazing Grace, which has chords.
  [3, "e-0", stage],
  [4, "e-3", screens],
  [5, "e-0", [...extras, ...insertBetween]],
  [6, "e-0", teamSchedule],
];

/** A logged-in page (or a visitor's) of a size, past the what's new notice unless asked. */
async function newPage(browser: Browser, view: View, size: Size, set: number) {
  const context = await browser.newContext({
    ...sizes[size],
    locale: "en-US",
    colorScheme: view.dark ? "dark" : "light",
    serviceWorkers: "block",
  });
  // The start and end pages are made-up addresses; they show a plain page.
  await context.route("https://*.example.invalid/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<body style="margin:0;display:grid;place-items:center;height:100vh;background:#14213d;color:#fff;font:600 8vw system-ui">Welcome!</body>`,
    }),
  );
  const page = await context.newPage();
  if (view.as) {
    await api(page, "POST", "/api/auth/dev-login", { email: view.as });
    const { body } = await api(page, "GET", "/api/me");
    const { preferences } = body as { preferences: object };
    await api(page, "PUT", "/api/me/preferences", {
      ...preferences,
      seenSwitches: {
        [slug]: Object.keys(switchesOf(view.news ? set - 1 : set)),
      },
    });
  }
  return page;
}

async function asOwner(browser: Browser, run: (page: Page) => Promise<void>) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await api(page, "POST", "/api/auth/dev-login", { email: owner });
  await run(page);
  await context.close();
}

/**
 * Service plays over the last 60 weeks, so the statistics have something to show: the
 * first songs every week or two, others now and then, and the last few only long ago.
 * Written straight into the server's database (playwright.screenshots.config.ts).
 */
async function addPlays(page: Page) {
  const { body } = await api(page, "GET", `/api/communities/${slug}/search?q=`);
  const ids = (body as { results: { type: string; id: string }[] }).results
    .filter((r) => r.type === "song")
    .map((r) => r.id)
    .sort();
  const db = new Database(join(tmpdir(), "norless-screenshots.db"));
  const community = db
    .prepare("SELECT id FROM communities WHERE slug = ?")
    .pluck()
    .get(slug);
  const insert = db.prepare(
    `INSERT OR IGNORE INTO plays (id, community_id, song_id, mode, played_at, created_at, updated_at)
     VALUES (?, ?, ?, 'service', ?, ?, ?)`,
  );
  const week = 7 * 86_400_000;
  ids.forEach((id, i) => {
    const old = i >= ids.length - 2;
    for (let w = old ? 30 : 0; w < (old ? 40 : 60); w++)
      if (w % ((i % 5) + 1) === 0) {
        const at = new Date(Date.now() - w * week - 86_400_000).toISOString();
        insert.run(`shot-${w}-${i}`, community, id, at, at, at);
      }
  });
  db.close();
}

test.describe.configure({ mode: "serial" });

test("the manual's pictures are taken", () => {
  const shots = sets.flatMap(([, , views]) =>
    views.flatMap((view) =>
      view.sizes.map((size) => `${size}-${view.name}.png`),
    ),
  );
  expect(new Set(shots).size, "a view's name is used twice").toBe(shots.length);
  for (const file of readdirSync("manual").filter((f) => f.endsWith(".md")))
    for (const [, name] of readFileSync(`manual/${file}`, "utf8").matchAll(
      /\]\(\.\.\/screenshots\/([^)]+)\)/g,
    ))
      expect(shots, `${file} shows ${name}`).toContain(name);
});

let played = false;

for (const [set, live, views] of sets)
  for (const view of views)
    test(`${view.name}, set ${set}`, async ({ browser }) => {
      await asOwner(browser, async (page) => {
        const call = (method: string, path: string, data?: object) =>
          api(page, method, `/api/communities/${slug}${path}`, data);
        await call("PUT", "/switches", { switches: switchesOf(set) });
        if (set === 5 && !played) {
          await addPlays(page);
          played = true;
        }
        // A song live, on its second slide; with the stage views, a message too.
        await call("POST", "/live", {
          type: "go",
          entryId: view.live ?? live,
          slide: 1,
        });
        await call("POST", "/live", {
          type: "message",
          text: set === 3 ? "5 more minutes" : null,
        });
      });
      for (const size of view.sizes) {
        const page = await newPage(browser, view, size, set);
        await view.go(page, size);
        // Placeholders show after 300 ms; let what's loading arrive.
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(400);
        await page.screenshot({
          path: `screenshots/${size}-${view.name}.png`,
          animations: "disabled",
        });
        await page.context().close();
      }
    });
