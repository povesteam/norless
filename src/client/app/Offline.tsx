import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ListPlus,
  MonitorPlay,
  Plus,
  Search,
  Square,
  Trash2,
  WifiOff,
} from "lucide-react";
import {
  Button,
  Description,
  Input,
  Label,
  Switch,
  TextField,
} from "@heroui/react";
import {
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useTranslation } from "react-i18next";
import type { Kept } from "../../server/live/offline";
import type { Entry, Playlist } from "../../server/playlists/playlists";
import type { Song } from "../../server/songs/songs";
import { playlistName } from "../../shared/playlist-name";
import { titleFor } from "../../shared/song-render";
import { useChanges } from "../data/changes";
import { useCommunity } from "../data/community";
import { live } from "../data/connection";
import { BlankButton } from "../live/LiveBar";
import { keep, plain, useKeepOffline, useKept } from "./offline-store";
import {
  openLocalProjector,
  projectLocally,
  sendLive,
  stopLocal,
  useLocal,
} from "../data/room";
import { Empty, Placeholder } from "../ui/states";

/**
 * While this device keeps the songs: keeps them again when songs or
 * playlists change, at most every 10 minutes, so a busy Sunday doesn't download them
 * over and over.
 */
export function OfflineKeeper() {
  const { slug } = useCommunity();
  const [on] = useKeepOffline(slug);
  const version = useChanges(slug, "songs", "playlists", "entries");
  const last = useRef(0);
  useEffect(() => {
    if (!on) return;
    const wait = Math.max(0, last.current + 10 * 60_000 - Date.now());
    const timer = setTimeout(() => {
      last.current = Date.now();
      void keep(slug);
    }, wait);
    return () => clearTimeout(timer);
  }, [on, slug, version]);
  return null;
}

/** The switch on My account, for one community's songs, with what's kept. */
export function OfflineSwitch({ slug, name }: { slug: string; name: string }) {
  const { t, i18n } = useTranslation();
  const [on, set] = useKeepOffline(slug);
  const kept = useKept(slug);
  // Switched off without internet, the kept songs can't come back until it returns
  // (decision review).
  const connected =
    useSyncExternalStore(live.onStatus, live.status) === "connected";
  const change = (value: boolean) => {
    if (!value && !connected && !window.confirm(t("offline.offWithout")))
      return;
    set(value);
    // Kept at once, not only when the community's pages open next.
    if (value) void keep(slug);
  };
  return (
    <Switch
      size="sm"
      isSelected={on}
      onChange={change}
      className="max-w-full min-w-0"
    >
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Label>{t("offline.keepFrom", { name })}</Label>
      </Switch.Content>
      <Description className="whitespace-normal">
        {on && kept
          ? t("offline.kept", {
              count: kept.songs.length,
              at: new Intl.DateTimeFormat(i18n.language, {
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23",
              }).format(new Date(kept.keptAt)),
            })
          : t("offline.keepHelp")}
      </Description>
    </Switch>
  );
}

type Temporary = { id: string; title: string; songIds: string[] };
const temporaryKey = (slug: string) => `norless:offline-playlists:${slug}`;
const readTemporary = (slug: string): Temporary[] => {
  try {
    return JSON.parse(localStorage.getItem(temporaryKey(slug)) ?? "[]");
  } catch {
    return [];
  }
};

/** A kept song as a playlist entry, for local projection. */
const entryOf = (song: Song, id: string): Entry => ({
  id,
  kind: "song",
  song: {
    type: "song",
    id: song.id,
    titles: Object.fromEntries(song.versions.map((v) => [v.language, v.title])),
    keySignature: song.keySignature,
    timeSignature: song.timeSignature,
    tags: [],
    lastPlayedAt: null,
    deleted: false,
    playedRecently: false,
  },
  bible: null,
  text: null,
  plannedMinutes: null,
  keySignature: null,
});

/**
 * /<community>/offline: what this device kept, without internet.
 * Its playlists project through a projector window of this browser; temporary
 * playlists, made by searching the kept songs, stay on this device. Nothing is sent.
 */
