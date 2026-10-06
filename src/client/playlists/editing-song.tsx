import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useSearch } from "wouter";
import { SongEditor, SongEditPage } from "../songs/SongEditor";

/**
 * The song open in the editor beside the playlist: one of its songs, or a new one.
 * During a service, a song opens in the editor in place of the parts, so the preview
 * and the controls stay in view; closed, the parts load again (`songsSaved`).
 */
export function useEditingSong(
  playlistId: string,
  /** A new song's language. */
  language: string,
  /** Adds a new song, once saved, to the playlist. */
  addSong: (songId: string) => void,
) {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [editingSong, setEditingSong] = useState<string | null>(null);
  // A new song's title, typed in the search box.
  const [newTitle, setNewTitle] = useState("");
  const [songsSaved, setSongsSaved] = useState(0);
  // The Classic menu's "Create new song" opens an empty song in the editor.
  const newSong = new URLSearchParams(useSearch()).has("new-song");
  if (newSong && editingSong !== "new") {
    setEditingSong("new");
    setNewTitle("");
  }
  useEffect(() => {
    if (newSong) navigate(`/playlists/${playlistId}`, { replace: true });
  }, [newSong, playlistId, navigate]);

  const closeEditor = () => {
    setEditingSong(null);
    setSongsSaved((n) => n + 1);
  };
  const songEditor =
    editingSong === "new" ? (
      <SongEditor
        key={newTitle}
        song={null}
        onClose={closeEditor}
        title={newTitle ? { language, text: newTitle } : undefined}
        onCreated={{ label: t("editor.saveAndAdd"), run: addSong }}
      />
    ) : (
      editingSong && (
        <SongEditPage
          key={editingSong}
          id={editingSong}
          onClose={closeEditor}
        />
      )
    );
  /** Opens a new song in the editor, with the title typed. */
  const editNew = (title: string) => {
    setNewTitle(title);
    setEditingSong("new");
  };
  return { editingSong, setEditingSong, songsSaved, songEditor, editNew };
}
