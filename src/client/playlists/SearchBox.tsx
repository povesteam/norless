import { useBackCloses } from "../ui/back";
import { TeamRecordingsMark } from "../songs/RecordingsMark";
import {
  BookOpen,
  CornerDownRight,
  Heading,
  Music,
  Plus,
  Search,
  ThumbsUp,
  X,
  Zap,
} from "lucide-react";
import {
  Button,
  Chip,
  ComboBox,
  Description,
  Label,
  ListBox,
} from "@heroui/react";
import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ButtonContext,
  PopoverContext,
  useSlottedContext,
} from "react-aria-components";
import { useTranslation } from "react-i18next";
import type { SearchResult, SongResult } from "../../server/songs/search";
import { formatReference } from "../../shared/bible";
import { titleFor } from "../../shared/song-render";
import {
  ComboBoxInput,
  FirstOptionSelected,
  useOptionsFrame,
} from "../ui/combobox";
import { useCommunity, useShows } from "../data/community";
import { useWindowWidth } from "../data/device";
import { send, useJson } from "../data/fetch";
import { Placeholder } from "../ui/states";
import { relativeTime } from "../ui/time";
import { Tip } from "../ui/tip";
import { track } from "../data/usage";

type Kind = SearchResult["type"];

// Only wide windows show it, so others don't load the song views.
const SearchPreview = lazy(() => import("./SearchPreview"));
/**
 * The preview's frame, also while its code loads: arriving later, it narrowed the results
 * under the pointer, and a click that began on one layout ended on another.
 */
const previewFrame =
  "min-h-0 flex-1 overflow-y-auto rounded-xl border border-separator p-4";

/** Something the search box can do instead of finding, e.g. "blank" or "bridge". */
export type Command = {
  id: string;
  label: string;
  /** Words that find it, besides its label. */
  words: string[];
  run: () => void;
  /** An action the empty box offers shows its own icon. */
  icon?: React.ReactNode;
};

/** Lowercase without diacritics, to match what's typed. */
const fold = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

type Item =
  | { id: string; result: SearchResult; command?: never; hint?: never }
  | { id: string; command: Command; result?: never; hint?: never }
  | { id: string; hint: string; result?: never; command?: never };

/** A key per result, unique within one answer. */
const keyOf = (result: SearchResult) =>
  result.type === "song"
    ? result.id
    : result.type === "bible"
      ? `bible:${result.book}:${result.chapter}:${result.from}:${result.to}`
      : result.type;

/**
 * The search box: songs, and the other `kinds` of results (Bible references, the query
 * as a divider, a new song) where they can be added. Typing a letter or digit anywhere
 * outside a text field starts a search, the arrow keys move the selection, Enter picks,
 * and Esc clears.
 */
