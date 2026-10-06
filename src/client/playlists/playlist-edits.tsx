import { Button } from "@heroui/react";
import { Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  Entry,
  EntryInput,
  Playlist,
} from "../../server/playlists/playlists";
import type { PlaylistActivity } from "../../shared/live";
import { useCommunity } from "../data/community";
import { send } from "../data/fetch";
import { markLocal } from "../ui/glide";
import { entryTitle } from "./EntryRow";

/** A new entry, and where it goes: after an entry, at the top for null, else at the end. */
export type NewEntry = EntryInput & { after?: string | null };

/**
 * The entries as shown, and the team's changes to them: each shows at once, then goes
 * to the server, and the playlist loads again.
 */
export function usePlaylistEdits(
  url: string,
  playlist: Playlist | null | undefined,
  reload: () => void,
  /** Others' drags, as they happen. */
  drags: PlaylistActivity["drags"],
  /** Selects an entry just added. */
  setSelected: (id: string) => void,
) {
  const { i18n } = useTranslation();
  const community = useCommunity();
  // A move shows at once; the next load replaces it.
  const [moved, setMoved] = useState<{ base: Playlist; order: string[] }>();
  const [failedChange, setFailedChange] = useState(false);
  // Entries removed here, gone at once; back, with a message, if the server says no.
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  // Entries added here, shown at once where they go until the playlist loaded again has
  // them; gone, with a message, if the server says no.
  const [adding, setAdding] = useState<
    { entry: Entry; id: string | null; after?: string | null }[]
  >([]);

  const arrived = (a: { id: string | null }) =>
    !!a.id && !!playlist?.entries.some((e) => e.id === a.id);
  const shown = [
    ...(playlist && moved?.base === playlist
      ? moved.order.flatMap((key) =>
          playlist.entries.filter((e) => e.id === key),
        )
      : (playlist?.entries ?? [])),
  ];
  for (const a of adding) {
    if (arrived(a)) continue;
    const after = shown.findIndex((e) => e.id === a.after);
    shown.splice(
      a.after === null ? 0 : after < 0 ? shown.length : after + 1,
      0,
      a.entry,
    );
  }
  const loaded = shown.filter((e) => !removed.has(e.id));
  // An entry someone else drags shows where it would land.
  const entries = drags.reduce((list, drag) => {
    const entry = list.find((e) => e.id === drag.entry);
    if (!entry) return list;
    const rest = list.filter((e) => e !== entry);
    rest.splice(drag.index, 0, entry);
    return rest;
  }, loaded);

  /** Sends a change, then loads the playlist again. */
  const change = async (
    method: "POST" | "PATCH" | "PUT" | "DELETE",
    path: string,
    body?: object,
  ) => {
    const response = await send(method, url + path, body);
    setFailedChange(!response?.ok);
    if (response?.ok) reload();
    return response?.ok ? response : null;
  };
  // This device's own changes snap into place; others' glide (useGlide).
  const quiet = useRef(0);
  /**
   * Adds an entry, at the end or `after` one (null: at the top); `shown` is how it looks,
   * to show it before the server answers. Gives its id, once added.
   */
  const add = async (entry: NewEntry, shown?: Entry) => {
    const added = shown && {
      entry: shown,
      id: null as string | null,
      after: entry.after,
    };
    markLocal(quiet);
    if (added) setAdding((list) => [...list.filter((a) => !arrived(a)), added]);
    const response = await change("POST", "/entries", entry);
    if (!response) {
      if (added) setAdding((list) => list.filter((a) => a !== added));
      return;
    }
    const { id } = (await response.json()) as { id: string };
    if (added)
      setAdding((list) => list.map((a) => (a === added ? { ...a, id } : a)));
    setSelected(id);
    return id;
  };
  const unhide = (entryId: string) =>
    setRemoved((ids) => {
      const back = new Set(ids);
      back.delete(entryId);
      return back;
    });
  // What was just removed, for a few seconds' Undo.
  const [undo, setUndo] = useState<{ id: string; title: string } | null>(null);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 5000);
    return () => clearTimeout(timer);
  }, [undo]);
  const remove = async (entryId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    markLocal(quiet);
    setRemoved((ids) => new Set(ids).add(entryId));
    if (await change("DELETE", `/entries/${entryId}`)) {
      if (entry)
        setUndo({
          id: entryId,
          title: entryTitle(entry, [i18n.language, ...community.languages]),
        });
      return;
    }
    unhide(entryId);
  };
  const restore = async (entryId: string) => {
    setUndo(null);
    if (await change("POST", `/entries/${entryId}/restore`)) unhide(entryId);
  };
  /** Moves the entry at `from` to `to`, both positions in the list as shown. */
  const move = (from: number, to: number) => {
    const entry = entries[from];
    if (!playlist || !entry || to < 0 || to >= entries.length || to === from)
      return;
    const order = entries.map((e) => e.id).filter((key) => key !== entry.id);
    order.splice(to, 0, entry.id);
    markLocal(quiet);
    setMoved({ base: playlist, order });
    void change("POST", `/entries/${entry.id}/move`, {
      after: to === 0 ? null : order[to - 1],
    });
  };

  return {
    entries,
    failedChange,
    change,
    quiet,
    add,
    remove,
    restore,
    move,
    undo,
  };
}

/** The message for what was just removed, with its Undo. */
export function UndoToast({
  title,
  onUndo,
}: {
  title: string;
  onUndo: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-24 z-30 mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-xl bg-foreground px-4 py-2 text-background shadow-lg"
    >
      <span className="truncate">{t("playlist.removed", { title })}</span>
      <Button size="sm" variant="secondary" onPress={onUndo}>
        <Undo2 />
        {t("playlist.undo")}
      </Button>
    </div>
  );
}
