import { Button } from "@heroui/react";
import { FilePlus, Heading } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import type { Entry } from "../../server/playlists/playlists";
import type { SearchResult } from "../../server/songs/search";
import { useShows } from "../data/community";
import { useDeviceType } from "../data/device";
import { Tip } from "../ui/tip";
import { type Command, SearchBox } from "./SearchBox";
import { SlidesButton } from "./SlideFiles";
import type { NewEntry } from "./playlist-edits";

/**
 * Above the entries: the team adds songs, Bible passages, dividers and text slides;
 * others find songs to open.
 */
export function PlaylistSearch({
  playlistId,
  canChange,
  canEditSongs,
  commands,
  add,
  onNewSong,
  onAddText,
  onAddDivider,
  onAddSlides,
  place,
}: {
  playlistId: string;
  canChange: boolean;
  canEditSongs: boolean;
  commands: Command[];
  /** Adds an entry; `shown` is how it looks, to show it before the server answers. */
  add: (entry: NewEntry, shown?: Entry) => Promise<unknown>;
  /** Opens a new song in the editor, with the title typed. */
  onNewSong: (title: string) => void;
  onAddText: () => void;
  onAddDivider: () => void;
  /** Uploads files as slides entries. */
  onAddSlides: (files: File[]) => Promise<unknown>;
  /** Where the next pick goes, after the + menu's Song. */
  place?: { after: string | null; label: string; onEnd: () => void };
}) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const shows = useShows();
  const phone = useDeviceType().deviceType === "phone";
  const pick = async (result: SearchResult) => {
    if (!canChange) {
      if (result.type === "song") navigate(`/songs/${result.id}`);
      return;
    }
    const at = place ? { after: place.after } : {};
    const shown = (entry: Partial<Entry> & Pick<Entry, "kind">): Entry => ({
      id: `adding-${Date.now()}`,
      song: null,
      bible: null,
      text: null,
      plannedMinutes: null,
      keySignature: null,
      ...entry,
    });
    if (result.type === "song")
      return add(
        { kind: "song", songId: result.id, ...at },
        shown({
          kind: "song",
          song: { ...result, deleted: false, playedRecently: false },
        }),
      );
    if (result.type === "bible") {
      const { book, chapter, from, to } = result;
      const bible = { book, chapter, from, to };
      return add(
        { kind: "bible", bible, ...at },
        shown({ kind: "bible", bible }),
      );
    }
    if (result.type === "divider")
      return add(
        { kind: "divider", text: result.text, ...at },
        shown({ kind: "divider", text: result.text }),
      );
    // A new song opens in the editor with its title; saved, it joins the playlist.
    onNewSong(result.title);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-60 flex-1">
        <SearchBox
          onPick={(result) => void pick(result)}
          commands={commands}
          playlistId={playlistId}
          place={place}
          // The empty box offers what else goes in a playlist.
          actions={
            canChange
              ? [
                  {
                    id: "divider",
                    label: t("playlist.addDivider"),
                    words: [],
                    icon: <Heading />,
                    run: onAddDivider,
                  },
                  ...(shows("textSlides")
                    ? [
                        {
                          id: "text",
                          label: t("playlist.addText"),
                          words: [],
                          icon: <FilePlus />,
                          run: onAddText,
                        },
                      ]
                    : []),
                ]
              : []
          }
          kinds={
            canChange
              ? [
                  "song",
                  "bible",
                  "divider",
                  ...(canEditSongs && shows("commands")
                    ? ["new-song" as const]
                    : []),
                ]
              : ["song"]
          }
        />
      </div>
      {canChange &&
        shows("textSlides") &&
        (phone ? (
          // Its icon beside the search box on a phone.
          <Tip label={t("playlist.addText")}>
            <Button
              isIconOnly
              variant="secondary"
              aria-label={t("playlist.addText")}
              onPress={onAddText}
            >
              <FilePlus />
            </Button>
          </Tip>
        ) : (
          <Button variant="secondary" onPress={onAddText}>
            <FilePlus />
            {t("playlist.addText")}
          </Button>
        ))}
      {canChange && shows("fileSlides") && (
        <SlidesButton onFiles={onAddSlides} />
      )}
    </div>
  );
}
