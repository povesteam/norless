import { expect, test } from "@playwright/test";
import { rows, slides } from "../classic/playlist";
import {
  type Entry,
  film,
  glide,
  hintsSeen,
  key,
  lastService,
  lastServiceStart,
  logIn,
  press,
  say,
  slug,
  sound,
  type,
} from "./film";

// Classic's training videos, what the team has from the first
// Sunday: captions in English, on the real songs of the
// newest playlist. `VIDEO_DB=… npm run videos`; `-g` films one again. Building a
// playlist comes last: it fills next Sunday's, which lastService() would then pick.

test("1-laptop-operator", async ({ browser }) => {
  const { laptop, done } = await film(browser, "1-laptop-operator", ["laptop"]);
  await logIn(laptop);
  await laptop.goto(lastService());
  await expect(rows(laptop).first()).toBeVisible();
  await say(laptop, "The service's playlist, on the laptop at the projector.");

  const first = rows(laptop)
    .filter({ has: laptop.locator("svg.lucide-music") })
    .first();
  await press(first);
  await say(
    laptop,
    "Click a song to see its slides, without putting it on the screen.",
  );
  await press(laptop.getByRole("button", { name: "Go live" }));
  await say(
    laptop,
    "Go live puts it on the projector, from the first slide. Double-clicking the song does the same.",
  );
  await key(laptop, "PageDown", "Page Down");
  await key(laptop, "ArrowRight", "→");
  await say(
    laptop,
    "Page Down or the right arrow: the next slide. The clicker does the same.",
  );
  await key(laptop, "PageUp", "Page Up");
  await say(laptop, "Page Up or the left arrow: back.");
  await press(slides(laptop).getByRole("button").nth(3));
  await say(laptop, "Click any slide to send it straight to the screen.");

  await key(laptop, "Escape", "Esc");
  await say(laptop, "Esc blanks the screen. The slide stays selected.");
  await press(laptop.getByRole("button", { name: "Show again" }));
  await say(laptop, "Show again brings it back.");
  await press(laptop.getByRole("button", { name: "Next" }));
  await say(
    laptop,
    "At the bottom: Previous, Blank and Next, for working with the mouse.",
  );

  const next = rows(laptop)
    .filter({ has: laptop.locator("svg.lucide-music") })
    .nth(1);
  await press(next, "dblclick");
  await say(
    laptop,
    "Double-click the next song to put it straight on the screen.",
  );
  const pages = laptop.getByRole("button", { name: "Pages" });
  if (await pages.isVisible()) {
    await press(pages);
    await say(
      laptop,
      "Pages: the start and end pages, for before and after the service.",
      "top",
    );
    await laptop.keyboard.press("Escape");
  }
  await say(
    laptop,
    "That's all: pick the song, Go live, Page Down, and Esc for a blank screen.",
  );
  await done();
});

test("3-phone-and-laptop", async ({ browser }) => {
  const { laptop, phone, done } = await film(browser, "3-phone-and-laptop", [
    "laptop",
    "phone",
  ]);
  await laptop.goto(`/login?next=${encodeURIComponent(`/${slug}`)}`);
  await logIn(phone);
  await phone.goto(`/${slug}`);
  await say(
    laptop,
    "The church's laptop, logged out. Your phone can log it in.",
  );
  const offer = phone.getByRole("alert");
  await expect(offer).toBeVisible({ timeout: 30_000 });
  await say(
    phone,
    "Norless on your phone sees the laptop on the same Wi-Fi.",
    "top",
  );
  await press(offer.getByRole("button", { name: "Review" }), "tap");
  await say(
    phone,
    "The same number on the laptop and the phone: it's your laptop.",
    "top",
  );
  await press(
    phone.getByRole("button", { name: "As the community's laptop" }),
    "tap",
  );
  await expect(rows(laptop).first()).toBeVisible({ timeout: 30_000 });
  await hintsSeen(laptop);
  await laptop.goto(lastService());
  await say(
    laptop,
    "Done: the laptop is logged in as the community's laptop, for the service only.",
  );

  await phone.goto(lastService());
  await expect(rows(phone).first()).toBeVisible();
  await say(phone, "Your phone can change the slides too.", "top");
  await press(
    rows(phone)
      .filter({ has: phone.locator("svg.lucide-music") })
      .first(),
    "tap",
  );
  await press(slides(phone).getByRole("button").first(), "tap");
  await say(
    phone,
    "Tap the song, then a slide: it's on the screen, and the laptop shows it.",
    "top",
  );
  await press(phone.getByRole("button", { name: "Next" }), "tap");
  await press(phone.getByRole("button", { name: "Next" }), "tap");
  await say(
    phone,
    "At the bottom: back, blank, next, and the title of what's on the screen.",
    "top",
  );
  await press(
    phone.getByRole("button", { name: "Back to the playlist" }),
    "tap",
  );
  await say(phone, "The arrow at the top takes you back to the list.", "top");
  await done();
});

