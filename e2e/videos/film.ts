import {
  type Browser,
  type BrowserContextOptions,
  type Locator,
  type Page,
  devices as known,
} from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { formatReference } from "../../src/shared/bible";
import { api } from "../helpers";
import { pointer } from "./pointer";
import { listen, sound, soundTrack } from "./sounds";

export { sound };
import { copy, out } from "../../playwright.videos.config";

// The training videos' tools: devices filmed side by side, a
// caption in English at each step, a ring around what's clicked, the mouse or a
// fingertip (a recording shows neither), and the clicks and keys heard.

export const slug = "unu-unu";
/** An owner of the real community, whose account films: their email in VIDEO_FILMER. */
export const filmer = process.env.VIDEO_FILMER ?? "";
if (!filmer)
  throw new Error("Set VIDEO_FILMER to an owner's email in the import");

const devices = {
  laptop: { viewport: { width: 1280, height: 800 } },
  phone: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    // A phone's, which the server tells from a laptop's.
    userAgent: known["Pixel 7"].userAgent,
  },
  projector: { viewport: { width: 960, height: 540 } },
} satisfies Record<string, BrowserContextOptions>;
type Device = keyof typeof devices;

/** The newest playlist with songs: the newest of all is usually next Sunday's, empty. */
function lastServiceId() {
  const db = new Database(copy, { readonly: true });
  const row = db
    .prepare(
      `SELECT p.id FROM playlists p WHERE p.deleted_at IS NULL AND EXISTS (SELECT 1
       FROM entries e WHERE e.playlist_id = p.id AND e.kind = 'song' AND e.deleted_at IS NULL)
       ORDER BY p.created_at DESC LIMIT 1`,
    )
    .get() as { id: string };
  db.close();
  return row.id;
}
export const lastService = () => `/${slug}/playlists/${lastServiceId()}`;

const folded = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();

/**
 * The last service's entries up to its first divider, as the team would add them: what
 * to type, and the text that tells the option adding it.
 */
export type Entry = {
  kind: "song" | "bible" | "divider";
  query: string;
  text: string;
};
export function lastServiceStart(): Entry[] {
  const db = new Database(copy, { readonly: true });
  const entries = db
    .prepare(
      `SELECT e.kind, e.text, e.bible_book book, e.bible_chapter chapter,
         e.bible_verse_from "from", e.bible_verse_to "to",
         (SELECT v.title FROM song_versions v WHERE v.song_id = e.song_id
            AND v.deleted_at IS NULL ORDER BY v.language = 'ro' DESC LIMIT 1) title
       FROM entries e WHERE e.playlist_id = ? AND e.deleted_at IS NULL
       ORDER BY e.position`,
    )
    .all(lastServiceId()) as {
    kind: string;
    text: string | null;
    book: number;
    chapter: number;
    from: number;
    to: number;
    title: string | null;
  }[];
  db.close();
  const end = entries.findIndex((e) => e.kind === "divider");
  return entries.slice(0, end + 1).flatMap((e): Entry[] => {
    if (e.kind === "song" && e.title)
      return [
        {
          kind: "song",
          query: folded(e.title).split(/\s+/).slice(0, 3).join(" "),
          text: e.title,
        },
      ];
    if (e.kind === "bible") {
      const reference = formatReference(e, "ro");
      // The option names the book in the interface's language.
      return [
        {
          kind: "bible",
          query: folded(reference),
          text: reference.replace(/^.* /, ""),
        },
      ];
    }
    if (e.kind === "divider" && e.text)
      return [{ kind: "divider", query: e.text, text: e.text }];
    return [];
  });
}

/**
 * Logs a page in as `email`, with the team role (in the copy only: the laptop's login
 * is offered to the team) and Classic's hints already seen, since the captions say it.
 */
export async function logIn(page: Page, email = filmer) {
  const db = new Database(copy);
  db.prepare(
    `UPDATE members SET roles = json_insert(roles, '$[#]', 'team')
     WHERE user_id = (SELECT id FROM users WHERE email = ?)
       AND NOT EXISTS (SELECT 1 FROM json_each(roles) WHERE value = 'team')`,
  ).run(email);
  db.close();
  await api(page, "POST", "/api/auth/dev-login", { email });
  await hintsSeen(page);
}

/** Classic's hints marked seen for whoever is logged in (a laptop's login too). */
export async function hintsSeen(page: Page) {
  const { body } = await api(page, "GET", "/api/me");
  const { preferences } = body as { preferences: object };
  await api(page, "PUT", "/api/me/preferences", {
    ...preferences,
    hints: ["goLive", "search", "keys", "project"],
  });
}

/**
 * A page per device, each filmed from the same moment; `done` writes `<name>.mp4` to
 * VIDEO_OUT, the devices side by side, each 800 pixels high, with the sounds.
 */
