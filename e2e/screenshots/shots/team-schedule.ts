import { api } from "../../helpers";
import { slug, type View, team, owner, musician, open } from "../views";

export const teamSchedule: View[] = [
  {
    // The team schedule: a template, someone asked, someone in.
    name: "team-schedule",
    as: team,
    sizes: ["laptop", "phone"],
    go: async (page) => {
      const url = `/api/communities/${slug}`;
      const { body } = await api(page, "GET", `${url}/team-schedule`);
      const schedule = body as {
        roles: {
          id: string;
          name: string;
          leads: boolean;
          instrument: string | null;
        }[];
        events: { id: string }[];
        dates: { eventId: string; date: string }[];
        people: { id: string; name: string }[];
      };
      const kind = (instrument: string) =>
        schedule.roles.find((r) => r.instrument === instrument);
      const lead = schedule.roles.find((r) => r.leads);
      const [voice, guitar, keys] = [
        kind("vocals"),
        kind("guitar"),
        kind("keys"),
      ];
      // The weekly event with dates to come.
      const event = schedule.events.find(
        (e) => e.id === schedule.dates[0]?.eventId,
      );
      if (event && lead && voice && guitar && keys) {
        await api(page, "PUT", `${url}/slot-templates/${event.id}`, {
          template: [
            { roleId: lead.id, count: 1 },
            { roleId: voice.id, count: 2 },
            { roleId: guitar.id, count: 1 },
            { roleId: keys.id, count: 1 },
          ],
        });
        const next = schedule.dates.find((d) => d.eventId === event.id);
        const person = (name: string) =>
          schedule.people.find((p) => p.name.startsWith(name))?.id ?? null;
        if (next) {
          const slot = (key: string) =>
            `${url}/team-schedule/${next.eventId}/${next.date}/slots/${encodeURIComponent(key)}/assign`;
          await api(page, "POST", slot(`${lead.id}:0`), {
            userId: person("Mihai"),
          });
          await api(page, "POST", slot(`${voice.id}:0`), {
            userId: person("Elena"),
          });
          await api(page, "POST", slot(`${guitar.id}:0`), {
            userId: person("Andrei"),
          });
        }
      }
      await page.goto(`/${slug}/team-schedule`);
    },
  },
  {
    // Who leads each song: the service's lead, or a vocalist the team
    // chose; after the team schedule's shot, which fills next Sunday's slots.
    name: "led-by",
    as: owner,
    sizes: ["laptop"],
    go: async (page) => {
      const url = `/api/communities/${slug}`;
      // The demo's services are past: a special service next week, which the new
      // playlist plans.
      const inAWeek = new Date(Date.now() + 7 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      await api(page, "POST", `${url}/schedule`, {
        kind: "one_off",
        name: "Thanksgiving",
        type: "service",
        date: inAWeek,
        startTime: "10:00",
        endTime: "12:00",
      });
      const { body } = await api(page, "POST", `${url}/playlists`, {
        title: "Thanksgiving",
      });
      const { id, service } = body as {
        id: string;
        service: { eventId: string; date: string } | null;
      };
      // Mihai leads that Sunday.
      const roles = (await api(page, "GET", `${url}/team-schedule`)).body as {
        roles: { id: string; leads: boolean }[];
      };
      const lead = roles.roles.find((r) => r.leads);
      if (service && lead) {
        const at = `${url}/team-schedule/${service.eventId}/${service.date}/slots`;
        await api(page, "POST", at, { roleId: lead.id });
        const { body: schedule } = await api(
          page,
          "GET",
          `${url}/team-schedule`,
        );
        const slot = (
          schedule as {
            dates: {
              eventId: string;
              date: string;
              slots: {
                key: string;
                roleId: string;
                userId: string | null;
              }[];
            }[];
          }
        ).dates
          .find((d) => d.eventId === service.eventId && d.date === service.date)
          ?.slots.find((s) => s.roleId === lead.id && !s.userId);
        if (slot)
          await api(
            page,
            "POST",
            `${at}/${encodeURIComponent(slot.key)}/assign`,
            { userId: "mihai" },
          );
      }
      const entries: string[] = [];
      for (const songId of ["grace", "holy", "well"]) {
        const entry = await api(
          page,
          "POST",
          `${url}/playlists/${id}/entries`,
          {
            kind: "song",
            songId,
          },
        );
        entries.push((entry.body as { id: string }).id);
      }
      await api(page, "PATCH", `${url}/playlists/${id}/entries/${entries[1]}`, {
        ledBy: "elena",
      });
      await page.goto(`/${slug}/playlists/${id}`);
      await page.getByText("Led by Mihai Ionescu").first().waitFor();
    },
  },
  {
    name: "my-schedule",
    as: musician,
    sizes: ["phone"],
    go: open(`/${slug}/my-schedule`),
  },
  {
    name: "settings-roles",
    as: owner,
    sizes: ["laptop"],
    go: open(`/${slug}/settings/roles`),
  },
];