test("4-projectors", async ({ browser }) => {
  const { laptop, projector, done } = await film(browser, "4-projectors", [
    "laptop",
    "projector",
  ]);
  await logIn(projector);
  await projector.goto(`/${slug}/projector/ro`);
  // The projector's window is filmed on its own, beside the laptop.
  await laptop.addInitScript(() => {
    window.open = () => null;
  });
  await logIn(laptop);
  await laptop.goto(lastService());
  await expect(rows(laptop).first()).toBeVisible();
  await press(laptop.getByRole("button", { name: "Projector RO" }));
  await say(
    laptop,
    "Projector RO opens the projector's window on the second screen, full screen. The first time, the browser asks for permission.",
  );
  await say(laptop, "On the right: what the projector shows.");
  // The third song: the first two are left live by the videos filmed before.
  await press(
    rows(laptop)
      .filter({ has: laptop.locator("svg.lucide-music") })
      .nth(2),
  );
  await press(laptop.getByRole("button", { name: "Go live" }));
  await say(laptop, "What you put live shows on the projector.");
  await key(laptop, "PageDown", "Page Down");
  await key(laptop, "PageDown", "Page Down");
  await key(laptop, "Escape", "Esc");
  await say(
    laptop,
    "Esc: the projector goes black, without closing its window.",
  );
  await press(laptop.getByRole("button", { name: "Show again" }));
  await say(laptop, "Projector UA does the same for the Ukrainian screen.");
  await say(
    laptop,
    "The clicker works even when the projector's window is in front.",
  );
  await done();
});

test("2-building-a-playlist", async ({ browser }) => {
  // The last service's start, its first entry added last, as if forgotten.
  const [forgotten, ...rest] = lastServiceStart();
  if (!forgotten) throw new Error("The last service has no entries");
  const { laptop, done } = await film(browser, "2-building-a-playlist", [
    "laptop",
  ]);
  await logIn(laptop);
  await laptop.goto(`/${slug}`);
  await expect(laptop.locator("[data-bar-title]")).toBeVisible();
  await say(
    laptop,
    "After each service, Norless makes next Sunday's playlist by itself, empty.",
  );
  await press(laptop.locator("[data-bar-title] button"));
  await say(
    laptop,
    "Its name is at the top: click it to rename it. Enter keeps the new name, Esc leaves it as it was.",
  );
  await key(laptop, "Escape", "Esc");
  await press(laptop.getByRole("button", { name: "Menu" }));
  await say(
    laptop,
    "For another occasion: New playlist in the menu, named by its date. Here too: recent playlists, and a search for older ones.",
  );
  await press(
    laptop
      .getByRole("dialog", { name: "Menu" })
      .getByRole("button", { name: "Close" }),
  );

  await say(
    laptop,
    "Type anywhere on the page to search. Here, last Sunday's service from the start.",
  );
  const told = new Set<string>();
  const add = async (entry: Entry) => {
    await type(laptop, entry.query);
    const options = laptop.getByRole("option");
    const option =
      entry.kind === "song"
        ? options.filter({
            has: laptop.getByText(entry.text, { exact: true }),
          })
        : entry.kind === "bible"
          ? options.filter({ hasText: entry.text })
          : options.filter({ hasText: `Add “${entry.text}” as a divider` });
    await expect(option.first()).toBeVisible();
    await laptop.waitForTimeout(800);
    if ((await options.first().and(option).count()) > 0)
      await key(laptop, "Enter");
    else await press(option.first());
    if (told.has(entry.kind)) return;
    told.add(entry.kind);
    await say(
      laptop,
      {
        song: "Enter adds the first song found; the arrows or a click pick another. Diacritics don't matter.",
        bible: `A Bible passage: the book in Romanian or Ukrainian, the chapter and verses, like “${entry.query}”.`,
        divider: `Text that isn't a song becomes a divider, like “${entry.text}”.`,
      }[entry.kind],
    );
  };
  for (const entry of rest) await add(entry);

  await say(laptop, "Forgot something? Add it now: it goes at the end.");
  await add(forgotten);
  const from = await rows(laptop).last().boundingBox();
  const to = await rows(laptop).first().boundingBox();
  if (from && to) {
    await say(
      laptop,
      "Drag the row where it belongs. On a phone: press and hold, then drag.",
    );
    await glide(laptop, from.x + 40, from.y + from.height / 2);
    sound("click");
    await laptop.mouse.down();
    await glide(laptop, from.x + 44, to.y + 2, 45);
    await glide(laptop, from.x + 40, to.y + 2, 6);
    await laptop.mouse.up();
    await laptop.waitForTimeout(1200);
  }
  await press(rows(laptop).nth(1), "right");
  await say(
    laptop,
    "Right-click a row for its other actions: move, a divider above, remove. Delete removes the selected row.",
    "top",
  );
  await key(laptop, "Escape", "Esc");
  await say(laptop, "The whole team sees the list at once, without reloading.");
  await done();
});
