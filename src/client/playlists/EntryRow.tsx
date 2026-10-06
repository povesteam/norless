import { Button, Chip, Link as HeroLink } from "@heroui/react";
import { Ellipsis, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Entry } from "../../server/playlists/playlists";
import type { Problem } from "../../server/playlists/problems";
import { bibleLink, formatReference } from "../../shared/bible";
import { titleFor } from "../../shared/song-render";
import { keyOf } from "../../shared/music/chords";
import { useKeyChange } from "../songs/KeyDialog";
import { LedByIcon } from "./LedBy";
import { useCommunity, useShows } from "../data/community";
import { EntryIcon } from "../ui/icons";
import { EntryProblems } from "./problems";
import { useDuration } from "./TextEntryEditor";
import { SlidesChips, SlidesThumb } from "./SlideFiles";

/** The plain title of an entry, for typing to find it and for screen readers. */
export const entryTitle = (entry: Entry, languages: string[]) =>
  entry.song
    ? titleFor(entry.song.titles, languages)
    : entry.bible
      ? formatReference(entry.bible, languages[0] ?? "en")
      : firstLine(entry.text ?? "");

/** A text slide's first line, without Markdown's heading marks. */
const firstLine = (text: string) =>
  (text.split("\n")[0] ?? "").replace(/^#+\s*/, "");

export function EntryRow({
  entry,
  ledBy,
  keyBefore,
  problems,
  isLive,
  onOpen,
  onDoubleClick,
  movingBy,
  onMenu,
  menuButton = false,
  passed = false,
}: {
  entry: Entry;
  /** Who leads it. */
  ledBy?: string | null;
  /** The key of the song before it, when it's another one. */
  keyBefore?: string | null;
  problems: Problem[];
  /** On the screens now. */
  isLive: boolean;
  /** A click or tap on the entry. */
  onOpen: () => void;
  onDoubleClick?: () => void;
  /** Who else is dragging it right now. */
  movingBy?: string;
  /** Opens its actions at a point: the pointer's, for a right-click. */
  onMenu?: (x: number, y: number) => void;
  /** Before the live entry, or the live one while blank: muted. */
  passed?: boolean;
  /** On touch screens, a "⋯" button opens them instead of a right-click. */
  menuButton?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const community = useCommunity();
  const shows = useShows();
  const duration = useDuration();
  const keyChange = useKeyChange();
  const languages = [i18n.language, ...community.languages];
  const { song, bible } = entry;
  const link =
    bible &&
    (bibleLink(
      bible,
      i18n.language,
      community.bibleVersions?.[i18n.language],
    ) ??
      bibleLink(
        bible,
        community.languages[0] ?? "ro",
        community.bibleVersions?.[community.languages[0] ?? "ro"],
      ));

  // Fixed heights, as in the old app: a song's title with its details below, the rest one
  // line, so nothing a row shows makes it grow.
  const details = [
    movingBy && (
      <Chip key="moving" size="sm" color="warning" variant="soft">
        {t("playlist.movingBy", { name: movingBy })}
      </Chip>
    ),
    song?.deleted && (
      <Chip key="deleted" size="sm" color="danger" variant="soft">
        {t("playlist.songDeleted")}
      </Chip>
    ),
    // Before the key and tags, so the line's fade never cuts it.
    song?.playedRecently && (
      <Chip key="played" size="sm" color="success" variant="soft">
        {t("playlist.playedRecently")}
      </Chip>
    ),
    ledBy && (
      <Chip key="led-by" size="sm" variant="soft">
        <LedByIcon aria-hidden className="size-3" />
        {t("team.ledBy", { name: ledBy })}
      </Chip>
    ),
    (entry.keySignature || song?.keySignature) && (
      <Chip key="key" size="sm" variant="secondary">
        {entry.keySignature && song
          ? t("keys.serviceChip", {
              key: entry.keySignature,
              song: song.keySignature || "?",
            })
          : song?.keySignature}
      </Chip>
    ),
    keyBefore && (
      <span key="change" className="text-xs text-muted">
        {t("keys.fromBefore", {
          from: keyBefore,
          to: entry.keySignature || song?.keySignature,
          change: keyChange(
            keyOf(keyBefore),
            keyOf(entry.keySignature || song?.keySignature || ""),
          ),
        })}
      </span>
    ),
    song?.timeSignature && (
      <Chip key="time" size="sm" variant="secondary">
        {song.timeSignature}
      </Chip>
    ),
    ...(song?.tags.map((tag) => (
      <Chip key={`tag-${tag}`} size="sm" variant="soft">
        {tag}
      </Chip>
    )) ?? []),
    entry.plannedMinutes && shows("times") && (
      <Chip key="minutes" size="sm" variant="secondary">
        {duration(entry.plannedMinutes)}
      </Chip>
    ),
    // Its first page small, at the start of its details, so titles stay in line.
    entry.kind === "slides" && <SlidesThumb key="thumb" entry={entry} />,
    entry.kind === "slides" && <SlidesChips key="slides" entry={entry} />,
  ].filter(Boolean);
  // Songs and slides take two lines: the title, and their details under it.
  const twoLines = !!song || entry.kind === "slides";
  return (
    <div
      data-entry={entry.id}
      data-passed={passed || undefined}
      onClick={(event) =>
        // Its buttons do their own thing.
        (event.target as Element).closest("button") ? undefined : onOpen()
      }
      onDoubleClick={onDoubleClick}
      onContextMenu={
        onMenu && !menuButton
          ? (event) => {
              event.preventDefault();
              onMenu(event.clientX, event.clientY);
            }
          : undefined
      }
      className={`flex items-center gap-3 px-3 ${
        twoLines
          ? "h-18"
          : entry.kind === "divider"
            ? "h-12 items-end pb-1.5"
            : "h-12"
      }`}
    >
      {entry.kind !== "divider" && (
        <EntryIcon kind={entry.kind} className="size-6 shrink-0 text-muted" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div
          className={`flex min-w-0 items-center gap-2 ${passed ? "text-muted" : ""}`}
        >
          {song ? (
            // Not a link: a click selects the row, and its slides show beside it.
            <span className="truncate">{titleFor(song.titles, languages)}</span>
          ) : bible ? (
            <span className="truncate">
              {formatReference(bible, i18n.language)}
            </span>
          ) : entry.kind === "divider" ? (
            <span className="truncate text-lg font-semibold">{entry.text}</span>
          ) : (
            <span className="truncate">{firstLine(entry.text ?? "")}</span>
          )}
          <EntryProblems problems={problems} />
          {isLive && <span className="sr-only">{t("live.live")}</span>}
          {link && (
            // A chip like the key and tags, so it doesn't read as the title's end.
            <Chip size="sm" variant="soft" className="shrink-0">
              <HeroLink
                href={link}
                target="_blank"
                rel="noreferrer"
                className="text-xs"
              >
                <ExternalLink className="size-3" />
                {t("playlist.onBibleCom")}
              </HeroLink>
            </Chip>
          )}
          {!twoLines && details}
        </div>
        {twoLines && (
          // One line, fading out at its end rather than cutting a chip in half.
          <div className="flex h-6 min-w-0 items-center gap-1 overflow-hidden mask-r-from-[calc(100%-2rem)] *:shrink-0">
            {details}
          </div>
        )}
      </div>
      {onMenu && menuButton && (
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          className="shrink-0"
          aria-label={t("playlist.actionsOf", {
            title: entryTitle(entry, languages),
          })}
          onPress={(event) => {
            const box = (event.target as Element).getBoundingClientRect();
            onMenu(box.right, box.bottom);
          }}
        >
          <Ellipsis />
        </Button>
      )}
    </div>
  );
}
