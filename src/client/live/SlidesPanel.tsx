import { Radio } from "lucide-react";
import { type RefObject, useEffect, useRef } from "react";
import { Button } from "react-aria-components";
import { useTranslation } from "react-i18next";
import type { Entry } from "../../server/playlists/playlists";
import type { Song } from "../../server/songs/songs";
import { formatReference } from "../../shared/bible";
import { formatLines } from "../../shared/song-render";
import { parseSong, partLabels } from "../../shared/song-text";
import { useCommunity } from "../data/community";
import { useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { usePartName } from "../stage/parts";
import { Segments } from "../songs/SongText";
import { Placeholder } from "../ui/states";
import { PageThumbs } from "./PageThumbs";

/**
 * The selected entry's slides, in the viewer's language; for the team each one sends its
 * slide live. `live` is the slide on the screens when this entry is live.
 */
/**
 * The live card of `list` scrolls into view when another goes live, as little as it takes,
 * so following a song on a phone needs no scrolling; again once `loaded` changes, as the
 * song before's last part goes live before its words arrive.
 */
export function useLiveInView(
  list: RefObject<HTMLElement | null>,
  live: number | null,
  loaded: unknown,
) {
  useEffect(() => {
    list.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [list, live, loaded]);
}

export function SlidesPanel({
  entry,
  live,
  onGo,
}: {
  entry: Entry | null;
  live: number | null;
  onGo?: (entryId: string, slide: number) => void;
}) {
  const { t, i18n } = useTranslation();
  const community = useCommunity();
  const partName = usePartName();
  const list = useRef<HTMLDivElement>(null);
  const song = useJson<Song>(
    entry?.song
      ? `/api/communities/${community.slug}/songs/${entry.song.id}`
      : null,
    useChanges(community.slug, "songs", "song_versions"),
  ).data;
  useLiveInView(list, live, song?.id ?? entry?.id);

  if (!entry || entry.kind === "divider") return null;
  if (entry.kind === "slides")
    return (
      <PageThumbs
        entry={entry}
        live={live}
        onGo={onGo && ((slide) => onGo(entry.id, slide))}
      />
    );
  if (!entry.song) {
    const text = entry.bible
      ? formatReference(entry.bible, i18n.language)
      : (entry.text ?? "");
    return (
      <div className="flex flex-col gap-2">
        <SlideCard
          label={t(entry.bible ? "live.bible" : "live.text")}
          lines={text.split("\n")}
          isLive={live === 0}
          onPress={onGo && (() => onGo(entry.id, 0))}
        />
      </div>
    );
  }
  if (song === undefined || (song && song.id !== entry.song.id))
    return <Placeholder lines={6} />;
  if (song === null) return null;
  const version =
    [i18n.language, ...community.languages]
      .map((l) => song.versions.find((v) => v.language === l))
      .find(Boolean) ?? song.versions[0];
  const slides = version ? parseSong(version.text).slides : [];
  const labels = partLabels(slides);

  return (
    <div
      ref={list}
      role="list"
      aria-label={t("live.slides")}
      className="flex flex-col gap-2"
    >
      {slides.map((slide, i) => (
        <SlideCard
          key={i}
          label={partName(slide, labels[i] ?? "")}
          mark={labels[i] ?? ""}
          lines={slide.lines.filter((l) => !l.chordsOnly).map((l) => l.text)}
          isLive={live === i}
          italic={slide.type === "refrain"}
          onPress={onGo && (() => onGo(entry.id, i))}
        />
      ))}
    </div>
  );
}

function SlideCard({
  label,
  mark,
  lines,
  isLive,
  italic = false,
  onPress,
}: {
  label: string;
  /** For a song's parts: its mark instead of the label (CardLabel). */
  mark?: string;
  lines: string[];
  isLive: boolean;
  italic?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <>
      <CardLabel label={label} mark={mark} isLive={isLive} />
      <span className={italic ? "italic" : undefined}>
        {formatLines(lines).map((segments, i) => (
          <span key={i} className="block min-h-[1.2em] whitespace-pre-wrap">
            <Segments segments={segments} />
          </span>
        ))}
      </span>
    </>
  );
  // A frame in the live color, as wide as the plain one, so nothing moves.
  const look = `block rounded-xl border-2 p-3 text-start ${
    isLive ? "border-live" : "border-separator"
  }`;
  return (
    <div role="listitem">
      {onPress ? (
        <Button
          className={`${look} w-full cursor-pointer outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus data-[focus-visible]:ring-inset data-[hovered]:bg-default`}
          aria-current={isLive || undefined}
          onPress={onPress}
        >
          {body}
        </Button>
      ) : (
        <div className={look} aria-current={isLive || undefined}>
          {body}
        </div>
      )}
    </div>
  );
}

/**
 * A slide card's label, and while it's live a Live tag at its other end, so color isn't
 * the only mark; hidden, not gone, so nothing moves.
 */
export function CardLabel({
  label,
  mark,
  isLive,
}: {
  label: string;
  /** A song's part as the song map writes it (1, 2, R): faint in the corner, instead of
   * the label, which is only read out. */
  mark?: string;
  isLive: boolean;
}) {
  const { t } = useTranslation();
  if (mark !== undefined)
    return (
      // Floated, so only the first lines make room for it.
      <span className="float-end ms-3 flex items-center gap-2 text-xs font-semibold">
        <span className="sr-only">{label}</span>
        <span
          className={`flex items-center gap-1 ${isLive ? "" : "invisible"}`}
        >
          <Radio className="size-3.5 text-live" />
          {t("live.live")}
        </span>
        {/* Drawn from an attribute: it's a shadow of the label, not text to read. */}
        <span
          aria-hidden
          data-mark={mark}
          className="text-3xl leading-none font-bold text-muted opacity-40 after:content-[attr(data-mark)]"
        />
      </span>
    );
  return (
    <span className="flex w-full items-center justify-between gap-2 text-xs font-semibold">
      <span className="text-muted">{label}</span>
      <span className={`flex items-center gap-1 ${isLive ? "" : "invisible"}`}>
        <Radio className="size-3.5 text-live" />
        {t("live.live")}
      </span>
    </span>
  );
}
