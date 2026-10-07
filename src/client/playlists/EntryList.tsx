import {
  CirclePlay,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  FilePlus,
  Heading,
  Music,
  Pencil,
  Trash2,
} from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  DropIndicator,
  type DropTarget,
  GridList,
  GridListItem,
  useDragAndDrop,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import type { Entry, Playlist } from "../../server/playlists/playlists";
import type { Problem } from "../../server/playlists/problems";
import { ServiceKeyDialog } from "../songs/KeyDialog";
import { LedByDialog, LedByIcon, leaderOf } from "./LedBy";
import { useCommunity, useShows } from "../data/community";
import { live } from "../data/connection";
import { usePlaylistReplays } from "../songs/Replays";
import { useDeviceType } from "../data/device";
import { HostWordsDialog } from "../live/Host";
import { HostIcon } from "../ui/icons";
import { ActionsMenu, type EntryAction } from "./EntryActions";
import { useGlide } from "../ui/glide";
import { Empty } from "../ui/states";
import { entryTitle, EntryRow } from "./EntryRow";
import { useSlideActions } from "./SlideFiles";
import { InsertLine } from "./InsertLine";

/** What can be added between two entries, or above one. */
export type Insert = "song" | "divider" | "text";

/** The entries in order: selectable on every device, and for the team, sortable and removable. */
export function EntryList({
  playlistId,
  entries,
  leads,
  movingBy,
  liveEntryId,
  liveBlank,
  problems,
  canChange,
  selected,
  onSelect,
  onOpen,
  onGo,
  onMove,
  quiet,
  onRemove,
  onEdit,
  onInsert,
  onEditSong,
}: {
  playlistId: string;
  entries: Entry[];
  /** Who leads its service's songs, for members. */
  leads?: Playlist["leads"];
  /** Entries others are dragging, with their names. */
  movingBy: Map<string, string>;
  /** The entry on the screens now, when it's from this playlist. */
  liveEntryId: string | null;
  /** The screens are blank: the live entry is done too. */
  liveBlank: boolean;
  problems: Problem[];
  canChange: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
  /** Sends an entry live, for the team: a double-click. */
  onOpen: (id: string) => void;
  onGo?: (id: string) => void;
  onMove: (from: number, to: number) => void;
  /** When this device last changed the entries, so its reorders snap instead of gliding. */
  quiet: React.RefObject<number>;
  onRemove: (id: string) => void;
  onEdit: (entry: Entry) => void;
  /** Asks for an entry to put after another one, or at the top for null. */
  onInsert: (what: Insert, after: string | null) => void;
  /** For editors: opens a song in the editor. */
  onEditSong?: (songId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const community = useCommunity();
  const shows = useShows();
  const languages = [i18n.language, ...community.languages];
  // With a mouse, a right-click menu; on touch screens, a "⋯" button on each row.
  const touch = useDeviceType().deviceType !== "laptop";
  const [menu, setMenu] = useState<{
    entry: Entry;
    x: number;
    y: number;
  } | null>(null);
  // The song entry whose key for this service is being set.
  const [keyEntry, setKeyEntry] = useState<Entry | null>(null);
  // The entry whose host's words are being written.
  const [hostEntry, setHostEntry] = useState<Entry | null>(null);
  // The song whose leader is being chosen.
  const [leadEntry, setLeadEntry] = useState<Entry | null>(null);
  // Each entry's moment in the service's stream.
  const replays = usePlaylistReplays(playlistId, shows("replays"));
  // A slides entry's file per language, timer and download.
  const slides = useSlideActions(
    `/api/communities/${community.slug}/playlists/${playlistId}`,
  );
  // Adding between rows: a song, a divider or a text slide.
  const between = shows("insertBetween");
  const inserts = (after: string | null, here: boolean): EntryAction[] => [
    ...(between
      ? [
          {
            id: "song-above",
            label: t(here ? "playlist.songHere" : "playlist.songAbove"),
            icon: <Music />,
            run: () => onInsert("song", after),
          },
        ]
      : []),
    {
      id: "divider",
      label: t(here ? "playlist.dividerHere" : "playlist.addDividerAbove"),
      icon: <Heading />,
      run: () => onInsert("divider", after),
    },
    ...(between && shows("textSlides")
      ? [
          {
            id: "text-above",
            label: t(here ? "playlist.textHere" : "playlist.textAbove"),
            icon: <FilePlus />,
            run: () => onInsert("text", after),
          },
        ]
      : []),
  ];
  /** What the team can do to an entry. */
  const actionsOf = (entry: Entry): EntryAction[] => {
    const index = entries.indexOf(entry);
    const song = entry.song;
    const editable =
      (shows("textSlides") &&
        (entry.kind === "divider" || entry.kind === "text")) ||
      entry.kind === "slides";
    return [
      ...(editable
        ? [
            {
              id: "edit",
              label: t("playlist.edit"),
              icon: <Pencil />,
              run: () => onEdit(entry),
            },
          ]
        : []),
      ...(entry.kind === "slides" ? slides.actionsOf(entry) : []),
      ...(song && !song.deleted && onEditSong
        ? [
            {
              id: "edit-song",
              label: t("editor.editSong"),
              icon: <Pencil />,
              run: () => onEditSong(song.id),
            },
          ]
        : []),
      ...(song && !song.deleted && shows("instruments")
        ? [
            {
              id: "key",
              label: t("keys.forService"),
              icon: <ArrowUpDown />,
              run: () => setKeyEntry(entry),
            },
          ]
        : []),
      ...(song && !song.deleted && shows("serviceRoles")
        ? [
            {
              id: "led-by",
              label: t("team.ledByMenu"),
              icon: <LedByIcon />,
              run: () => setLeadEntry(entry),
            },
          ]
        : []),
      ...(replays[entry.id]
        ? [
            {
              id: "replay",
              label: t("replays.watch"),
              icon: <CirclePlay />,
              run: () =>
                window.open(replays[entry.id], "_blank", "noopener,noreferrer"),
            },
          ]
        : []),
      ...(shows("host")
        ? [
            {
              id: "host",
              label: t("host.words"),
              icon: <HostIcon />,
              run: () => setHostEntry(entry),
            },
          ]
        : []),
      {
        id: "up",
        label: t("playlist.moveUp"),
        icon: <ArrowUp />,
        disabled: index === 0,
        run: () => onMove(index, index - 1),
      },
      {
        id: "down",
        label: t("playlist.moveDown"),
        icon: <ArrowDown />,
        disabled: index === entries.length - 1,
        run: () => onMove(index, index + 1),
      },
      ...inserts(entries[index - 1]?.id ?? null, false),
      {
        id: "remove",
        label: t("playlist.remove"),
        icon: <Trash2 />,
        danger: true,
        run: () => onRemove(entry.id),
      },
    ];
  };
  /** Where the dragged entry would land, counted without it, or null. */
  const landing = (key: unknown, target: DropTarget) => {
    if (target.type !== "item") return null;
    const from = entries.findIndex((e) => e.id === key);
    const at = entries.findIndex((e) => e.id === target.key);
    if (from < 0 || at < 0) return null;
    const without = at > from ? at - 1 : at;
    return target.dropPosition === "after" ? without + 1 : without;
  };
  // Others see the entry move while it's dragged, and every device sees rows glide.
  const [dragging, setDragging] = useState<string | null>(null);
  // With a mouse, the gap the pointer is near: the index of the row under it.
  const [gapAt, setGapAt] = useState<number | null>(null);
  const [insertMenu, setInsertMenu] = useState<{
    after: string;
    x: number;
    y: number;
  } | null>(null);
  const hovering = canChange && !touch && between && !dragging;
  // The + shows once the pointer rests on a gap for 300 ms, so passing over the rows
  // doesn't flicker it; it goes at once.
  const [restingAt, setRestingAt] = useState<number | null>(null);
  useEffect(() => {
    if (gapAt === null) return;
    const timer = setTimeout(() => setRestingAt(gapAt), 300);
    return () => clearTimeout(timer);
  }, [gapAt]);
  const shownGap = gapAt !== null && restingAt === gapAt ? gapAt : null;
  const pointAt = (gap: number | null) => {
    setGapAt(gap);
    if (gap === null) setRestingAt(null);
  };
  /** The gap within 10 pixels of the pointer, between two rows, if any. */
  const gapNear = (event: React.MouseEvent, index: number) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (event.clientY - box.top < 10 && index > 0) return index;
    if (box.bottom - event.clientY < 10 && index < entries.length - 1)
      return index + 1;
    return null;
  };
  const [gap, setGap] = useState(0);
  const list = useRef<HTMLDivElement>(null);
  useGlide(list, quiet);
  const tellOthers = (entry: string, index: number | null) =>
    live.send({ type: "dragging", playlist: playlistId, entry, index });
  const { dragAndDropHooks } = useDragAndDrop({
    isDisabled: !canChange,
    getItems: (keys) => [...keys].map((key) => ({ "text/plain": String(key) })),
    onDragStart: ({ keys }) => {
      const key = String([...keys][0]);
      setDragging(key);
      setGap(
        list.current?.querySelector<HTMLElement>(
          `[data-glide="${CSS.escape(key)}"]`,
        )?.offsetHeight ?? 0,
      );
    },
    onDragEnd: () => {
      if (dragging) tellOthers(dragging, null);
      setDragging(null);
    },
    onReorder: ({ keys, target }) => {
      const [key] = keys;
      const from = entries.findIndex((e) => e.id === key);
      const to = landing(key, target);
      if (from >= 0 && to !== null) onMove(from, to);
    },
    renderDropIndicator: (target) => (
      <DropIndicator
        target={target}
        // The other rows make room where it would land.
        className="h-0.5 rounded-xl bg-transparent transition-[height] duration-150 data-[drop-target]:h-(--gap) data-[drop-target]:border-2 data-[drop-target]:border-dashed data-[drop-target]:border-accent data-[drop-target]:bg-accent-soft motion-reduce:transition-none"
      >
        {({ isDropTarget }) =>
          dragging && (
            <DropReport
              active={isDropTarget}
              onActive={() => {
                const index = landing(dragging, target);
                if (index !== null) tellOthers(dragging, index);
              }}
            />
          )
        }
      </DropIndicator>
    ),
  });

  // How far the service is: what's above the live entry is done, and
  // while the screens are blank the live entry too, with a line under it.
  const liveAt = entries.findIndex((e) => e.id === liveEntryId);
  const done = liveAt < 0 ? -1 : liveBlank ? liveAt : liveAt - 1;
  return (
    // The context menu key or Shift+F10 opens the selected entry's menu.
    <div
      ref={list}
      // The gap a dragged entry would drop into is as tall as the entry.
      style={{ "--gap": `${gap}px` } as React.CSSProperties}
      onMouseLeave={() => pointAt(null)}
      onKeyDown={(event) => {
        if (!canChange || touch) return;
        if (
          event.key !== "ContextMenu" &&
          !(event.shiftKey && event.key === "F10")
        )
          return;
        const entry = entries.find((e) => e.id === selected);
        const row = document.querySelector(
          `[data-entry="${CSS.escape(selected ?? "")}"]`,
        );
        if (!entry || !row) return;
        event.preventDefault();
        const box = row.getBoundingClientRect();
        setMenu({ entry, x: box.left + 24, y: box.bottom });
      }}
    >
      <GridList
        aria-label={t("playlist.entries")}
        items={entries}
        // Rows render again when the language or others' drags change, not only
        // when entries do.
        dependencies={[
          i18n.language,
          [...movingBy].join(),
          liveEntryId,
          liveBlank,
          JSON.stringify(problems),
          hovering && shownGap,
          insertMenu?.after,
        ]}
        selectionMode="single"
        selectionBehavior="replace"
        disallowEmptySelection
        selectedKeys={selected ? [selected] : []}
        onSelectionChange={(keys) => {
          const [key] = keys === "all" ? [] : keys;
          if (key !== undefined) onSelect(String(key));
        }}
        dragAndDropHooks={dragAndDropHooks}
        renderEmptyState={() => (
          <Empty
            title={t("playlist.empty")}
            description={t(
              canChange ? "playlist.emptyHelp" : "playlist.emptyVisitor",
            )}
          />
        )}
        className="flex flex-col"
      >
        {(entry) => {
          const index = entries.indexOf(entry);
          return (
            <GridListItem
              id={entry.id}
              textValue={entryTitle(entry, languages)}
              className="group rounded-xl outline-none"
            >
              {/* What's drawn glides, not the row React Aria measures: it finds the row
                above by where rows are (useGlide). The live frame and the rings sit
                inside: nothing moves, and the scrolling column doesn't cut them off. */}
              <div
                data-glide={entry.id}
                onMouseMove={
                  hovering
                    ? (event) => pointAt(gapNear(event, index))
                    : undefined
                }
                className={`relative rounded-xl border-2 group-data-[dragging]:opacity-50 group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-focus group-data-[focus-visible]:ring-inset group-data-[selected]:bg-accent-soft ${
                  movingBy.has(entry.id)
                    ? "bg-warning-soft ring-2 ring-warning ring-inset"
                    : ""
                } ${entry.id === liveEntryId && !liveBlank ? "border-live" : "border-transparent"}`}
              >
                {/* Also while its menu is open, where the entry will go. */}
                {hovering &&
                  (shownGap === index ||
                    (!!insertMenu &&
                      insertMenu.after === entries[index - 1]?.id)) && (
                    <InsertLine
                      onPress={(x, y) => {
                        const after = entries[index - 1];
                        if (after) setInsertMenu({ after: after.id, x, y });
                      }}
                    />
                  )}
                {entry.id === liveEntryId && liveBlank && (
                  // Where the service is while nothing shows: under the last entry shown.
                  <span
                    aria-hidden
                    data-position
                    className="pointer-events-none absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-live"
                  />
                )}
                <EntryRow
                  entry={entry}
                  ledBy={
                    entry.song && shows("serviceRoles")
                      ? leaderOf(entry, leads)
                      : null
                  }
                  problems={problems.filter(
                    (p) => "entryId" in p && p.entryId === entry.id,
                  )}
                  isLive={entry.id === liveEntryId}
                  onOpen={() => onOpen(entry.id)}
                  onDoubleClick={onGo && (() => onGo(entry.id))}
                  movingBy={movingBy.get(entry.id)}
                  onMenu={
                    canChange ? (x, y) => setMenu({ entry, x, y }) : undefined
                  }
                  menuButton={touch}
                  passed={index <= done}
                />
              </div>
            </GridListItem>
          );
        }}
      </GridList>
      {slides.element}
      {insertMenu && (
        <ActionsMenu
          at={insertMenu}
          label={t("playlist.insertHere")}
          actions={inserts(insertMenu.after, true)}
          onClose={() => setInsertMenu(null)}
        />
      )}
      {menu && (
        <ActionsMenu
          at={menu}
          label={t("playlist.entryActions")}
          actions={actionsOf(menu.entry)}
          onClose={() => setMenu(null)}
        />
      )}
      {leadEntry && (
        <LedByDialog
          playlistId={playlistId}
          entry={leadEntry}
          leads={leads}
          onClose={() => setLeadEntry(null)}
        />
      )}
      {hostEntry && (
        <HostWordsDialog
          playlistId={playlistId}
          entry={hostEntry}
          onClose={() => setHostEntry(null)}
        />
      )}
      {keyEntry?.song && (
        <ServiceKeyDialog
          slug={community.slug}
          playlistId={playlistId}
          entry={{ ...keyEntry, song: keyEntry.song }}
          onClose={() => setKeyEntry(null)}
        />
      )}
    </div>
  );
}

/** Reports when its drop indicator becomes the place the dragged entry would land. */
function DropReport({
  active,
  onActive,
}: {
  active: boolean;
  onActive: () => void;
}) {
  const report = useEffectEvent(onActive);
  useEffect(() => {
    if (active) report();
  }, [active]);
  return null;
}