export function SearchBox({
  onPick,
  kinds = ["song"],
  commands = [],
  actions = [],
  playlistId,
  place,
}: {
  onPick: (result: SearchResult) => void;
  kinds?: Kind[];
  /** Offered first when what's typed starts one of their words. */
  commands?: Command[];
  /** Offered first while the box is empty. */
  actions?: Command[];
  /** The playlist it adds to, whose songs aren't suggested. */
  playlistId?: string;
  /**
   * Where the next pick goes, when not at the end: said in the
   * box until a pick, Escape or its × ends it.
   */
  place?: { label: string; onEnd: () => void };
}) {
  const { t, i18n } = useTranslation();
  const community = useCommunity();
  const input = useRef<HTMLInputElement>(null);
  const frame = useOptionsFrame();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // Back closes the full-screen search, as leaving the box does.
  useBackCloses(open, () => input.current?.blur());
  // While open, the box and its results cover the page; the box's
  // place keeps its height, so nothing moves when it comes back.
  const box = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState(0);
  const free = useFreeArea(open);
  const wide = useWindowWidth() >= 1024;
  const {
    data: response,
    failed,
    fresh,
  } = useJson<{ results: SearchResult[] }>(
    open
      ? `/api/communities/${community.slug}/search?q=${encodeURIComponent(query)}${
          playlistId ? `&playlist=${playlistId}` : ""
        }`
      : null,
  );
  const typed = fold(query);
  const matching = typed
    ? commands.filter((c) =>
        [c.label, ...c.words].some((w) => fold(w).startsWith(typed)),
      )
    : [];
  // The empty box: what can be added besides songs, then songs worth suggesting.
  const empty = query.trim() === "";
  const language = community.languages.includes(i18n.language)
    ? i18n.language
    : (community.languages[0] ?? "ro");
  const results: Item[] = [
    ...(empty ? actions : matching).map((command) => ({
      id: `command:${command.id}`,
      command,
    })),
    ...(empty && kinds.includes("bible")
      ? [
          {
            id: "hint",
            hint: t("search.bibleHint", {
              example: formatReference(
                { book: 43, chapter: 3, from: 16, to: 16 },
                language,
              ),
            }),
          },
        ]
      : []),
    ...(response?.results ?? [])
      .filter((r) => kinds.includes(r.type))
      .map((result) => ({ id: keyOf(result), result })),
  ];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        !/^[\p{L}\p{N}]$/u.test(event.key) ||
        target.closest("input, textarea, select, [contenteditable]")
      )
        return;
      event.preventDefault();
      setQuery(event.key);
      // Focusing opens the results.
      input.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Asked to add somewhere: the box takes the focus.
  useEffect(() => {
    if (place?.label) input.current?.focus();
  }, [place?.label]);

  // A search the box closes on without a song or passage: what the library lacks, for
  // its editors. Once per search.
  const told = useRef<string | null>(null);
  const tellMiss = () => {
    const q = query.trim();
    if (q.length < 3 || !fresh || !response || told.current === q) return;
    if (response.results.some((r) => r.type === "song" || r.type === "bible"))
      return;
    told.current = q;
    void send("POST", `/api/communities/${community.slug}/search-misses`, {
      q,
    });
  };

  const title = (song: SongResult) =>
    titleFor(song.titles, [i18n.language, ...community.languages]);
  const label = (result: Exclude<SearchResult, SongResult>) =>
    result.type === "bible"
      ? formatReference(result, i18n.language)
      : result.type === "divider"
        ? t("search.addDivider", { text: result.text })
        : t("search.newSong", { title: result.title });

  return (
    <div ref={box} style={open ? { height: held } : undefined}>
      <div
        className={open ? "fixed inset-x-0 z-40 bg-background p-4" : undefined}
        style={open ? free : undefined}
        // Inside the panel, the box keeps the focus, so scrolling the results or
        // reading the words doesn't close it.
        onMouseDown={(event) => {
          if (open && event.target !== input.current) event.preventDefault();
        }}
      >
        <ComboBox
          aria-label={t("search.placeholder")}
          className={open ? "flex h-full flex-col gap-3" : undefined}
          items={results}
          inputValue={query}
          onInputChange={setQuery}
          // Nothing stays selected: picking a result uses it and clears the box.
          value={null}
          onChange={(id) => {
            const picked = results.find((r) => r.id === id);
            if (!picked || picked.hint !== undefined) return;
            track("search.pick", {
              via: picked.command ? "command" : picked.result.type,
              q: query,
              rank: results.indexOf(picked),
              ...(picked.command && { command: picked.command.id }),
            });
            // A command, a passage or a divider wasn't a search for a song.
            if (
              picked.command ||
              (picked.result.type !== "song" &&
                picked.result.type !== "new-song")
            )
              told.current = query.trim();
            if (picked.command) picked.command.run();
            else onPick(picked.result);
            place?.onEnd();
            // Leaving the box keeps it from opening again on the cleared text, and lets
            // the arrow keys go back to the page. After React Aria, which focuses the box
            // again when a result is clicked; unless something new was typed meanwhile.
            const text = query;
            setTimeout(() => {
              if (input.current && input.current.value !== text) return;
              input.current?.blur();
              setQuery("");
            });
          }}
          onOpenChange={(isOpen) => {
            if (isOpen) setHeld(box.current?.offsetHeight ?? 0);
            setOpen(isOpen);
            if (!isOpen) tellMiss();
          }}
          menuTrigger="focus"
          allowsEmptyCollection
        >
          {/* The magnifier sits over the input; the combobox's group shows only the input. */}
          <div className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 z-10 -translate-y-1/2 text-muted" />
            <ComboBox.InputGroup>
              <ComboBoxInput
                ref={input}
                className={`w-full ps-9 ${place ? "pe-52" : ""}`}
                placeholder={t("search.placeholder")}
                onKeyDown={(event) => {
                  frame.input.onKeyDown(event);
                  if (event.key !== "Escape") return;
                  setQuery("");
                  place?.onEnd();
                }}
              />
            </ComboBox.InputGroup>
            {place && (
              // Where the pick lands, in the box's end so nothing moves. Its button isn't
              // the combobox's.
              <ButtonContext.Provider value={null}>
                <span className="absolute end-1 top-1/2 z-10 flex max-w-48 -translate-y-1/2 items-center gap-1 rounded-full bg-accent-soft ps-2.5 text-sm text-accent-soft-foreground">
                  <CornerDownRight className="size-4 shrink-0" />
                  <span className="truncate">{place.label}</span>
                  <Tip label={t("search.cancelPlace")}>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      aria-label={t("search.cancelPlace")}
                      // The search stays open: only where the pick lands changes.
                      preventFocusOnPress
                      className="size-7 min-h-7 min-w-7 rounded-full"
                      onPress={place.onEnd}
                    >
                      <X className="size-4" />
                    </Button>
                  </Tip>
                </span>
              </ButtonContext.Provider>
            )}
          </div>
          {/* In the panel rather than a popover: the results fill it, and on a wide
            window the highlighted song's words show beside them. */}
          <ResultsPanel
            className={open ? "flex min-h-0 flex-1 gap-4" : "hidden"}
          >
            <ListBox
              className={`min-h-0 flex-1 overflow-y-auto ${frame.list.className}`}
              renderEmptyState={() =>
                failed ? (
                  <p className="text-danger">{t("search.failed")}</p>
                ) : response ? (
                  t("search.empty")
                ) : (
                  <Placeholder lines={2} />
                )
              }
            >
              {({ id, result, command, hint }: Item) =>
                hint !== undefined ? (
                  // How to find a passage, not something to pick.
                  <ListBox.Item id={id} textValue={hint} isDisabled>
                    <Label className="flex items-center gap-2 text-muted">
                      <BookOpen />
                      {hint}
                    </Label>
                  </ListBox.Item>
                ) : command ? (
                  <ListBox.Item id={id} textValue={command.label}>
                    <Label className="flex items-center gap-2">
                      {command.icon ?? <Zap />}
                      {command.label}
                    </Label>
                    {!command.icon && (
                      <Description>{t("search.command")}</Description>
                    )}
                  </ListBox.Item>
                ) : result.type === "song" ? (
                  <ListBox.Item
                    id={id}
                    textValue={title(result)}
                    // The details go under a title they'd squeeze, as on a phone.
                    className="flex-wrap gap-y-1"
                  >
                    <SongOption song={result} title={title(result)} />
                  </ListBox.Item>
                ) : (
                  <ListBox.Item id={id} textValue={label(result)}>
                    <Label className="flex items-center gap-2">
                      {result.type === "bible" ? (
                        <BookOpen />
                      ) : result.type === "divider" ? (
                        <Heading />
                      ) : (
                        <Plus />
                      )}
                      {label(result)}
                    </Label>
                    {result.type === "bible" && (
                      <Description>{t("search.bible")}</Description>
                    )}
                  </ListBox.Item>
                )
              }
            </ListBox>
            {open && wide && (
              <Suspense fallback={<div className={previewFrame} />}>
                <SearchPreview
                  className={previewFrame}
                  songs={results.flatMap((r) =>
                    r.result?.type === "song" ? [r.id] : [],
                  )}
                />
              </Suspense>
            )}
          </ResultsPanel>
          {/* Until the results for what's typed arrive, Enter picks nothing. */}
          {/* Commands are there at once; in the empty box, Enter picks the first song. */}
          <FirstOptionSelected
            options={results.map((r) => r.id).join()}
            ready={fresh || (!empty && matching.length > 0)}
            first={empty ? results.find((r) => r.result)?.id : undefined}
          />
        </ComboBox>
      </div>
    </div>
  );
}

