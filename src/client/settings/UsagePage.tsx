import { Chip } from "@heroui/react";
import { Download } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type UsageFeature, usageFeatures } from "../../shared/usage";
import { useJson } from "../data/fetch";
import { useMe } from "../data/me";
import { Choice } from "../ui/choice";
import { Empty, ErrorNotice, Placeholder } from "../ui/states";

type Overview = {
  communities: {
    slug: string;
    name: string;
    services: { start: string; end: string }[];
    unused: { feature: string; via: string | null; lastAt: string | null }[];
  }[];
};
type Count = { period: string; via: string | null; count: number };
type Event = {
  id: string;
  at: string;
  userId: string | null;
  name: string | null;
  deviceType: string;
  layout: string | null;
  feature: string;
  via: string | null;
  detail: string | null;
};

const way = (feature: string, via: string | null) =>
  via ? `${feature} · ${via}` : feature;

/**
 * /app-usage, for the Norless app team: what nobody used lately, a feature's timeline,
 * one service's events in order, and every event as CSV.
 */
export function UsagePage() {
  const { t, i18n } = useTranslation();
  const { me } = useMe();
  const { data, failed, retry } = useJson<Overview>(
    me?.appTeam ? "/api/app-usage" : null,
  );
  if (!me) return <Placeholder lines={4} />;
  if (!me.appTeam) return <p>{t("usage.appOnly")}</p>;
  if (data === undefined)
    return failed ? (
      <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
    ) : (
      <Placeholder lines={8} />
    );
  if (data === null) return null;
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" });
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">{t("usage.title")}</h2>
        <a className="link" href="/api/app-usage/events.csv" download>
          <Download />
          {t("usage.csv")}
        </a>
      </div>

      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">{t("usage.unusedTitle")}</h3>
        <p className="text-muted">{t("usage.unusedHelp")}</p>
        {data.communities.map((c) => (
          <div key={c.slug} className="flex flex-col gap-2">
            <p>
              <span className="font-medium">{c.name}</span>
            </p>
            {c.unused.length === 0 ? (
              <p className="text-muted">{t("usage.allUsed")}</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {c.unused.map((u) => (
                  <li key={way(u.feature, u.via)}>
                    <Chip size="sm" variant="secondary">
                      {way(u.feature, u.via)}
                      {" · "}
                      {u.lastAt
                        ? t("usage.last", {
                            date: date.format(new Date(u.lastAt)),
                          })
                        : t("usage.never")}
                    </Chip>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>

      <Timeline
        serviceDays={
          new Set(
            data.communities.flatMap((c) =>
              c.services.map((s) => s.start.slice(0, 10)),
            ),
          )
        }
      />
      <ServiceEvents communities={data.communities} />
    </div>
  );
}

/** A feature's uses per day or week, by way, with the days that had a service marked. */
function Timeline({ serviceDays }: { serviceDays: Set<string> }) {
  const { t } = useTranslation();
  const [feature, setFeature] = useState<UsageFeature>("live.go");
  const [by, setBy] = useState<"day" | "week">("week");
  const { data, failed, retry } = useJson<Count[]>(
    `/api/app-usage/timeline?feature=${feature}&by=${by}`,
  );
  const ways = [...new Set(data?.map((c) => c.via ?? "") ?? [])];
  const periods = [...new Set(data?.map((c) => c.period) ?? [])].reverse();
  const count = (period: string, via: string) =>
    data?.find((c) => c.period === period && (c.via ?? "") === via)?.count ?? 0;
  const total = (period: string) =>
    ways.reduce((sum, via) => sum + count(period, via), 0);
  const most = Math.max(1, ...periods.map(total));
  // A week is marked when one of its days had a service.
  const hadService = (period: string) =>
    by === "day"
      ? serviceDays.has(period)
      : [...serviceDays].some(
          (day) =>
            day >= period &&
            Date.parse(day) - Date.parse(period) < 7 * 86_400_000,
        );
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold">{t("usage.timelineTitle")}</h3>
      <div className="flex flex-wrap gap-4">
        <Choice
          label={t("usage.feature")}
          value={feature}
          onChange={(value) => setFeature(value as UsageFeature)}
          options={Object.keys(usageFeatures).map((f) => ({ id: f, name: f }))}
        />
        <Choice
          label={t("usage.by")}
          value={by}
          onChange={(value) => setBy(value as "day" | "week")}
          options={[
            { id: "week", name: t("usage.byWeek") },
            { id: "day", name: t("usage.byDay") },
          ]}
        />
      </div>
      {data === undefined ? (
        failed ? (
          <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
        ) : (
          <Placeholder lines={6} />
        )
      ) : !periods.length ? (
        <Empty
          title={t("usage.noEvents")}
          description={t("usage.noEventsHelp")}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-start text-muted">
                <th className="py-1 pe-3 text-start font-medium">
                  {t(by === "day" ? "usage.day" : "usage.week")}
                </th>
                {ways.map((via) => (
                  <th key={via} className="px-3 py-1 text-end font-medium">
                    {via || "—"}
                  </th>
                ))}
                <th className="ps-3 py-1 text-start font-medium">
                  {t("usage.total")}
                </th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period} className="border-t border-separator">
                  <td className="py-1 pe-3 whitespace-nowrap tabular-nums">
                    {period}
                    {hadService(period) && (
                      <Chip size="sm" variant="soft" className="ms-2">
                        {t("usage.service")}
                      </Chip>
                    )}
                  </td>
                  {ways.map((via) => (
                    <td key={via} className="px-3 py-1 text-end tabular-nums">
                      {count(period, via) || ""}
                    </td>
                  ))}
                  <td className="w-1/3 min-w-32 ps-3 py-1">
                    <span className="flex items-center gap-2">
                      <span
                        className="h-3 rounded-e bg-accent"
                        style={{ width: `${(total(period) / most) * 80}%` }}
                      />
                      <span className="tabular-nums">{total(period)}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Everything counted during one of a community's last services, in order. */
function ServiceEvents({
  communities,
}: {
  communities: Overview["communities"];
}) {
  const { t, i18n } = useTranslation();
  const services = communities.flatMap((c) =>
    c.services.map((s) => ({ ...s, community: c.slug, name: c.name })),
  );
  const [chosen, setChosen] = useState(0);
  const service = services[chosen];
  const { data, failed, retry } = useJson<Event[]>(
    service
      ? `/api/app-usage/events?community=${service.community}&from=${service.start}&to=${service.end}`
      : null,
  );
  const when = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: "medium",
    timeStyle: "short",
    hourCycle: "h23",
  });
  const time = new Intl.DateTimeFormat(i18n.language, {
    timeStyle: "medium",
    hourCycle: "h23",
  });
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold">{t("usage.serviceTitle")}</h3>
      {!service ? (
        <Empty
          title={t("usage.noServices")}
          description={t("usage.noServicesHelp")}
        />
      ) : (
        <>
          <Choice
            label={t("usage.service")}
            value={String(chosen)}
            onChange={(value) => setChosen(Number(value))}
            options={services.map((s, i) => ({
              id: String(i),
              name: `${s.name} · ${when.format(new Date(s.start))}`,
            }))}
          />
          {data === undefined ? (
            failed ? (
              <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
            ) : (
              <Placeholder lines={6} />
            )
          ) : !data?.length ? (
            <Empty
              title={t("usage.noEvents")}
              description={t("usage.noEventsHelp")}
            />
          ) : (
            <ol className="flex flex-col text-sm">
              {data.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap gap-x-3 border-t border-separator py-1"
                >
                  <span className="tabular-nums text-muted">
                    {time.format(new Date(e.at))}
                  </span>
                  <span className="font-medium">{way(e.feature, e.via)}</span>
                  <span className="text-muted">
                    {[
                      e.layout,
                      t(`device.${e.deviceType}`),
                      e.name ?? (e.userId ? null : t("usage.uncounted")),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
