import { AArrowDown, AArrowUp, Moon, Sun } from "lucide-react";
import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { generate } from "lean-qr";
import { toSvgDataURL } from "lean-qr/extras/svg";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FollowView } from "../../server/live/live-view";
import type { Song } from "../../server/songs/songs";
import { formatReference } from "../../shared/bible";
import { lettersOnly, titleFor } from "../../shared/song-render";
import { parseSong, partLabels, type Slide } from "../../shared/song-text";
import { shows } from "../../shared/features";
import { type Community, switchesOf } from "../data/community";
import { live } from "../data/connection";
import { useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { languageCode } from "../ui/icons";
import { PartBox } from "../stage/parts";
import { usePartName } from "../stage/parts";
import { Markdown } from "../ui/markdown";
import { NotFound } from "../app/NotFound";
import { Placeholder } from "../ui/states";
import { useUsageCommunity } from "../data/usage";
import { SlidePage } from "./SlidePage";

/** What's live, for phones following the room; undefined until it arrives. */
export function useFollowView(slug: string | null) {
  const [view, setView] = useState<FollowView>();
  useEffect(
    () =>
      slug
        ? live.subscribe(`follow:${slug}`, (data) =>
            setView(data as FollowView),
          )
        : undefined,
    [slug],
  );
  return view;
}

/** A choice kept in this browser; private windows and blocked storage just forget it. */
function useKept<T extends string | number>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const kept = localStorage.getItem(key);
      return kept === null
        ? initial
        : ((typeof initial === "number" ? Number(kept) : kept) as T);
    } catch {
      return initial;
    }
  });
  const set = (next: T) => {
    setValue(next);
    try {
      localStorage.setItem(key, String(next));
    } catch {
      // Kept for this page only.
    }
  };
  return [value, set] as const;
}

/**
 * /<community>/follow: the live song on anyone's phone, without an
 * account and without controls, every part with the live one in view.
 */
