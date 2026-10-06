import { ChevronLeft, ChevronRight } from "lucide-react";
import { TempoHint } from "./TempoListener";
import { RecordingMark } from "./Recorder";
import { Button } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { type Profile } from "./instrument-layouts";
import { StageNotice, StageSlides } from "./parts";
import { guitarShapes } from "../../shared/preferences";
import { sendLive, useLiveView } from "../data/room";
import { useLookAhead } from "./LookAhead";
import { Song } from "./MusiciansSong";

/**
 * What musicians need of the live song: the key and time signature, and its chords as a
 * grid of bars per part or over the words of the live part. A song without chords shows
 * its lyrics, key and structure, and asks for chords.
 */
export function Musicians({
  slug,
  languages,
  layout,
  canControl,
  canEdit = false,
  profile = {
    plays: [],
    shapes: guitarShapes,
    naming: "letters",
    colors: false,
  },
  lookAhead = false,
  wheel = false,
  leader = false,
}: {
  slug: string;
  languages: string[];
  layout: string;
  /** The circle of fifths with the live chord, when it's switched on. */
  wheel?: boolean;
  /** Who leads the song, when Led by is switched on. */
  leader?: boolean;
  canControl: boolean;
  canEdit?: boolean;
  /** Who reads it: a screen has none, so letters and every note. */
  profile?: Profile;
  /** On a member's own device: earlier and later songs, privately. */
  lookAhead?: boolean;
}) {
  const { t } = useTranslation();
  const live = useLiveView(slug);
  const ahead = useLookAhead(slug, lookAhead ? live : undefined, languages);
  const view = lookAhead ? ahead.shown : live;
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <StageNotice message={view?.message} />
      {lookAhead && ahead.bar}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="flex flex-wrap gap-x-4">
          <RecordingMark view={view} />
          <TempoHint view={view} />
        </div>
        {view?.entry?.kind === "slides" ? (
          <StageSlides view={view} languages={languages} />
        ) : view?.song ? (
          <Song
            slug={slug}
            wheel={wheel}
            leader={leader}
            profile={profile}
            view={view}
            song={view.song}
            languages={languages}
            layout={layout}
            chordsLink={
              canEdit
                ? (language) =>
                    `~/${slug}/songs/${view.song?.id ?? ""}/chords?language=${language}`
                : undefined
            }
            onPart={
              canControl && !ahead.looking && view.entry
                ? (slide) =>
                    void sendLive(
                      slug,
                      { type: "go", entryId: view.entryId ?? "", slide },
                      "part",
                    )
                : undefined
            }
          />
        ) : (
          <p className="text-muted">{t("musicians.noSong")}</p>
        )}
      </div>
      {canControl && (
        <div className="grid grid-cols-2 gap-2 border-t border-separator p-2">
          <Button
            size="lg"
            fullWidth
            variant="secondary"
            onPress={() => void sendLive(slug, { type: "previous" }, "button")}
          >
            <ChevronLeft />
            {t("live.previous")}
          </Button>
          <Button
            size="lg"
            fullWidth
            onPress={() => void sendLive(slug, { type: "next" }, "button")}
          >
            {t("live.next")}
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}
