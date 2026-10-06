import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import type { Entry, Playlist } from "../../server/playlists/playlists";
import type { PlaylistTimes } from "../../server/playlists/times";
import { ClassicColumns } from "../live/Classic";
import { ClassicBottomBar } from "../live/ClassicBottomBar";
import { useChanges } from "../data/changes";
import { useCommunity, useShows } from "../data/community";
import { live } from "../data/connection";
import { useJson } from "../data/fetch";
import { hasRole, useRoles } from "../data/me";
import { useLiveCommands } from "./commands";
import {
  BigNowNext,
  type ControllerLayout,
  controllerLayouts,
  EntryParts,
  PhoneViews,
  Previews,
  RunningOrder,
} from "../live/ControllerViews";
import { LayoutPicker, useLayout, useWindowWidth } from "../data/device";
import { BIG_SCREEN, layoutsFor } from "../live/big-screen";
import type { Via } from "../../shared/usage";
import { useLayoutShown } from "../data/usage";
import { Hints } from "../live/hints";
import { LiveBar, LiveExtras } from "../live/LiveBar";
import { ProjectBar, type ProjectHere } from "../live/LocalProjection";
import { ProblemsIndicator, useProblems } from "./problems";
import { OnlineMembers } from "../live/OnlineMembers";
import {
  projectLocally,
  sendLive,
  updateLocalEntries,
  useLiveView,
  useLocal,
} from "../data/room";
import { SlidesPanel } from "../live/SlidesPanel";
import { NotFound } from "../app/NotFound";
import { PlaylistSearch } from "./PlaylistSearch";
import { ErrorNotice, Placeholder } from "../ui/states";
import { TextEntryEditor } from "./TextEntryEditor";
import { entryTitle } from "./EntryRow";
import { EntryList, type Insert } from "./EntryList";
import { PlaylistHeader, PlaylistEnd, Viewers } from "./PlaylistHeader";
import { UndoToast, usePlaylistEdits } from "./playlist-edits";
import { usePlaylistActivity } from "./playlist-activity";
import { usePlaylistKeys } from "./playlist-keys";
import { useEditingSong } from "./editing-song";
import { addSlides, FileDrop } from "./SlideFiles";
import { NotLately } from "./NotLately";

// Big screen loads its previews' views only where it shows.
const BigScreen = lazy(() =>
  import("../live/BigScreen").then((m) => ({ default: m.BigScreen })),
);