export function FollowPage({ slug }: { slug: string }) {
  const { t, i18n } = useTranslation();
  const community = useJson<Community>(
    `/api/communities/${encodeURIComponent(slug)}`,
    useChanges(slug, "communities"),
  ).data;
  const view = useFollowView(slug);
  useUsageCommunity(slug);
  const languages = community?.languages ?? [];
  const browser = languages.find((l) => i18n.language.startsWith(l));
  const [chosen, setChosen] = useKept("norless:follow:language", "" as string);
  const shown =
    chosen === "both"
      ? languages
      : languages.includes(chosen)
        ? [chosen]
        : [browser ?? languages[0] ?? "ro"];
  const [size, setSize] = useKept<number>("norless:follow:size", 1);
  const [scheme, setScheme] = useKept<string>("norless:follow:scheme", "dark");

  if (community === undefined) return <Placeholder lines={8} />;
  if (community === null || !shows(switchesOf(community), "followAlong"))
    return <NotFound />;
  return (
    <div
      className={`${scheme === "dark" ? "dark" : "light"} fixed inset-0 flex flex-col bg-background text-foreground`}
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-separator px-3 py-2">
        <span className="font-semibold">{community.name}</span>
        <span className="ms-auto flex flex-wrap items-center gap-1">
          {languages.length > 1 && (
            <ToggleButtonGroup
              aria-label={t("follow.language")}
              selectionMode="single"
              disallowEmptySelection
              size="sm"
              selectedKeys={[shown.length > 1 ? "both" : (shown[0] ?? "")]}
              onSelectionChange={(keys) => {
                const [key] = keys;
                if (key !== undefined) setChosen(String(key));
              }}
            >
              {[...languages, "both"].map((l, i) => (
                <ToggleButton key={l} id={l}>
                  {i > 0 && <ToggleButtonGroup.Separator />}
                  {l === "both" ? t("follow.both") : languageCode(l)}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={t("follow.smaller")}
            isDisabled={size <= 0.6}
            onPress={() => setSize(Math.round((size - 0.2) * 10) / 10)}
          >
            <AArrowDown />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={t("follow.larger")}
            isDisabled={size >= 2.4}
            onPress={() => setSize(Math.round((size + 0.2) * 10) / 10)}
          >
            <AArrowUp />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={t(scheme === "dark" ? "follow.light" : "follow.dark")}
            onPress={() => setScheme(scheme === "dark" ? "light" : "dark")}
          >
            {scheme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </span>
      </header>
      <main
        className="flex min-h-0 flex-1 flex-col"
        style={{ fontSize: `${size * 1.15}rem` }}
      >
        <Followed slug={slug} view={view} languages={shown} />
      </main>
    </div>
  );
}

function Followed({
  slug,
  view,
  languages,
}: {
  slug: string;
  view: FollowView | undefined;
  languages: string[];
}) {
  const { t } = useTranslation();
  const entry = view?.entry;
  const song = useJson<Song>(
    entry?.songId
      ? `/api/communities/${slug}/songs/${entry.songId}?at=${encodeURIComponent(entry.songUpdatedAt ?? "")}`
      : null,
  ).data;
  // A verse projected from bible.com, in each language the phone reads.
  if (view?.verse && !view.blank) {
    const verses = [
      ...new Set(
        [...languages, ...Object.keys(view.verse)].flatMap(
          (l) => view.verse?.[l] ?? [],
        ),
      ),
    ];
    return (
      <div className="flex flex-col gap-4 p-4">
        {verses.map((v) => (
          <section key={v.reference} className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{v.reference}</h2>
            <p className="text-xl whitespace-pre-line">{v.text}</p>
          </section>
        ))}
      </div>
    );
  }
  if (!view || !entry)
    return <p className="p-4 text-muted">{t("follow.nothing")}</p>;
  const title = entry.title && titleFor(entry.title, languages);
  // Blank, or a page on the screens: the song's title at most.
  if (view.blank || view.page)
    return title ? (
      <h2 className="p-4 text-center text-2xl font-semibold">{title}</h2>
    ) : null;
  if (entry.kind === "bible" && entry.bible)
    return (
      <p className="p-4 text-center text-2xl font-semibold">
        {formatReference(entry.bible, languages[0] ?? "ro")}
      </p>
    );
  if (entry.kind === "text")
    return (
      <div className="flex flex-col gap-2 p-4">
        <Markdown text={entry.text ?? ""} />
      </div>
    );
  // A slides page across the phone's width, which its zoom enlarges,
  // in the middle of the screen.
  if (entry.kind === "slides")
    return (
      <div className="flex flex-1 items-center">
        <SlidePage
          files={entry.slides ?? []}
          languages={languages}
          slide={view.slide}
          alt={entry.text ?? ""}
          className="w-full"
        />
      </div>
    );
  if (!song || song.id !== entry.songId) return <Placeholder lines={8} />;
  return (
    <SongParts
      song={song}
      slide={view.slide}
      languages={languages}
      next={view.next && titleFor(view.next, languages)}
    />
  );
}

/** Every part, the live one in view and the next marked; both languages line under line. */
function SongParts({
  song,
  slide,
  languages,
  next,
}: {
  song: Song;
  slide: number;
  languages: string[];
  next: string | null;
}) {
  const { t } = useTranslation();
  const partName = usePartName();
  const versions = languages
    .map((l) => song.versions.find((v) => v.language === l))
    .filter((v) => v !== undefined);
  const chosen = versions.length > 0 ? versions : song.versions.slice(0, 1);
  const texts = chosen.map((v) => parseSong(v.text).slides);
  const [slides = []] = texts;
  const labels = partLabels(slides);
  const live = Math.min(slide, slides.length - 1);
  const title = titleFor(
    Object.fromEntries(song.versions.map((v) => [v.language, v.title])),
    languages,
  );
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [live, song.id]);
  const lines = (s: Slide | undefined) =>
    (s?.lines ?? [])
      .filter((l) => !l.chordsOnly)
      .map((l) => lettersOnly(l.text.replace(/~/g, " ")).trimEnd());

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      <h2 className="text-[1.4em] font-semibold">{title}</h2>
      <div
        ref={list}
        role="list"
        aria-label={t("vocalists.parts")}
        className="flex flex-col gap-3"
      >
        {slides.map((s, i) => {
          const first = lines(s);
          const others = texts.slice(1).map((other) => lines(other[i]));
          return (
            <PartBox key={i} active={i === live} next={i === live + 1}>
              <p className="text-[0.8em] font-semibold text-chord">
                {partName(s, labels[i] ?? "")}
              </p>
              <div className={s.type === "refrain" ? "italic" : undefined}>
                {first.map((line, j) => (
                  <div key={j} className="mb-[0.2em]">
                    <p>{line || " "}</p>
                    {others.map((other, k) =>
                      other[j] ? (
                        <p key={k} className="text-muted">
                          {other[j]}
                        </p>
                      ) : null,
                    )}
                  </div>
                ))}
              </div>
            </PartBox>
          );
        })}
      </div>
      {next && (
        <p className="text-muted">{t("follow.next", { title: next })}</p>
      )}
    </div>
  );
}

/** The follow-along link as a QR code in a corner of a projected page. */
export function FollowQr({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const link = `${location.host}/${slug}`;
  return (
    <div className="absolute right-[3cqmin] bottom-[3cqmin] flex flex-col items-center gap-[0.5cqmin] rounded-[1cqmin] bg-white p-[1cqmin] text-[2cqmin] text-black">
      <img
        src={toSvgDataURL(generate(`${location.origin}/${slug}`), {
          on: "black",
          off: "white",
          pad: 1,
        })}
        alt={t("follow.qr")}
        className="size-[16cqmin]"
      />
      <span>{link}</span>
    </div>
  );
}
