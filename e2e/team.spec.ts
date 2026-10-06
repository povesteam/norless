import { type Browser } from "@playwright/test";
import { api, expect, logInAs, test } from "./helpers";

test.describe.configure({ mode: "serial" });

async function as(browser: Browser, email: string) {
  const page = await (await browser.newContext()).newPage();
  await logInAs(page, email);
  return page;
}

test("the team fills a service's places; the person accepts, and marks days away", async ({
  browser,
}) => {
  const ioana = await as(browser, "ioana@example.com");
  await ioana.goto("/echipa/team-schedule");
  await expect(
    ioana.getByRole("heading", { name: "Team schedule" }),
  ).toBeVisible();
  // Each Sunday starts with one vocalist.
  const template = ioana.locator("div").filter({
    has: ioana.getByRole("heading", { name: "Serviciu", level: 4 }),
  });
  await template.getByRole("button", { name: "Increase Voce" }).click();
  await template.getByRole("button", { name: "Save for Serviciu" }).click();
  const sunday = ioana.getByRole("region", { name: /^Serviciu, / }).first();
  const who = sunday.getByRole("button", { name: /Who for Voce/ });
  await expect(who).toBeVisible();
  // On the 24-hour clock, in English too.
  await expect(sunday).toContainText("10:00");
  await expect(sunday).not.toContainText(/\b[AP]M\b/);

  // Maria is asked; she accepts from her schedule, and the line above every page says so.
  await who.click();
  await ioana.getByRole("option", { name: "Maria" }).click();
  await expect(sunday.getByText("Waiting for an answer")).toBeVisible();

  const maria = await as(browser, "maria@example.com");
  await maria.goto("/echipa/my-schedule");
  await expect(maria.getByText("Voce", { exact: true })).toBeVisible();
  // What she was told; the line at the top stays off this page, which has the same.
  await expect(maria.getByText(/You're on Voce/)).toHaveCount(1);
  // And how it went by push: these tests run without the server's keys.
  await expect(
    maria.getByText("Only here: notifications to phones aren't set up yet"),
  ).toBeVisible();
  await maria.getByRole("button", { name: "Accept" }).first().click();
  await expect(sunday.getByText("Waiting for an answer")).toHaveCount(0);

  // Days away, which the team sees when it plans.
  await maria.getByLabel("From").fill("2030-07-01");
  await maria.getByLabel("To").fill("2030-07-14");
  await maria.getByRole("button", { name: "Add" }).click();
  await expect(
    maria.getByRole("button", { name: "Remove these days" }),
  ).toBeVisible();
});

test("owners rename the roles in Settings", async ({ browser }) => {
  const ana = await as(browser, "ana@example.com");
  await ana.goto("/echipa/settings/roles");
  // After the worship lead, who leads the songs.
  await expect(ana.getByRole("textbox", { name: "Name" }).first()).toHaveValue(
    "Lider de laudă",
  );
  await expect(
    ana.getByRole("checkbox", { name: "Leads the songs" }).first(),
  ).toBeChecked();
  const name = ana.getByRole("textbox", { name: "Name" }).nth(1);
  await expect(name).toHaveValue("Voce");
  // Its instrument by name, not by key.
  await expect(
    ana.getByRole("button", { name: /Instrument/ }).nth(1),
  ).toContainText("Vocals");
  await name.fill("Voci");
  await ana.getByRole("button", { name: "Save" }).click();
  await expect(ana.getByText("Saved")).toBeVisible();
  await ana.goto("/echipa/team-schedule");
  await expect(
    ana.getByRole("button", { name: /Who for Voci/ }).first(),
  ).toBeVisible();
});

test("the team removes a place from its row's menu, after a confirmation", async ({
  browser,
}) => {
  const ioana = await as(browser, "ioana@example.com");
  await ioana.goto("/echipa/team-schedule");
  // The second Sunday, from the template of one vocalist (renamed Voci above).
  const sunday = ioana.getByRole("region", { name: /^Serviciu, / }).nth(1);
  await expect(
    sunday.getByRole("button", { name: /Who for Voci/ }),
  ).toHaveCount(1);
  await expect(
    sunday.getByRole("button", { name: /^Remove this place/ }),
  ).toHaveCount(0);
  ioana.once("dialog", (dialog) => void dialog.accept());
  await sunday.getByRole("button", { name: "Actions: place for Voci" }).click();
  await ioana
    .getByRole("menuitem", { name: "Remove this place for Voci" })
    .click();
  await expect(
    sunday.getByRole("button", { name: /Who for Voci/ }),
  ).toHaveCount(0);
});

test("the worship lead leads each song; the team gives one to a vocalist", async ({
  browser,
}) => {
  const ioana = await as(browser, "ioana@example.com");
  const base = "/api/communities/echipa";
  const schedule = async () =>
    (await api(ioana, "GET", `${base}/team-schedule`)).body as {
      roles: {
        id: string;
        name: string;
        leads: boolean;
        instrument: string | null;
      }[];
      dates: {
        eventId: string;
        date: string;
        slots: { key: string; roleId: string }[];
      }[];
    };
  // A playlist made now plans the next Sunday.
  const ana = await as(browser, "ana@example.com");
  const song = await api(ana, "POST", `${base}/songs`, {
    versions: [{ language: "ro", title: "Cine conduce", text: "Strofa" }],
  });
  const playlist = await api(ioana, "POST", `${base}/playlists`, {
    title: "Duminică",
  });
  const { id: playlistId, service } = playlist.body as {
    id: string;
    service: { eventId: string; date: string };
  };
  const entry = await api(
    ioana,
    "POST",
    `${base}/playlists/${playlistId}/entries`,
    { kind: "song", songId: (song.body as { id: string }).id },
  );

  // Ana leads that Sunday, and Maria sings.
  const { roles } = await schedule();
  const at = `${base}/team-schedule/${service.eventId}/${service.date}/slots`;
  for (const [role, person] of [
    [roles.find((r) => r.leads), "ana"],
    [roles.find((r) => r.instrument === "vocals"), "maria"],
  ] as const) {
    await api(ioana, "POST", at, { roleId: role?.id });
    const slot = (await schedule()).dates
      .find((d) => d.date === service.date)
      ?.slots.findLast((s) => s.roleId === role?.id);
    await api(ioana, "POST", `${at}/${slot?.key}/assign`, { userId: person });
  }

  await ioana.goto(`/echipa/playlists/${playlistId}`);
  const row = ioana.locator(
    `[data-entry="${(entry.body as { id: string }).id}"]`,
  );
  await expect(row.getByText("Led by Ana")).toBeVisible();

  // Maria, a vocalist that Sunday, takes it from the row's menu.
  await row.click({ button: "right" });
  await ioana.getByRole("menuitem", { name: "Led by…" }).click();
  await ioana.getByRole("dialog").getByText("Maria", { exact: true }).click();
  await ioana
    .getByRole("dialog")
    .getByRole("button", { name: "Close" })
    .click();
  await expect(row.getByText("Led by Maria")).toBeVisible();

  // Live, the musicians view says who leads.
  await api(ioana, "POST", `${base}/live`, {
    type: "go",
    entryId: (entry.body as { id: string }).id,
  });
  await ioana.goto("/echipa/musicians");
  await expect(ioana.getByText("Led by Maria")).toBeVisible();
});

test("an owner sets the church's calendar, whose address only owners see", async ({
  browser,
}) => {
  const ana = await as(browser, "ana@example.com");
  await ana.goto("/echipa/settings/schedule");
  const address = ana.getByRole("textbox", { name: "iCal address" });
  await address.fill("ftp://calendar.example/church.ics");
  await ana.getByRole("button", { name: "Save" }).last().click();
  await expect(
    ana.getByText("An https:// or webcal:// address."),
  ).toBeVisible();
  // An address that answers with no calendar is told, and kept.
  await address.fill("webcal://127.0.0.1/church.ics");
  await ana.getByRole("button", { name: "Save" }).last().click();
  await expect(
    ana.getByText("Couldn't read a calendar at this address."),
  ).toBeVisible();
  await expect(address).toHaveValue("https://127.0.0.1/church.ics");

  // Members are told it couldn't be read, and never get the address.
  const maria = await as(browser, "maria@example.com");
  const calendar = await api(maria, "GET", "/api/communities/echipa/calendar");
  expect(calendar.body).toMatchObject({ events: [], failed: true });
  expect(calendar.body).not.toHaveProperty("url");
  await maria.goto("/echipa/my-schedule");
  await expect(
    maria.getByRole("heading", { name: "In the church's calendar" }),
  ).toBeVisible();
});

test("the team tells the service's people the playlist is ready", async ({
  browser,
}) => {
  const ioana = await as(browser, "ioana@example.com");
  const base = "/api/communities/echipa";
  const playlist = await api(ioana, "POST", `${base}/playlists`, {
    title: "Gata",
  });
  const { id, service } = playlist.body as {
    id: string;
    service: { eventId: string; date: string };
  };
  // Maria sings that Sunday.
  const roles = (
    (await api(ioana, "GET", `${base}/team-schedule`)).body as {
      roles: { id: string; instrument: string | null }[];
    }
  ).roles;
  const voice = roles.find((r) => r.instrument === "vocals");
  const at = `${base}/team-schedule/${service.eventId}/${service.date}/slots`;
  await api(ioana, "POST", at, { roleId: voice?.id });
  const dates = (
    (await api(ioana, "GET", `${base}/team-schedule`)).body as {
      dates: {
        date: string;
        slots: { key: string; roleId: string; userId: string | null }[];
      }[];
    }
  ).dates;
  const slot = dates
    .find((d) => d.date === service.date)
    ?.slots.find((s) => s.roleId === voice?.id && !s.userId);
  await api(ioana, "POST", `${at}/${slot?.key}/assign`, { userId: "maria" });

  await ioana.goto(`/echipa/playlists/${id}`);
  await ioana.getByRole("button", { name: "Playlist actions" }).click();
  await ioana
    .getByRole("menuitem", { name: "Tell the team it's ready" })
    .click();
  await ioana.getByRole("button", { name: "Tell them" }).click();
  await expect(ioana.getByRole("dialog").getByRole("status")).toHaveText(
    /Told \d+ (people|person)\./,
  );

  const maria = await as(browser, "maria@example.com");
  await maria.goto("/echipa/my-schedule");
  await expect(maria.getByText(/Gata · .+ is ready: 0 songs/)).toBeVisible();
});
