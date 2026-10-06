import { Radio } from "lucide-react";
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
  const song = useJson<Song>(
    entry?.song
      ? `/api/communities/${community.slug}/songs/${entry.song.id}`
      : null,
    useChanges(community.slug, "songs", "song_versions"),
  ).data;

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
      role="list"
      aria-label={t("live.slides")}
      className="flex flex-col gap-2"
    >
      {slides.map((slide, i) => (
        <SlideCard
          key={i}
          label={partName(slide, labels[i] ?? "")}
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
  lines,
  isLive,
  italic = false,
  onPress,
}: {
  label: string;
  lines: string[];
  isLive: boolean;
  italic?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <>
      <CardLabel label={label} isLive={isLive} />
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
  const look = `flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-start ${
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
  isLive,
}: {
  label: string;
  isLive: boolean;
}) {
  const { t } = useTranslation();
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
