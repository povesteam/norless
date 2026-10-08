import { Pencil } from "lucide-react";
import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { GoLive } from "./GoLive";
import { NameAvatar } from "../ui/NameAvatar";
import { useRef, useState } from "react";
import { Button as AriaButton } from "react-aria-components";
import { useTranslation } from "react-i18next";
import type { LiveView } from "../../server/live/live-view";
import type { Entry } from "../../server/playlists/playlists";
import type { Song } from "../../server/songs/songs";
import { formatReference } from "../../shared/bible";
import { parseSong, partLabels, type Slide } from "../../shared/song-text";
import { useCommunity } from "../data/community";
import { useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { LanguageMark } from "../ui/icons";
import { usePartName } from "../stage/parts";
import { SlideText } from "../screens/Projector";
import { sendLive } from "../data/room";
import { Placeholder } from "../ui/states";
import { PageThumbs } from "./PageThumbs";
import { CardLabel, useLiveInView } from "./SlidesPanel";

/** A song's slides in each of the community's languages, by slide number. */
export function useSongSlides(songId: string | null | undefined) {
  const community = useCommunity();
  const song = useJson<Song>(
    songId ? `/api/communities/${community.slug}/songs/${songId}` : null,
    useChanges(community.slug, "songs", "song_versions"),
  ).data;
  if (!song || song.id !== songId) return null;
  const versions = community.languages
    .map((l) => song.versions.find((v) => v.language === l))
    .filter((v) => v !== undefined);
  return versions.map((v) => ({
    language: v.language,
    slides: parseSong(v.text).slides,
  }));
}

/**
 * An entry's parts in full, each language side by side, the live one marked. A click
 * or tap sends a part live; `big` makes cards for touch.
 */
export function EntryParts({
  entry,
  view,
  big = false,
  onEditSong,
  canGo = false,
  oneLanguage = false,
}: {
  entry: Entry | null;
  view: LiveView | undefined;
  big?: boolean;
  /** For editors: opens the song in the editor, in place of the parts. */
  onEditSong?: (songId: string) => void;
  /** For the team: Go live above the parts; a tap on an entry only selects it. */
  canGo?: boolean;
  /** On a phone: one language at a time, chosen above the parts. */
  oneLanguage?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const community = useCommunity();
  const partName = usePartName();
  const versions = useSongSlides(entry?.song?.id);
  const [chosen, choose] = useSongLanguage();
  const list = useRef<HTMLDivElement>(null);
  useLiveInView(
    list,
    entry && view?.entryId === entry.id && !view.blank ? view.slide : null,
    versions && entry?.song?.id,
  );
  if (!entry || (entry.kind === "divider" && entry.plannedMinutes === null))
    return null;
  const go = (slide: number) =>
    void sendLive(
      community.slug,
      { type: "go", entryId: entry.id, slide },
      "part",
    );
  const liveSlide =
    view?.entryId === entry.id && !view.blank ? view.slide : null;
  const goLive = canGo && !entry.song?.deleted && (
    <GoLive isLive={view?.entryId === entry.id} onGo={() => go(0)} />
  );
  // For members, above the parts: who added it, as their photo, as in Classic.
  const addedBy = entry.addedBy && (
    <span className="min-w-0 flex-1">
      <NameAvatar
        name={entry.addedBy}
        avatar={entry.addedByAvatar}
        label={t("playlist.addedBy", { name: entry.addedBy })}
      />
    </span>
  );

  if (entry.kind === "slides")
    return (
      <div className="flex flex-col gap-2">
        {(addedBy || goLive) && (
          <div className="flex items-center gap-2">
            {addedBy || <span className="flex-1" />}
            {goLive}
          </div>
        )}
        <PageThumbs entry={entry} live={liveSlide} onGo={go} />
      </div>
    );
  if (!entry.song)
    return (
      <div className="flex flex-col gap-2">
        {(addedBy || goLive) && (
          <div className="flex items-center gap-2">
            {addedBy || <span className="flex-1" />}
            {goLive}
          </div>
        )}
        <PartCard isLive={liveSlide === 0} big={big} onPress={() => go(0)}>
          <CardLabel
            label={t(entry.bible ? "live.bible" : "live.text")}
            isLive={liveSlide === 0}
          />
          <span className="whitespace-pre-line">
            {entry.bible
              ? formatReference(entry.bible, i18n.language)
              : (entry.text ?? "")}
          </span>
        </PartCard>
      </div>
    );
  if (!versions) return <Placeholder lines={6} />;
  // The chosen language, else the interface's, else the community's first.
  const language = [chosen, i18n.language].find((l) =>
    versions.some((v) => v.language === l),
  );
  const shown =
    oneLanguage && versions.length > 1
      ? versions.filter(
          (v) => v.language === (language ?? versions[0]?.language),
        )
      : versions;
  const [main] = shown;
  const slides = main?.slides ?? [];
  const labels = partLabels(slides);
  const languageChoice = shown.length < versions.length && (
    <ToggleButtonGroup
      aria-label={t("song.language")}
      selectionMode="single"
      disallowEmptySelection
      size="sm"
      selectedKeys={[main?.language ?? ""]}
      onSelectionChange={(keys) => {
        const [key] = keys;
        if (key !== undefined) choose(String(key));
      }}
    >
      {versions.map((v, i) => (
        <ToggleButton key={v.language} id={v.language}>
          {i > 0 && <ToggleButtonGroup.Separator />}
          <LanguageMark language={v.language} />
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );

  const song = entry.song;
  return (
    <div className="flex flex-col gap-2">
      {(addedBy || onEditSong || goLive || languageChoice) && (
        <div className="flex items-center gap-2">
          {addedBy || <span className="flex-1" />}
          {languageChoice}
          {goLive}
          {onEditSong && (
            <Button
              size="sm"
              variant="ghost"
              onPress={() => onEditSong(song.id)}
            >
              <Pencil />
              {t("editor.editSong")}
            </Button>
          )}
        </div>
      )}
      <div
        ref={list}
        role="list"
        aria-label={t("live.slides")}
        className={big ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2"}
      >
        {slides.map((slide, i) => (
          <div role="listitem" key={i}>
            <PartCard isLive={liveSlide === i} big={big} onPress={() => go(i)}>
              <CardLabel
                label={partName(slide, labels[i] ?? "")}
                mark={labels[i] ?? ""}
                isLive={liveSlide === i}
              />
              <span
                className="grid w-full gap-4"
                style={{
                  gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))`,
                }}
              >
                {shown.map(({ language, slides: own }) => (
                  <span key={language} lang={language} className="min-w-0">
                    {own[i] && <PartText slide={own[i] as Slide} />}
                  </span>
                ))}
              </span>
            </PartCard>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The language a phone's Song view shows, kept on the device. */
function useSongLanguage() {
  const [language, setLanguage] = useState(() => {
    try {
      return localStorage.getItem(SONG_LANGUAGE);
    } catch {
      return null;
    }
  });
  const choose = (chosen: string) => {
    setLanguage(chosen);
    try {
      localStorage.setItem(SONG_LANGUAGE, chosen);
    } catch {
      // Chosen until the page reloads.
    }
  };
  return [language, choose] as const;
}
const SONG_LANGUAGE = "norless:songViewLanguage";

/** A part's words; for a part of chords only, such as an intro, its chords. */
function PartText({ slide }: { slide: Slide }) {
  if (slide.lines.some((l) => !l.chordsOnly))
    return <SlideText slide={slide} wrap />;
  return (
    <span className="font-mono text-sm text-muted">
      {slide.lines.flatMap((l) => l.chords.map((c) => c.name)).join("  ")}
    </span>
  );
}

function PartCard({
  isLive,
  big,
  onPress,
  children,
}: {
  isLive: boolean;
  big: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <AriaButton
      aria-current={isLive || undefined}
      onPress={onPress}
      // A block, so a part's mark floats to its corner (CardLabel).
      className={`block w-full cursor-pointer rounded-xl border-2 text-start outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus data-[focus-visible]:ring-inset data-[hovered]:bg-default ${
        big ? "p-4 text-lg" : "p-3"
      } ${isLive ? "border-live" : "border-separator"}`}
    >
      {children}
    </AriaButton>
  );
}
