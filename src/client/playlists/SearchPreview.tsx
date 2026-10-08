import { Chip } from "@heroui/react";
import { useContext, useEffect, useState } from "react";
import { ComboBoxStateContext } from "react-aria-components";
import { useTranslation } from "react-i18next";
import type { Song } from "../../server/songs/songs";
import { useCommunity } from "../data/community";
import { useJson } from "../data/fetch";
import { SongText } from "../songs/SongText";
import { Placeholder } from "../ui/states";

/**
 * Beside the search's results on a wide window: the highlighted
 * song's words, in the viewer's language if the song has it, to check it's the right one;
 * steady while the pointer runs over the results.
 */
export default function SearchPreview({
  songs,
  className,
}: {
  songs: string[];
  className: string;
}) {
  const { i18n } = useTranslation();
  const community = useCommunity();
  const focused = useContext(ComboBoxStateContext)?.selectionManager.focusedKey;
  // The song once it stays highlighted for a moment, so a pointer running over the
  // results doesn't ask for each one.
  const [id, setId] = useState<string>();
  const highlighted = songs.find((song) => song === focused);
  useEffect(() => {
    const timer = setTimeout(() => setId(highlighted), 120);
    return () => clearTimeout(timer);
  }, [highlighted]);
  const { data } = useJson<Song>(
    id ? `/api/communities/${community.slug}/songs/${id}` : null,
  );
  // The last song shown stays until the next has loaded.
  const [song, setSong] = useState<Song>();
  if (data && data !== song) setSong(data);
  const version = [i18n.language, ...community.languages]
    .map((language) => song?.versions.find((v) => v.language === language))
    .find(Boolean);
  return (
    <section aria-label={version?.title} className={className}>
      {!highlighted && !id ? null : !song ? (
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
            <SongText text={version.text} marks />
          </div>
        )
      )}
    </section>
  );
}