export async function film<D extends Device>(
  browser: Browser,
  name: string,
  wanted: D[],
) {
  const dir = mkdtempSync(join(tmpdir(), "norless-video-"));
  const contexts = await Promise.all(
    wanted.map(async (device) => {
      const options = devices[device];
      // Recordings are in CSS pixels; ffmpeg scales them up.
      const context = await browser.newContext({
        ...options,
        locale: "en-US",
        serviceWorkers: "block",
        recordVideo: { dir, size: options.viewport },
      });
      await context.addInitScript(pointer, device === "phone");
      return context;
    }),
  );
  listen();
  const pages = await Promise.all(contexts.map((c) => c.newPage()));
  const byDevice = Object.fromEntries(
    wanted.map((device, i) => [device, pages[i]]),
  ) as Record<D, Page>;
  return {
    ...byDevice,
    done: async () => {
      await Promise.all(contexts.map((c) => c.close()));
      const files = await Promise.all(
        pages.map((p) => {
          const video = p.video();
          if (!video) throw new Error("The page wasn't recorded");
          return video.path();
        }),
      );
      mkdirSync(out, { recursive: true });
      const inputs = files.flatMap((file) => ["-i", file]);
      const scaled = files
        .map((_, i) =>
          i === 0
            ? `[0:v]scale=-2:800,setsar=1[v0]`
            : `[${i}:v]scale=640:800:force_original_aspect_ratio=decrease,pad=640:800:(ow-iw)/2:(oh-ih)/2:color=0x16181d,setsar=1[v${i}]`,
        )
        .join(";");
      const joined =
        files.length > 1
          ? `${scaled};${files.map((_, i) => `[v${i}]`).join("")}hstack=inputs=${files.length}[v]`
          : `${scaled};[v0]copy[v]`;
      const track = join(dir, "sounds.wav");
      const heard = soundTrack(track);
      execFileSync("ffmpeg", [
        "-y",
        "-loglevel",
        "error",
        ...inputs,
        ...(heard ? ["-i", track] : []),
        "-filter_complex",
        joined,
        "-map",
        "[v]",
        ...(heard
          ? ["-map", `${files.length}:a`, "-c:a", "aac", "-b:a", "96k"]
          : []),
        // Plays on phones and in WhatsApp.
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        join(out, `${name}.mp4`),
      ]);
    },
  };
}

const wait = (page: Page, ms: number) => page.waitForTimeout(ms);

/** A caption at the bottom (or top) of the page, long enough to read. */
export async function say(
  page: Page,
  text: string,
  where: "top" | "bottom" = "bottom",
) {
  await page.evaluate(
    ({ text, where }) => {
      let box = document.getElementById("film-caption");
      if (!box) {
        box = document.createElement("div");
        box.id = "film-caption";
        document.body.append(box);
      }
      box.textContent = text;
      const phone = innerWidth < 600;
      Object.assign(box.style, {
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        [where]: phone ? "72px" : "96px",
        [where === "top" ? "bottom" : "top"]: "auto",
        maxWidth: phone ? "92vw" : "70vw",
        width: "max-content",
        padding: phone ? "10px 14px" : "14px 22px",
        borderRadius: "12px",
        background: "rgba(10, 12, 20, 0.86)",
        color: "#fff",
        font: `600 ${phone ? 17 : 22}px/1.35 system-ui, sans-serif`,
        textAlign: "center",
        zIndex: "2147483646",
        pointerEvents: "none",
      });
    },
    { text, where },
  );
  await wait(page, Math.max(2200, text.length * 55));
}

// Where each page's mouse is, since Playwright doesn't say.
const mouse = new WeakMap<Page, { x: number; y: number }>();

/** The mouse moved to (x, y) the way a hand moves it, eased, in about a third of a second. */
export async function glide(page: Page, x: number, y: number, steps = 20) {
  const size = page.viewportSize();
  const from = mouse.get(page) ?? {
    x: (size?.width ?? 0) / 2,
    y: (size?.height ?? 0) * 0.6,
  };
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
    await page.mouse.move(
      from.x + (x - from.x) * eased,
      from.y + (y - from.y) * eased,
    );
    await wait(page, 16);
  }
  mouse.set(page, { x, y });
}