/**
 * The results in the panel, in the popover's role: React Aria keeps them shown to screen
 * readers while it hides the rest, and the box's label and button don't reach them.
 */
function ResultsPanel({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  const popover = useSlottedContext(PopoverContext) as {
    ref?: React.Ref<HTMLDivElement>;
    clearContexts?: React.Context<unknown>[];
  } | null;
  // As React Aria's popover does.
  const cleared = (popover?.clearContexts ?? []).reduce<React.ReactNode>(
    (inner, Context) => (
      <Context.Provider value={null}>{inner}</Context.Provider>
    ),
    children,
  );
  return (
    <div ref={popover?.ref} className={className}>
      {cleared}
    </div>
  );
}

/**
 * Where the open search's panel goes: from the visible top down to the live bar, if one
 * shows, or the visible bottom, above a phone's keyboard; again as it changes.
 */
function useFreeArea(active: boolean) {
  const [area, setArea] = useState<{ top: number; height: number }>();
  useLayoutEffect(() => {
    if (!active) return;
    const view = window.visualViewport;
    const measure = () => {
      const top = view?.offsetTop ?? 0;
      const bottom = top + (view?.height ?? window.innerHeight);
      const bar = document
        .querySelector("[data-bottom-bar]")
        ?.getBoundingClientRect().top;
      setArea({ top, height: Math.min(bottom, bar ?? bottom) - top });
    };
    measure();
    view?.addEventListener("resize", measure);
    view?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    return () => {
      view?.removeEventListener("resize", measure);
      view?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [active]);
  return area;
}

/** Why the empty box suggests a song, in its chip. */
const reasons = {
  liked: "opinions.liked",
  lately: "search.lately",
  rested: "statistics.notLately",
} as const;

function SongOption({ song, title }: { song: SongResult; title: string }) {
  const { t, i18n } = useTranslation();
  const shows = useShows();
  const liked = song.liked && shows("songFeedback");
  return (
    <>
      <Label className="flex items-center gap-2">
        {liked ? (
          <ThumbsUp aria-label={t("opinions.liked")} className="text-accent" />
        ) : (
          <Music />
        )}
        {title}
      </Label>
      <Description className="flex flex-wrap items-center gap-1">
        {song.reason && (song.reason !== "liked" || liked) && (
          <Chip size="sm" color="accent" variant="soft">
            {t(reasons[song.reason])}
          </Chip>
        )}
        {song.keySignature && (
          <Chip size="sm" variant="secondary">
            {song.keySignature}
          </Chip>
        )}
        {song.timeSignature && (
          <Chip size="sm" variant="secondary">
            {song.timeSignature}
          </Chip>
        )}
        {song.tags.map((tag) => (
          <Chip key={tag} size="sm" variant="soft">
            {tag}
          </Chip>
        ))}
        <TeamRecordingsMark plain songId={song.id} count={song.recordings} />
        {song.lastPlayedAt &&
          t("search.lastPlayed", {
            when: relativeTime(song.lastPlayedAt, new Date(), i18n.language),
          })}
        {song.recent && shows("statistics") && (
          <span className="font-medium text-warning-soft-foreground">
            {t("rotation.hint", {
              count: song.recent.services,
              of: song.recent.of,
            })}
          </span>
        )}
      </Description>
    </>
  );
}