export function OfflinePage({ slug }: { slug: string }) {
  const { t, i18n } = useTranslation();
  const kept = useKept(slug);
  const [temporary, setTemporary] = useState(() => readTemporary(slug));
  const saveTemporary = (next: Temporary[]) => {
    setTemporary(next);
    try {
      localStorage.setItem(temporaryKey(slug), JSON.stringify(next));
    } catch {
      // Kept for this page only.
    }
  };
  const [chosen, setChosen] = useState<string | null>(null);
  const local = useLocal();
  // The clicker and the keys drive the projector, as on a playlist; the projector
  // window passes its keys here. Listening once, so no key falls between renders.
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!local || event.ctrlKey || event.metaKey) return;
    const typing =
      event.target instanceof Element &&
      !!event.target.closest("input, textarea");
    const action =
      event.key === "PageDown" || (!typing && event.key === "ArrowRight")
        ? ({ type: "next" } as const)
        : event.key === "PageUp" || (!typing && event.key === "ArrowLeft")
          ? ({ type: "previous" } as const)
          : !typing && event.key === "Escape"
            ? ({ type: "blank", blank: !local.view.blank } as const)
            : null;
    if (!action) return;
    event.preventDefault();
    void sendLive(slug, action);
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);

  if (kept === undefined) return <Placeholder lines={8} />;
  if (kept === null)
    return (
      <div className="p-4">
        <Empty
          title={t("offline.nothing")}
          description={t("offline.nothingHelp")}
        />
      </div>
    );

  const languages = [i18n.language, ...kept.community.languages];
  const songs = new Map(kept.songs.map((s) => [s.id, s]));
  const lists: (Pick<Playlist, "id" | "entries"> & {
    name: string;
    temporary?: true;
  })[] = [
    ...temporary.map((p) => ({
      id: p.id,
      name: p.title,
      temporary: true as const,
      entries: p.songIds.flatMap((id, i) => {
        const song = songs.get(id);
        return song ? [entryOf(song, `${p.id}-${i}`)] : [];
      }),
    })),
    ...kept.playlists.map((p) => ({
      ...p,
      name: playlistName(p, i18n.language),
    })),
  ];
  const list = lists.find((l) => l.id === chosen) ?? lists[0];
  const project = () =>
    list &&
    projectLocally({
      slug,
      languages: kept.community.languages,
      playlistId: list.id,
      entries: list.entries,
      known: kept.songs,
    });
  const go = (entryId: string) => {
    if (local?.playlistId !== list?.id) project();
    void sendLive(slug, { type: "go", entryId });
  };
  const title = (entry: Entry) =>
    entry.song
      ? titleFor(entry.song.titles, languages)
      : (entry.text?.split("\n")[0] ?? "");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center gap-3">
        <a href={`/${slug}`} className="link text-sm">
          <ArrowLeft />
          {kept.community.name}
        </a>
        <h2 className="flex items-center gap-2 text-2xl font-semibold">
          <WifiOff />
          {t("offline.title")}
        </h2>
        <p className="text-sm text-muted">
          {t("offline.keptOn", {
            count: kept.songs.length,
            playlists: kept.playlists.length,
            at: new Intl.DateTimeFormat(i18n.language, {
              dateStyle: "long",
              timeStyle: "short",
              hourCycle: "h23",
            }).format(new Date(kept.keptAt)),
          })}
        </p>
      </header>
      {/* The projector's controls, in one place whatever is chosen. */}
      <div className="flex flex-wrap items-center gap-2">
        {local ? (
          <>
            <Button
              variant="secondary"
              onPress={() => void sendLive(slug, { type: "previous" })}
            >
              <ChevronLeft />
              {t("live.previous")}
            </Button>
            <BlankButton
              blank={local.view.blank}
              onPress={() =>
                void sendLive(slug, { type: "blank", blank: !local.view.blank })
              }
            />
            <Button onPress={() => void sendLive(slug, { type: "next" })}>
              <ChevronRight />
              {t("live.next")}
            </Button>
            <Button variant="ghost" onPress={() => void openLocalProjector()}>
              <MonitorPlay />
              {t("offline.window")}
            </Button>
            <Button variant="ghost" onPress={stopLocal}>
              <Square />
              {t("offline.stop")}
            </Button>
          </>
        ) : (
          <Button onPress={project} isDisabled={!list?.entries.length}>
            <MonitorPlay />
            {t("offline.project")}
          </Button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
        <nav
          aria-label={t("offline.playlists")}
          className="flex flex-col gap-1"
        >
          {lists.map((l) => (
            <Button
              key={l.id}
              variant={l.id === list?.id ? "secondary" : "ghost"}
              className="justify-start"
              onPress={() => setChosen(l.id)}
            >
              {l.temporary ? <ListPlus /> : <MonitorPlay />}
              <span className="truncate">{l.name}</span>
            </Button>
          ))}
          <NewPlaylist
            onCreate={(title) => {
              const id = `t${Date.now().toString(36)}`;
              saveTemporary([{ id, title, songIds: [] }, ...temporary]);
              setChosen(id);
            }}
          />
        </nav>
        <section aria-label={list?.name} className="flex flex-col gap-3">
          {list ? (
            <ol className="flex flex-col gap-1">
              {list.entries.map((entry, i) => (
                <li key={entry.id} className="flex items-center gap-2">
                  <Button
                    variant={
                      local?.view.entryId === entry.id ? "primary" : "ghost"
                    }
                    className="flex-1 justify-start"
                    onPress={() => go(entry.id)}
                  >
                    <span className="tabular-nums text-muted">{i + 1}</span>
                    <span className="truncate">{title(entry)}</span>
                  </Button>
                  {list.temporary && (
                    <Button
                      isIconOnly
                      variant="ghost"
                      aria-label={t("offline.remove", { title: title(entry) })}
                      onPress={() =>
                        saveTemporary(
                          temporary.map((p) =>
                            p.id === list.id
                              ? {
                                  ...p,
                                  songIds: p.songIds.filter((_, j) => j !== i),
                                }
                              : p,
                          ),
                        )
                      }
                    >
                      <Trash2 />
                    </Button>
                  )}
                </li>
              ))}
            </ol>
          ) : null}
          {list?.temporary && (
            <SongSearch
              kept={kept}
              languages={languages}
              onPick={(songId) =>
                saveTemporary(
                  temporary.map((p) =>
                    p.id === list.id
                      ? { ...p, songIds: [...p.songIds, songId] }
                      : p,
                  ),
                )
              }
            />
          )}
        </section>
      </div>
    </div>
  );
}