/** /playlists/:id: the shared plan of a service, which the team changes and everyone follows. */
export function PlaylistPage({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const community = useCommunity();
  const [, navigate] = useLocation();
  const roles = useRoles(community.slug);
  const isTeam = hasRole(roles, "team");
  const canEditSongs = hasRole(roles, "editor");
  const url = `/api/communities/${community.slug}/playlists/${id}`;
  // Changes by anyone, here or elsewhere, load the playlist again.
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((n) => n + 1);
  useEffect(
    () => live.subscribe(`playlist:${id}`, () => setVersion((n) => n + 1)),
    [id],
  );
  // Who leads its songs comes from the team schedule's slots.
  const slots = useChanges(community.slug, "slots", "service_roles");
  const {
    data: playlist,
    failed,
    retry,
  } = useJson<Playlist>(url, version + slots);
  // An archived playlist is read, and can go live, but isn't changed until restored.
  const canChange = isTeam && !playlist?.archivedAt;
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  // A new text slide or divider being written, and where it goes: after an entry, at the
  // top for null, else at the end.
  const [writing, setWriting] = useState<{
    kind: "text" | "divider";
    after?: string | null;
  } | null>(null);
  // Where the next pick in the search box goes, after "Song here".
  const [place, setPlace] = useState<{ after: string | null } | null>(null);
  const shows = useShows();
  // On a narrow page, Classic shows the playlist or the selected entry's slides.
  const [column, setColumn] = useState<"playlist" | "slides">("playlist");
  // Taps on entries, so a phone shows the tapped entry's parts.
  const [opened, setOpened] = useState(0);

  const { viewers, drags } = usePlaylistActivity(id);
  const {
    entries,
    failedChange,
    change,
    quiet,
    add,
    remove,
    restore,
    move,
    undo,
  } = usePlaylistEdits(url, playlist, reload, drags, setSelected);
  const movingBy = new Map(drags.map((d) => [d.entry, d.name]));
  // A new song gets a version in the interface language, if the community has it.
  const songLanguage = community.languages.includes(i18n.language)
    ? i18n.language
    : (community.languages[0] ?? "ro");
  const { editingSong, setEditingSong, songsSaved, songEditor, editNew } =
    useEditingSong(
      id,
      songLanguage,
      (songId) => void change("POST", "/entries", { kind: "song", songId }),
    );

  // What's live, for everyone; the team controls it. Anyone can project it locally
  // instead, to a window of their own, and controls that.
  const view = useLiveView(community.slug);
  const local = useLocal();
  const projecting = local?.slug === community.slug && local.playlistId === id;
  const controls = isTeam || projecting;
  useEffect(() => updateLocalEntries(id, entries));
  const liveEntryId = view?.playlistId === id ? view.entryId : null;
  // The selection follows what goes live, so its parts show.
  const [followed, setFollowed] = useState(liveEntryId);
  if (liveEntryId !== followed) {
    setFollowed(liveEntryId);
    if (liveEntryId) setSelected(liveEntryId);
  }
  // Big screen from 1900 CSS pixels, chosen there when nothing was picked.
  const width = useWindowWidth();
  const layouts = layoutsFor(controllerLayouts, width);
  const { layout: chosen, setLayout } = useLayout("playlist", layouts, () =>
    width >= BIG_SCREEN ? "big-screen" : undefined,
  );
  // At the Classic step, everyone gets Classic; later, people who don't control a list.
  const layout: ControllerLayout | "list" = controls
    ? (chosen?.id ?? "classic")
    : shows("layouts")
      ? "list"
      : "classic";
  useLayoutShown("playlist", layout);
  const commands = useLiveCommands(view, controls && shows("commands"));
  const problems = useProblems(
    canChange && shows("problems") ? url : null,
    `${version}-${view?.changedAt ?? ""}`,
  );
  // Times change with the playlist and with what's live.
  const times = useJson<PlaylistTimes>(
    shows("times")
      ? `${url}/times?at=${version}-${view?.changedAt ?? ""}`
      : null,
  ).data;
  const goLive = (
    entryId: string,
    slide: number | undefined,
    via: Via<"live.go">,
  ) => void sendLive(community.slug, { type: "go", entryId, slide }, via);

  usePlaylistKeys({
    slug: community.slug,
    controls,
    canChange,
    entries,
    selected,
    setSelected,
    move,
    remove,
  });
  useEffect(() => {
    document
      .querySelector(`[data-entry="${CSS.escape(selected ?? "")}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  if (playlist === undefined)
    return failed ? (
      <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
    ) : (
      <Placeholder lines={8} />
    );
  if (playlist === null) return <NotFound />;

  const selectedEntry = entries.find((e) => e.id === selected) ?? null;
  const languages = [i18n.language, ...community.languages];
  const placedAfter = entries.find((e) => e.id === place?.after);
  const insert = (what: Insert, after: string | null) =>
    what === "song" ? setPlace({ after }) : setWriting({ kind: what, after });
  // What's picked or written next goes where it was asked for.
  const at = place && { after: place.after };
  const list = (
    <FileDrop
      enabled={canChange && shows("fileSlides")}
      onFiles={(files, after) => addSlides(url, files, after)}
    >
      <EntryList
        playlistId={id}
        entries={entries}
        leads={playlist?.leads}
        movingBy={movingBy}
        liveEntryId={liveEntryId}
        liveBlank={!!liveEntryId && !!view?.blank}
        problems={problems}
        canChange={canChange}
        selected={selected}
        onSelect={setSelected}
        // A click or tap, even on the selected entry, opens its slides on a narrow page,
        // and its parts on a phone, without sending it live.
        onOpen={(entryId) => {
          setSelected(entryId);
          setColumn("slides");
          setOpened((n) => n + 1);
        }}
        onGo={
          controls
            ? (entryId) => goLive(entryId, undefined, "double-click")
            : undefined
        }
        onMove={move}
        quiet={quiet}
        onRemove={(entryId) => void remove(entryId)}
        onEdit={setEditing}
        onInsert={insert}
        onEditSong={
          canEditSongs
            ? (songId) =>
                // Layouts with room for it edit beside the playlist.
                layout === "classic" ||
                layout === "controller" ||
                layout === "running-order" ||
                layout === "big-screen"
                  ? setEditingSong(songId)
                  : navigate(`/songs/${songId}/edit`)
            : undefined
        }
      />
    </FileDrop>
  );

  const picker = (
    <LayoutPicker
      menu
      layouts={layouts}
      layout={layout}
      onChange={setLayout}
      label={t("musicians.layout")}
      names={(l) => t(`controller.layouts.${l}`)}
    />
  );
  const header = (
    <PlaylistHeader
      playlist={playlist}
      canChange={canChange}
      canArchive={isTeam}
      onRename={(title) => change("PATCH", "", { title })}
      onArchive={(archived) => change("PUT", "/archived", { archived })}
      viewers={<Viewers viewers={viewers} />}
      // The title row (live-control spec): problems, the end, who's online, the layout.
      status={
        <>
          {canChange && (
            <ProblemsIndicator problems={problems} entries={entries} />
          )}
          {canChange && shows("times") && entries.length > 0 && (
            <PlaylistEnd times={times} />
          )}
          {shows("appFrame") && <OnlineMembers />}
          {layout !== "classic" && layout !== "list" && picker}
        </>
      }
    />
  );
  // While the app frame is off, visitors see the entries and slides, as in the old app.
  const search = (canChange || shows("layouts")) && (
    <PlaylistSearch
      playlistId={id}
      canChange={canChange}
      canEditSongs={canEditSongs}
      commands={controls ? commands : []}
      add={add}
      onNewSong={editNew}
      onAddText={() => setWriting({ kind: "text", ...at })}
      onAddDivider={() => setWriting({ kind: "divider", ...at })}
      onAddSlides={(files) => addSlides(url, files)}
      place={
        place && (place.after === null || placedAfter)
          ? {
              after: place.after,
              label: placedAfter
                ? t("search.place", {
                    title: entryTitle(placedAfter, languages),
                  })
                : t("search.placeTop"),
              onEnd: () => setPlace(null),
            }
          : undefined
      }
    />
  );
  const liveSlide =
    liveEntryId === selected && view && !view.blank ? view.slide : null;
  const project: ProjectHere = {
    projecting,
    start: () =>
      projectLocally({
        slug: community.slug,
        // In the interface language, if the community has it.
        languages: [
          songLanguage,
          ...community.languages.filter((l) => l !== songLanguage),
        ],
        playlistId: id,
        entries,
      }),
  };

  return (
    <div
      // Classic on a laptop is an app screen: the window holds it, its columns scroll.
      data-app-screen={layout === "classic" || undefined}
      // It grows to the screen's bottom, where a bar of live controls sits.
      className={`flex flex-1 flex-col gap-4 ${
        layout === "classic" ? "min-[750px]:min-h-0" : ""
      }`}
    >
      {/* Classic's layout menu stays above its columns. */}
      {layout === "classic" && (
        <div className="flex flex-wrap items-center justify-end gap-2 empty:hidden">
          {picker}
        </div>
      )}
      {layout !== "classic" && header}
      {failedChange && <ErrorNotice message={t("states.actionFailed")} />}
      {undo && (
        <UndoToast title={undo.title} onUndo={() => void restore(undo.id)} />
      )}
      {layout !== "classic" && search}
      {editingSong &&
      (layout === "big" || layout === "tablet" || layout === "phone") ? (
        // These layouts have no column for the editor: it takes their place.
        songEditor
      ) : layout === "classic" ? (
        <Hints enabled={controls}>
          <ClassicColumns
            top={
              <>
                {header}
                {search}
              </>
            }
            playlist={list}
            entry={selectedEntry}
            title={selectedEntry ? entryTitle(selectedEntry, languages) : ""}
            isLive={
              !!selectedEntry &&
              liveEntryId === selectedEntry.id &&
              !view?.blank
            }
            liveSlide={liveSlide}
            onGo={controls ? goLive : undefined}
            column={column}
            onBack={() => setColumn("playlist")}
            canEditSongs={canEditSongs}
            editor={songEditor}
            onEdit={setEditingSong}
            aside={
              canChange &&
              entries.length === 0 &&
              shows("statistics") && (
                <NotLately
                  onAdd={(songId) => void add({ kind: "song", songId })}
                />
              )
            }
          />
          {controls && (
            <ClassicBottomBar
              view={view}
              project={project}
              empty={entries.length === 0}
            />
          )}
        </Hints>
      ) : layout === "list" ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            {list}
            <SlidesPanel entry={selectedEntry} live={liveSlide} />
          </div>
          <ProjectBar {...project} />
        </>
      ) : layout === "controller" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
          {list}
          {/* Always a cell, so the previews keep their column while a song loads. */}
          <div className="min-w-0">
            {editingSong ? (
              songEditor
            ) : (
              <EntryParts
                key={songsSaved}
                entry={selectedEntry}
                view={view}
                onEditSong={canEditSongs ? setEditingSong : undefined}
                canGo={isTeam}
              />
            )}
          </div>
          {/* In view while the parts or the editor scroll. */}
          <div className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
            <Previews />
            <LiveBar view={view} side project={project} />
          </div>
        </div>
      ) : layout === "running-order" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          {editingSong ? (
            songEditor
          ) : (
            <RunningOrder
              key={songsSaved}
              entries={entries}
              view={liveEntryId ? view : undefined}
              onEditSong={canEditSongs ? setEditingSong : undefined}
            />
          )}
          <div className="flex flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
            <Previews />
            <LiveBar view={view} side project={project} />
          </div>
        </div>
      ) : layout === "big" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <BigNowNext view={view} />
          <div className="flex flex-col gap-3">
            <LiveBar view={view} side big project={project} />
            {list}
          </div>
        </div>
      ) : layout === "big-screen" ? (
        <Suspense fallback={<Placeholder lines={8} />}>
          <BigScreen
            list={list}
            parts={
              editingSong ? (
                songEditor
              ) : (
                <EntryParts entry={selectedEntry} view={view} canGo={isTeam} />
              )
            }
            liveBar={<LiveBar view={view} side project={project} />}
            view={view}
            entries={entries}
            times={times}
            problems={problems}
          />
        </Suspense>
      ) : layout === "tablet" ? (
        // The playlist beside the live panel, which stays in view; the tapped entry's
        // parts right under its buttons, and the panel's other controls after them, so
        // the slides start on the first screen.
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {list}
          <div className="flex min-w-0 flex-col gap-3">
            <div className="z-10 bg-background md:sticky md:top-4">
              <LiveBar view={view} side big split project={project} />
            </div>
            <EntryParts entry={selectedEntry} view={view} big canGo={isTeam} />
            <div className="flex flex-col gap-3 rounded-xl border border-separator p-3 empty:hidden">
              <LiveExtras view={view} />
            </div>
          </div>
        </div>
      ) : (
        <>
          <PhoneViews
            order={list}
            song={
              <EntryParts
                entry={selectedEntry}
                view={view}
                big
                canGo={isTeam}
              />
            }
            screens={<Previews big />}
            opened={opened}
          />
          <LiveBar view={view} big project={project} />
        </>
      )}
      {writing && (
        <TextEntryEditor
          entry={null}
          kind={writing.kind}
          onSave={(text, plannedMinutes) =>
            add({ ...writing, text, plannedMinutes })
          }
          onClose={() => setWriting(null)}
        />
      )}
      {editing && (
        <TextEntryEditor
          entry={editing}
          onSave={(text, plannedMinutes) =>
            change("PATCH", `/entries/${editing.id}`, { text, plannedMinutes })
          }
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
