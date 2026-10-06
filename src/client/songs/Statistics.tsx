import { CirclePlay, ChartColumn, Plus } from "lucide-react";
import { Label, ListBox, Select } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import type { SongResult } from "../../server/songs/search";
import type { Miss } from "../../server/songs/search-misses";
import type {
  CountedSong,
  Season,
  ServicesGrid,
  SongPlays,
  YearRecap,
} from "../../server/songs/statistics";
import { titleFor } from "../../shared/song-render";
import { useCommunity, useShows } from "../data/community";
import { useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { hasRole, useIsMember, useRoles } from "../data/me";
import { Empty, ErrorNotice, Placeholder } from "../ui/states";
import { relativeTime } from "../ui/time";

const seasons: Season[] = ["winter", "spring", "summer", "autumn"];

/** A choice in a Select: its id and its words. */
export function Choice({
  label,
  value,
  options,
  onChange,
  isDisabled,
}: {
  label: string;
  value: string;
  options: [id: string, text: string][];
  onChange: (id: string) => void;
  isDisabled?: boolean;
}) {
  return (
    <Select
      value={value}
      onChange={(id) => onChange(String(id))}
      isDisabled={isDisabled}
      className="w-48"
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map(([id, text]) => (
            <ListBox.Item key={id} id={id} textValue={text}>
              {text}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

/**
 * /<community>/statistics, for members: the most sung songs of a period and the songs not
 * sung lately, counting services only.
 */
export function StatisticsPage() {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const shows = useShows();
  const roles = useRoles(slug);
  const [period, setPeriod] = useState("last12");
  const [season, setSeason] = useState("year");
  const year = /^\d{4}$/.test(period);
  const query = new URLSearchParams({ period });
  if (year && season !== "year") query.set("season", season);
  const { data, failed, retry } = useJson<{
    years: number[];
    mostSung: CountedSong[];
    notLately: CountedSong[];
    sungLately: SongResult[];
    recap: YearRecap | null;
    grid: ServicesGrid;
  }>(`/api/communities/${slug}/statistics?${query}`);

  if (data === null) return <p>{t("statistics.membersOnly")}</p>;
  if (!data)
    return failed ? (
      <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
    ) : (
      <Placeholder lines={10} />
    );
  return (
    <div className="flex flex-col gap-6">
      <h2 className="flex items-center gap-2 text-2xl font-semibold">
        <ChartColumn />
        {t("statistics.title")}
      </h2>
      <p className="text-sm text-muted">{t("statistics.help")}</p>
      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">{t("statistics.mostSung")}</h3>
        <div className="flex flex-wrap items-end gap-3">
          <Choice
            label={t("statistics.period")}
            value={period}
            onChange={setPeriod}
            options={[
              ["last12", t("statistics.last12")],
              ["all", t("statistics.all")],
              ...data.years.map((y): [string, string] => [
                String(y),
                String(y),
              ]),
            ]}
          />
          {/* Within a year only. */}
          <Choice
            label={t("statistics.season")}
            value={year ? season : "year"}
            onChange={setSeason}
            isDisabled={!year}
            options={[
              ["year", t("statistics.wholeYear")],
              ...seasons.map((s): [string, string] => [
                s,
                t(`statistics.seasons.${s}`),
              ]),
            ]}
          />
        </div>
        {data.recap && data.recap.services > 0 && (
          <Recap year={period} recap={data.recap} />
        )}
        <SongList
          songs={data.mostSung}
          replays={shows("replays")}
          empty={t("statistics.noServices")}
          emptyHelp={t("statistics.noServicesHelp")}
        />
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">{t("statistics.notLately")}</h3>
        <p className="text-sm text-muted">{t("statistics.notLatelyHelp")}</p>
        <SongList
          songs={data.notLately}
          empty={t("statistics.noneForgotten")}
          emptyHelp={t("statistics.noneForgottenHelp")}
        />
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">{t("grid.title")}</h3>
        <Grid grid={data.grid} />
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">{t("rotation.title")}</h3>
        <p className="text-sm text-muted">{t("rotation.help")}</p>
        <SongList
          songs={data.sungLately}
          empty={t("rotation.none")}
          emptyHelp={t("rotation.noneHelp")}
        />
      </section>
      {hasRole(roles, "editor") && <Misses />}
    </div>
  );
}

/**
 * For editors and owners: what people looked for in the search box and didn't find, in
 * the last 90 days; a tap starts the song with that title.
 */
function Misses() {
  const { t, i18n } = useTranslation();
  const { slug } = useCommunity();
  const { data, failed, retry } = useJson<Miss[]>(
    `/api/communities/${slug}/search-misses`,
    useChanges(slug, "search_misses", "songs", "song_versions"),
  );
  const now = new Date();
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold">{t("misses.title")}</h3>
      <p className="text-sm text-muted">{t("misses.help")}</p>
      {data === undefined ? (
        failed ? (
          <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
        ) : (
          <Placeholder lines={3} />
        )
      ) : !data?.length ? (
        <Empty title={t("misses.none")} description={t("misses.noneHelp")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((miss) => (
            <li key={miss.query} className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{miss.query}</span>
              <span className="text-sm text-muted">
                {t("misses.times", {
                  count: miss.times,
                  last: relativeTime(miss.last, now, i18n.language),
                })}
              </span>
              <Link
                href={`/songs/new?title=${encodeURIComponent(miss.query)}`}
                className="link text-sm"
              >
                <Plus />
                {t("misses.newSong")}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The last services as a table: a column per day, a row per song, a mark where sung. */
function Grid({ grid }: { grid: ServicesGrid }) {
  const { t, i18n } = useTranslation();
  const { languages } = useCommunity();
  // The newest services in view first, where the table is wider than the page.
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = scroller.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [grid]);
  if (grid.songs.length === 0)
    return (
      <Empty
        title={t("statistics.noServices")}
        description={t("grid.emptyHelp")}
      />
    );
  // The day as it was in UTC, where it's kept.
  const day = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString(i18n.language, {
      day: "numeric",
      month: "short",
    });
  return (
    // Sideways on a phone, the titles staying in view, the days fading out under them
    // rather than cut.
    <div ref={scroller} className="overflow-x-auto">
      <table className="text-sm">
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky start-0 bg-background pe-3 text-start font-medium shadow-[14px_0_10px_-4px_var(--background)]"
            >
              {t("grid.song")}
            </th>
            {grid.days.map((d) => (
              <th
                key={d}
                scope="col"
                className="px-1 font-normal whitespace-nowrap text-muted"
              >
                {day(d)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.songs.map((song) => (
            <tr key={song.id} className="border-t border-separator">
              <th
                scope="row"
                className="sticky start-0 max-w-56 truncate bg-background py-1 pe-3 text-start font-normal shadow-[14px_0_10px_-4px_var(--background)]"
              >
                <Link href={`/songs/${song.id}`} className="link">
                  {titleFor(song.titles, [i18n.language, ...languages])}
                </Link>
              </th>
              {grid.days.map((d) => (
                <td key={d} className="px-1 text-center">
                  {song.sung.includes(d) && (
                    <span
                      role="img"
                      aria-label={t("grid.sung")}
                      className="inline-block size-3 rounded-full bg-accent"
                    />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A year's services, songs, and the songs first sung that year. */
function Recap({ year, recap }: { year: string; recap: YearRecap }) {
  const { t, i18n } = useTranslation();
  const { languages } = useCommunity();
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, {
      day: "numeric",
      month: "long",
    });
  return (
    <section
      aria-label={t("recap.title", { year })}
      className="flex flex-col gap-3 rounded-xl border border-separator p-4"
    >
      <h4 className="font-semibold">{t("recap.title", { year })}</h4>
      <p className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
        <span>{t("statistics.services", { count: recap.services })}</span>
        <span>{t("recap.songs", { count: recap.songs })}</span>
        <span>{t("recap.new", { count: recap.newCount })}</span>
      </p>
      {recap.newSongs.length > 0 && (
        <ol className="flex flex-col gap-1 text-sm">
          {recap.newSongs.map((song) => (
            <li key={song.id} className="flex items-baseline gap-3">
              <span className="w-28 shrink-0 text-muted">
                {date(song.first)}
              </span>
              <Link
                href={`/songs/${song.id}`}
                className="link min-w-0 truncate"
              >
                {titleFor(song.titles, [i18n.language, ...languages])}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function SongList({
  songs,
  replays = false,
  empty,
  emptyHelp,
}: {
  /** With how many services, or in how many of the last ones. */
  songs: (SongResult & { services?: number; replay?: string | null })[];
  /** A link to each song's latest service in its stream. */
  replays?: boolean;
  empty: string;
  emptyHelp: string;
}) {
  const { t, i18n } = useTranslation();
  const { languages } = useCommunity();
  if (songs.length === 0)
    return <Empty title={empty} description={emptyHelp} />;
  return (
    // Narrow enough that a count stays near its title on a laptop.
    <ol className="flex max-w-2xl flex-col divide-y divide-separator">
      {songs.map((song, i) => (
        <li key={song.id} className="flex items-baseline gap-3 py-2">
          <span className="w-6 shrink-0 text-end text-sm text-muted tabular-nums">
            {i + 1}
          </span>
          <Link
            href={`/songs/${song.id}`}
            className="link min-w-0 flex-1 truncate"
          >
            {titleFor(song.titles, [i18n.language, ...languages])}
          </Link>
          <span className="shrink-0 text-sm tabular-nums">
            {song.recent
              ? t("rotation.ofLast", {
                  count: song.recent.services,
                  of: song.recent.of,
                })
              : t("statistics.services", { count: song.services ?? 0 })}
          </span>
          {replays && (
            // Its own cell, empty without a stream, so the columns stay aligned.
            <span className="flex w-6 shrink-0 justify-center self-center">
              {song.replay && (
                <a
                  href={song.replay}
                  target="_blank"
                  rel="noreferrer"
                  className="link"
                  aria-label={t("replays.latest", {
                    title: titleFor(song.titles, [i18n.language, ...languages]),
                  })}
                >
                  <CirclePlay />
                </a>
              )}
            </span>
          )}
          <span className="hidden w-32 shrink-0 text-end text-sm text-muted sm:block">
            {song.lastPlayedAt &&
              relativeTime(song.lastPlayedAt, new Date(), i18n.language)}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** On a song's page, for members: the services it was sung in, first, last and per year. */
export function SongPlaysSummary({ songId }: { songId: string }) {
  const { t, i18n } = useTranslation();
  const { slug } = useCommunity();
  const member = useIsMember(slug);
  const { data } = useJson<SongPlays>(
    member
      ? `/api/communities/${slug}/songs/${encodeURIComponent(songId)}/plays`
      : null,
    useChanges(slug, "plays"),
  );
  if (!member) return null;
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { dateStyle: "long" });
  return (
    // Two lines tall while it loads, so the page below doesn't move.
    <section
      aria-label={t("statistics.songHistory")}
      className="flex min-h-[calc(2lh+0.25rem)] flex-col gap-1 text-sm"
    >
      {data &&
        (data.services === 0 || !data.first || !data.last ? (
          <p className="text-muted">{t("statistics.neverSung")}</p>
        ) : (
          <>
            <p className="flex items-center gap-2">
              <ChartColumn className="size-4" />
              {t("statistics.sungIn", {
                count: data.services,
                first: date(data.first),
                last: relativeTime(data.last, new Date(), i18n.language),
              })}
            </p>
            <p className="text-muted tabular-nums">
              {data.years
                .map(({ year, services }) =>
                  t("statistics.year", { year, count: services }),
                )
                .join(" · ")}
            </p>
          </>
        ))}
    </section>
  );
}