function NewPlaylist({ onCreate }: { onCreate: (title: string) => void }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  return (
    <form
      className="mt-2 flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        onCreate(title.trim());
        setTitle("");
      }}
    >
      <TextField value={title} onChange={setTitle} className="min-w-0 flex-1">
        <Label>{t("offline.newPlaylist")}</Label>
        <Input placeholder={t("offline.newPlaceholder")} />
      </TextField>
      <Button type="submit" isIconOnly aria-label={t("offline.create")}>
        <Plus />
      </Button>
    </form>
  );
}

/** The kept songs by title or words, accents ignored; titles first. */
function SongSearch({
  kept,
  languages,
  onPick,
}: {
  kept: Kept;
  languages: string[];
  onPick: (songId: string) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const index = useMemo(
    () =>
      kept.songs.map((song) => ({
        song,
        title: plain(song.versions.map((v) => v.title).join(" ")),
        // The words, without chord rows.
        words: plain(
          song.versions
            .map((v) =>
              v.text
                .split("\n")
                .filter((row) => !row.trimStart().startsWith("."))
                .join(" "),
            )
            .join(" "),
        ),
      })),
    [kept],
  );
  const words = plain(query).split(/\s+/).filter(Boolean);
  const found = words.length
    ? [
        ...index.filter((s) => words.every((w) => s.title.includes(w))),
        ...index.filter(
          (s) =>
            !words.every((w) => s.title.includes(w)) &&
            words.every((w) => s.title.includes(w) || s.words.includes(w)),
        ),
      ].slice(0, 20)
    : [];
  return (
    <div className="flex flex-col gap-2">
      <TextField type="search" value={query} onChange={setQuery}>
        <Label className="flex items-center gap-1">
          <Search aria-hidden className="size-4" />
          {t("offline.search")}
        </Label>
        <Input />
      </TextField>
      <ul className="flex flex-col gap-1">
        {found.map(({ song }) => (
          <li key={song.id}>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onPress={() => onPick(song.id)}
            >
              <Plus />
              <span className="truncate">
                {titleFor(
                  Object.fromEntries(
                    song.versions.map((v) => [v.language, v.title]),
                  ),
                  languages,
                )}
              </span>
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
