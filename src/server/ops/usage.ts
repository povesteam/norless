import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { deviceTypes } from "../../shared/preferences.js";
import { type Switches, switchesOn } from "../../shared/features.js";
import {
  type UsageBatch,
  type UsageFeature,
  usageFeatures,
  usageShownBy,
} from "../../shared/usage.js";
import { shows } from "../../shared/features.js";
import { pastServices, type ScheduleEvent } from "../schedule/schedule.js";
import type { Db } from "../db/db.js";
import { newId } from "../ids.js";

/** Each feature with each of its ways, or alone when it has none. */
const ways = Object.entries(usageFeatures).flatMap(
  ([feature, vias]): { feature: string; via: string | null }[] =>
    vias.length
      ? vias.map((via: string) => ({ feature, via }))
      : [{ feature, via: null }],
);

const MINUTE = 60_000;
const DAY = 86_400_000;
// Per address and minute; far more than anyone clicks.
const LIMIT = 600;

/**
 * Usage events: the client sends what was used in batches; the
 * server adds the time and the member, unless they switched counting off.
 */
export function attachUsage(
  app: FastifyInstance,
  { db, appTeam = [] }: { db: Db; appTeam?: string[] },
) {
  // ponytail: counts per address in memory, reset each minute; enough for one server.
  let counted = new Map<string, number>();
  const reset = setInterval(() => (counted = new Map()), MINUTE);
  reset.unref();
  app.addHook("onClose", async () => clearInterval(reset));

  const communityOf = db.prepare(
    "SELECT id FROM communities WHERE slug = ? AND deleted_at IS NULL",
  );
  const counts = db
    .prepare(
      "SELECT coalesce(json_extract(preferences, '$.countUsage'), 1) FROM users WHERE id = ?",
    )
    .pluck();
  const insert = db.prepare(
    `INSERT INTO usage_events (id, at, community_id, user_id, device_type, layout, feature, detail)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  app.post<{ Body: UsageBatch }>(
    "/api/usage",
    {
      schema: {
        body: {
          type: "object",
          required: ["deviceType", "events"],
          additionalProperties: false,
          properties: {
            deviceType: { type: "string", enum: [...deviceTypes] },
            events: {
              type: "array",
              maxItems: 100,
              items: {
                type: "object",
                required: ["feature", "ago"],
                additionalProperties: false,
                properties: {
                  feature: { type: "string", enum: Object.keys(usageFeatures) },
                  community: { type: "string", maxLength: 100 },
                  layout: { type: "string", maxLength: 50 },
                  ago: { type: "integer", minimum: 0, maximum: 3_600_000 },
                  detail: {
                    type: "object",
                    maxProperties: 8,
                    additionalProperties: {
                      anyOf: [
                        { type: "string", maxLength: 200 },
                        { type: "number" },
                        { type: "boolean" },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { deviceType, events } = request.body;
      const used = (counted.get(request.ip) ?? 0) + events.length;
      counted.set(request.ip, used);
      if (used > LIMIT) return reply.code(429).send({ error: "Too many" });
      const wrongWay = events.find((e) => {
        const ways: readonly string[] = usageFeatures[e.feature];
        return ways.length > 0 && !ways.includes(String(e.detail?.via));
      });
      if (wrongWay)
        return reply
          .code(400)
          .send({ error: `Unknown way: ${wrongWay.feature}` });

      const user = request.user;
      const userId = user && counts.get(user.id) ? user.id : null;
      const now = Date.now();
      const communities = new Map<string, { id: string } | null>();
      const community = (slug: string) => {
        if (!communities.has(slug))
          communities.set(
            slug,
            (communityOf.get(slug) as { id: string } | undefined) ?? null,
          );
        return communities.get(slug) ?? null;
      };
      db.transaction(() => {
        for (const event of events) {
          const c = event.community ? community(event.community) : null;
          insert.run(
            newId(),
            new Date(now - event.ago).toISOString(),
            c?.id ?? null,
            userId,
            deviceType,
            event.layout ?? null,
            event.feature satisfies UsageFeature,
            event.detail ? JSON.stringify(event.detail) : null,
          );
        }
      })();
      return reply.code(204).send();
    },
  );

  // The app team's pages; owners and members never see usage.
  const appTeamOnly = (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) return reply.code(401).send({ error: "Log in first" });
    const email = request.user.email?.toLowerCase();
    if (!email || !appTeam.includes(email))
      return reply.code(403).send({ error: "For the Norless app team" });
    return null;
  };

  // Each community: its last services, and the ways of its features on not used for 30 days.
  app.get("/api/app-usage", async (request, reply) => {
    if (appTeamOnly(request, reply)) return reply;
    const now = new Date();
    const lastUse = db.prepare(
      `SELECT max(at) AS last FROM usage_events
       WHERE community_id = ? AND feature = ?
         AND (? IS NULL OR json_extract(detail, '$.via') = ?)`,
    );
    const communities = db
      .prepare(
        "SELECT id, slug, name, switches, time_zone AS timeZone FROM communities WHERE deleted_at IS NULL ORDER BY name COLLATE NOCASE",
      )
      .all() as {
      id: string;
      slug: string;
      name: string;
      switches: string;
      timeZone: string;
    }[];
    return {
      features: usageFeatures,
      communities: communities.map((c) => {
        const on = switchesOn(JSON.parse(c.switches) as Switches);
        const schedule = db
          .prepare(
            "SELECT * FROM schedule_events WHERE community_id = ? AND deleted_at IS NULL",
          )
          .all(c.id) as ScheduleEvent[];
        const unused = ways
          .filter(({ feature, via }) => {
            const shownBy = usageShownBy[`${feature} ${via}`];
            return !shownBy || shows(on, shownBy);
          })
          .map((way) => ({
            ...way,
            lastAt: (
              lastUse.get(c.id, way.feature, way.via, way.via) as {
                last: string | null;
              }
            ).last,
          }))
          .filter(
            ({ lastAt }) =>
              !lastAt || now.getTime() - Date.parse(lastAt) > 30 * DAY,
          );
        return {
          slug: c.slug,
          name: c.name,
          services: pastServices(now, schedule, c.timeZone, 12).map((s) => ({
            start: s.start.toISOString(),
            end: s.end.toISOString(),
          })),
          unused,
        };
      }),
    };
  });

  // How often a feature was used, per day or per week (from Monday), by way.
  app.get<{ Querystring: { feature: string; by?: "day" | "week" } }>(
    "/api/app-usage/timeline",
    {
      schema: {
        querystring: {
          type: "object",
          required: ["feature"],
          properties: {
            feature: { type: "string", enum: Object.keys(usageFeatures) },
            by: { type: "string", enum: ["day", "week"] },
          },
        },
      },
    },
    async (request, reply) => {
      if (appTeamOnly(request, reply)) return reply;
      const period =
        request.query.by === "week"
          ? "date(at, '-6 days', 'weekday 1')"
          : "date(at)";
      return db
        .prepare(
          `SELECT ${period} AS period, json_extract(detail, '$.via') AS via, count(*) AS count
           FROM usage_events WHERE feature = ?
           GROUP BY period, via ORDER BY period, via`,
        )
        .all(request.query.feature);
    },
  );

  const eventColumns = `e.id, e.at, c.slug AS community, e.user_id AS userId,
    nullif(u.display_name, '') AS name, e.device_type AS deviceType, e.layout,
    e.feature, json_extract(e.detail, '$.via') AS via, e.detail`;
  const range = {
    type: "object",
    properties: {
      community: { type: "string", maxLength: 100 },
      from: { type: "string", format: "date-time" },
      to: { type: "string", format: "date-time" },
    },
  } as const;
  type Range = { community?: string; from?: string; to?: string };
  const eventsIn = ({ community, from, to }: Range) =>
    db
      .prepare(
        `SELECT ${eventColumns}
         FROM usage_events e LEFT JOIN communities c ON c.id = e.community_id
           LEFT JOIN users u ON u.id = e.user_id
         WHERE (? IS NULL OR c.slug = ?) AND (? IS NULL OR e.at >= ?) AND (? IS NULL OR e.at < ?)
         ORDER BY e.at, e.rowid`,
      )
      .all(
        community ?? null,
        community ?? null,
        from ?? null,
        from ?? null,
        to ?? null,
        to ?? null,
      ) as Record<string, string | number | null>[];

  // The events in order, e.g. of one service.
  app.get<{ Querystring: Range }>(
    "/api/app-usage/events",
    { schema: { querystring: range } },
    async (request, reply) => {
      if (appTeamOnly(request, reply)) return reply;
      return eventsIn(request.query);
    },
  );

  // Every event, or those of a range, for a spreadsheet.
  app.get<{ Querystring: Range }>(
    "/api/app-usage/events.csv",
    { schema: { querystring: range } },
    async (request, reply) => {
      if (appTeamOnly(request, reply)) return reply;
      const header = [
        "at",
        "community",
        "userId",
        "deviceType",
        "layout",
        "feature",
        "via",
        "detail",
      ];
      const cell = (value: string | number | null | undefined) => {
        const text = value == null ? "" : String(value);
        return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
      };
      const rows = eventsIn(request.query).map((e) =>
        header.map((h) => cell(e[h])).join(","),
      );
      return reply
        .type("text/csv; charset=utf-8")
        .header(
          "content-disposition",
          'attachment; filename="norless-usage.csv"',
        )
        .send([header.join(","), ...rows].join("\n") + "\n");
    },
  );
}