/** A ring around what's about to be clicked or tapped, the hand going there, then the click or tap. */
export async function press(
  target: Locator,
  how: "click" | "tap" | "dblclick" | "right" = "click",
) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  const page = target.page();
  // The last caption goes, so it covers nothing that opens.
  await page.evaluate(() => document.getElementById("film-caption")?.remove());
  if (box) {
    await page.evaluate((box) => {
      const ring = document.createElement("div");
      Object.assign(ring.style, {
        position: "fixed",
        left: `${box.x - 6}px`,
        top: `${box.y - 6}px`,
        width: `${box.width + 12}px`,
        height: `${box.height + 12}px`,
        border: "4px solid #ff9f1c",
        borderRadius: "12px",
        boxShadow: "0 0 0 4px rgba(255, 159, 28, 0.35)",
        zIndex: "2147483645",
        pointerEvents: "none",
      });
      document.body.append(ring);
      setTimeout(() => ring.remove(), 1400);
    }, box);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    if (how === "tap")
      await page.evaluate(
        (detail) =>
          document.dispatchEvent(new CustomEvent("film-finger", { detail })),
        { x, y },
      );
    else await glide(page, x, y);
  }
  await wait(page, 450);
  sound(how === "tap" ? "tap" : "click");
  if (how === "dblclick") sound("click", 110);
  await (how === "right" ? target.click({ button: "right" }) : target[how]());
  await wait(page, 900);
}

/**
 * A key pressed, shown as a keycap beside what it acts on: `near`, or else what has the
 * focus, or else the mouse. It rises in, goes down with the press, and fades.
 */
export async function key(
  page: Page,
  name: string,
  label = name,
  near?: Locator,
) {
  const box = near ? await near.boundingBox() : null;
  await page.evaluate(
    ({ label, box }) => {
      const focused = document.activeElement;
      const around =
        box ??
        (focused && focused !== document.body
          ? focused.getBoundingClientRect()
          : null);
      const mouse = JSON.parse(
        sessionStorage.getItem("film-mouse") ?? "null",
      ) as [number, number] | null;
      // A big focused area (a list, the page) says little: the mouse is better.
      const useful = around && around.height < innerHeight / 3 ? around : null;
      const cap = document.createElement("div");
      cap.className = "film-key";
      cap.textContent = label;
      Object.assign(cap.style, {
        position: "fixed",
        left: "0",
        top: "0",
        padding: "6px 14px",
        minWidth: "44px",
        textAlign: "center",
        borderRadius: "8px",
        background: "linear-gradient(#ffffff, #eceef2)",
        border: "1px solid #b9bdc6",
        boxShadow: "0 4px 0 #9aa0ab, 0 6px 14px rgba(0, 0, 0, 0.3)",
        color: "#1d2129",
        font: "700 18px system-ui, sans-serif",
        zIndex: "2147483646",
        pointerEvents: "none",
      });
      document.body.append(cap);
      const { width, height } = cap.getBoundingClientRect();
      const middle = useful ? useful.y + useful.height / 2 - height / 2 : 0;
      const [x, y] = useful
        ? useful.x + useful.width + width + 16 < innerWidth
          ? [useful.x + useful.width + 12, middle]
          : [useful.x - width - 12, middle]
        : mouse
          ? [mouse[0] + 22, mouse[1] + 22]
          : [innerWidth / 2 - width / 2, innerHeight * 0.6];
      cap.style.translate = `${Math.max(8, Math.min(x, innerWidth - width - 8))}px ${Math.max(8, Math.min(y, innerHeight - height - 12))}px`;
      cap.animate(
        [
          { opacity: 0, transform: "translateY(10px) scale(0.85)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 220, easing: "cubic-bezier(.2,.8,.3,1.2)" },
      );
    },
    { label, box },
  );
  await wait(page, 550);
  await page.evaluate(() => {
    const cap = document.querySelector<HTMLElement>(".film-key:last-of-type");
    cap?.animate(
      [
        { transform: "none", boxShadow: "0 4px 0 #9aa0ab" },
        { transform: "translateY(3px)", boxShadow: "0 1px 0 #9aa0ab" },
        { transform: "none", boxShadow: "0 4px 0 #9aa0ab" },
      ],
      { duration: 260, easing: "ease-out" },
    );
  });
  sound("key");
  await page.keyboard.press(name);
  await wait(page, 750);
  await page.evaluate(() =>
    document.querySelectorAll<HTMLElement>(".film-key").forEach((cap) =>
      cap
        .animate(
          [{ opacity: 1 }, { opacity: 0, transform: "translateY(-6px)" }],
          {
            duration: 300,
            fill: "forwards",
          },
        )
        .finished.then(
          () => cap.remove(),
          () => cap.remove(),
        ),
    ),
  );
  await wait(page, 450);
}

/** Text typed a key at a time, each heard, at a person's uneven pace. */
export async function type(page: Page, text: string) {
  for (const char of text) {
    sound(char === " " ? "space" : "key");
    await page.keyboard.type(char);
    // Faster within a word, a breath after one, now and then a pause to look.
    const pause =
      char === " " ? 140 + Math.random() * 160 : 55 + Math.random() * 110;
    await wait(page, Math.random() < 0.06 ? pause + 250 : pause);
  }
}
