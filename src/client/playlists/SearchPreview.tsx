import { Chip } from "@heroui/react";
import { useContext } from "react";
import { ComboBoxStateContext } from "react-aria-components";
import { useTranslation } from "react-i18next";
import type { Song } from "../../server/songs/songs";
import { useCommunity } from "../data/community";
import { useJson } from "../data/fetch";
import { SongText } from "../songs/SongText";
import { Placeholder } from "../ui/states";

/**
 * Beside the search's results on a wide window: the highlighted
 * song's words, in the viewer's language if the song has it, to check it's the right one.
 */
export default function SearchPreview({ songs }: { songs: string[] }) {
  const { i18n } = useTranslation();
  const community = useCommunity();
  const focused = useContext(ComboBoxStateContext)?.selectionManager.focusedKey;
  const id = songs.find((song) => song === focused);
  const { data: song } = useJson<Song>(
    id ? `/api/communities/${community.slug}/songs/${id}` : null,
  );
  const version = [i18n.language, ...community.languages]
    .map((language) => song?.versions.find((v) => v.language === language))
    .find(Boolean);
  return (
    <section
      aria-label={version?.title}
      className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-separator p-4"
    >
      {!id ? null : song?.id !== id ? (
        <Placeholder lines={6} />
      ) : (
        version && (
          <div className="flex flex-col gap-4">
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              {version.title}
              {song.keySignature && (
                <Chip size="sm" variant="secondary">
                  {song.keySignature}
                </Chip>
              )}
            </h2>
            <SongText text={version.text} />
          </div>
        )
      )}
    </section>
  );
}
