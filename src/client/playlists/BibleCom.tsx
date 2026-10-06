import { BookOpen, Download, ListMusic, X } from "lucide-react";
import { Button, Modal } from "@heroui/react";
import { useEffect, useEffectEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LiveView } from "../../server/live/live-view";
import { slideHtml } from "../../shared/bible-com";
import { titleFor } from "../../shared/song-render";
import { parseSong } from "../../shared/song-text";
import type { Verse } from "../../shared/live";
import { useCommunity } from "../data/community";
import { sendLive } from "../data/room";
import { Choice } from "../ui/choice";

/** The "Project verses from bible.com" extension, by Nicolae Matei. */
const EXTENSION = "fklnkmnlobkpoiifnbnemdpamheoanpj";

type Answer = { status: number; windows?: number[] };
/** A connection the extension keeps open to post what it projects. */
type Port = {
  onMessage: { addListener: (listener: (message: unknown) => void) => void };
  onDisconnect: { addListener: (listener: () => void) => void };
  disconnect: () => void;
};
type Runtime = {
  sendMessage?: (id: string, message: object) => Promise<Answer>;
  connect?: (id: string, info: { name: string }) => Port;
};
const runtime = () =>
  (globalThis as { chrome?: { runtime?: Runtime } }).chrome?.runtime;

/** Where to install it. */
const STORE = `https://chromewebstore.google.com/detail/${EXTENSION}`;

/**
 * Sends the extension an action. Null when the browser can't reach it: no extension, or
 * one that doesn't accept messages from this site.
 */
async function ask(action: string, payload?: object): Promise<Answer | null> {
  const chrome = runtime();
  if (!chrome?.sendMessage) return null;
  return chrome.sendMessage(EXTENSION, { action, payload }).catch(() => null);
}

/**
 * A verse the extension projects, as Norless asks Nicolae's
 * extension to post it on the connection Norless opens: `{ action: "verse", payload:
 * { index, reference, text } }`, or `reference: null` when the window is cleared.
 */
type Projected = {
  action: "verse";
  payload: { index: number; reference: string | null; text?: string };
};
const isProjected = (message: unknown): message is Projected =>
  (message as Projected | null)?.action === "verse" &&
  typeof (message as Projected).payload?.index === "number";

/** Which bible.com projection windows each language goes to, on this device. */
type Target = "none" | "1" | "2" | "all";
type Mapping = Record<string, Target>;
const indexes = (target: Target | undefined) =>
  target === "all" ? [1, 2] : target === "1" || target === "2" ? [+target] : [];

const storageKey = (slug: string) => `norless:bible-com:${slug}`;
const readMapping = (slug: string): Mapping => {
  try {
    return JSON.parse(
      localStorage.getItem(storageKey(slug)) ?? "{}",
    ) as Mapping;
  } catch {
    return {};
  }
};
const changed = new EventTarget();
function useMapping(slug: string) {
  const [mapping, setMapping] = useState(() => readMapping(slug));
  useEffect(() => {
    const reload = () => setMapping(readMapping(slug));
    changed.addEventListener("change", reload);
    return () => changed.removeEventListener("change", reload);
  }, [slug]);
  const save = (next: Mapping) => {
    try {
      localStorage.setItem(storageKey(slug), JSON.stringify(next));
    } catch {
      // Kept until the page reloads.
    }
    setMapping(next);
    changed.dispatchEvent(new Event("change"));
  };
  return [mapping, save] as const;
}

/** Windows showing a page, to clear before text goes back. */
const framed = new Set<number>();

/** Sends what's live to the mapped windows; the problems, as messages. */
async function push(
  view: LiveView,
  mapping: Mapping,
  languages: string[],
): Promise<{ index: number; status: number; all: boolean }[]> {
  const { entry, song } = view;
  // A Bible reference, or a verse that came from bible.com, leaves the windows as they are.
  if (view.verse && !view.blank) return [];
  if (!view.blank && !view.page && (!entry || entry.bible)) return [];
  const sent = new Set<number>();
  const results: { index: number; status: number; all: boolean }[] = [];
  for (const language of languages) {
    for (const index of indexes(mapping[language])) {
      // One language per window: the first mapped to it.
      if (sent.has(index)) continue;
      sent.add(index);
      const send = async (action: string, payload: object) => {
        const answer = await ask(action, { index, ...payload });
        results.push({
          index,
          status: answer?.status ?? 0,
          all: mapping[language] === "all",
        });
      };
      if (view.page && !view.blank) {
        framed.add(index);
        await send("updateFrame", { url: view.page.url });
        continue;
      }
      if (framed.delete(index)) await send("updateFrame", { url: "" });
      if (view.blank) await send("updateText", { text: "", markdown: false });
      else if (entry?.kind === "text")
        await send("updateText", { text: entry.text ?? "", markdown: true });
      else if (song) {
        const order = [language, ...languages];
        const version =
          order
            .map((l) => song.versions.find((v) => v.language === l))
            .find(Boolean) ?? song.versions[0];
        const slides = version ? parseSong(version.text).slides : [];
        const title = titleFor(
          Object.fromEntries(song.versions.map((v) => [v.language, v.title])),
          order,
        );
        await send("updateText", {
          text: slideHtml({
            slides,
            // A translation with fewer slides shows its last one.
            index: Math.min(view.slide, slides.length - 1),
            keySignature: entry?.keySignature || song.keySignature,
            title,
          }),
          markdown: false,
        });
      }
    }
  }
  return results;
}

/**
 * Keeps the bible.com projection windows mapped on this device in step with what's
 * live, says when a window didn't take it, and sends the verses projected from bible.com
 * to Norless's screens, one language per window as mapped.
 */
export function BibleComSync({ view }: { view: LiveView | undefined }) {
  const { t } = useTranslation();
  const community = useCommunity();
  const [mapping] = useMapping(community.slug);
  const [problem, setProblem] = useState<string | null>(null);
  const [status, setStatus] = useState<Answer | null>();
  const mapped = community.languages.some((l) => indexes(mapping[l]).length);
  const shown = view && [
    view.entryId,
    view.slide,
    view.blank,
    view.page?.url ?? null,
    !!view.verse,
    view.song?.updatedAt ?? null,
  ];
  const key = JSON.stringify([shown, mapping]);
  useEffect(() => {
    if (!view || !mapped) return;
    void push(view, mapping, community.languages).then((results) => {
      // A window turned off in the extension is fine when it's one of "all windows".
      const failed = results.find(
        (r) => r.status !== 200 && !(r.all && r.status === 404),
      );
      setProblem(
        !failed
          ? null
          : failed.status === 404
            ? t("bibleCom.openWindow", { n: failed.index })
            : failed.status === 0
              ? t("bibleCom.unavailable")
              : t("bibleCom.failed", { status: failed.status }),
      );
    });
    // Sent again only when what the windows show changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, mapped]);

  // Whether the extension answers, and, when it tells, which windows it has open.
  useEffect(() => {
    if (!mapped) return;
    void ask("status").then(async (answer) =>
      setStatus(answer?.status === 200 ? answer : await ask("help")),
    );
  }, [mapped]);

  // Verses from the extension: the windows' languages, merged while they come together.
  const received = useEffectEvent((message: unknown) => {
    if (!isProjected(message)) return;
    const { index, reference, text = "" } = message.payload;
    const language = community.languages.find((l) =>
      indexes(mapping[l]).includes(index),
    );
    if (!language) return;
    if (reference === null) {
      if (view?.verse?.[language])
        void sendLive(community.slug, { type: "verse", verse: null });
      return;
    }
    const recent = Date.now() - latest.at < 10_000;
    latest.verse = {
      ...(recent ? latest.verse : {}),
      [language]: { reference, text },
    };
    latest.at = Date.now();
    void sendLive(community.slug, { type: "verse", verse: latest.verse });
  });
  useEffect(() => {
    if (!mapped) return;
    let port: Port | null = null;
    try {
      port = runtime()?.connect?.(EXTENSION, { name: "norless" }) ?? null;
    } catch {
      port = null;
    }
    port?.onMessage.addListener((message) => received(message));
    return () => port?.disconnect();
  }, [mapped]);

  if (!mapped) return null;
  return (
    <div className="flex flex-col gap-1">
      {view?.verse && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="flex items-center gap-1 font-semibold">
            <BookOpen aria-hidden className="size-4" />
            {t("bibleCom.verse", {
              reference: Object.values(view.verse)
                .map((v) => v.reference)
                .join(" · "),
            })}
          </span>
          <Button
            size="sm"
            variant="secondary"
            onPress={() =>
              void sendLive(community.slug, { type: "verse", verse: null })
            }
          >
            <ListMusic />
            {t("bibleCom.back")}
          </Button>
        </div>
      )}
      {problem ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {problem}
        </p>
      ) : (
        // Steady: the line is there while the extension is asked.
        <p className="flex min-h-5 flex-wrap items-center gap-2 text-sm text-muted">
          {status === undefined
            ? ""
            : status === null
              ? t("bibleCom.notConnected")
              : status.windows?.length
                ? t("bibleCom.connectedWindows", {
                    windows: status.windows.join(", "),
                  })
                : t("bibleCom.connected")}
          {status === null && (
            <a className="link" href={STORE} target="_blank" rel="noreferrer">
              <Download />
              {t("bibleCom.install")}
            </a>
          )}
        </p>
      )}
    </div>
  );
}

/** The verse sent last, so the other window's language joins it. */
const latest: { verse: Verse; at: number } = { verse: {}, at: 0 };

/** Whether the extension is there, and the window each language goes to on this device. */
export function BibleComSettings({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const community = useCommunity();
  const [mapping, save] = useMapping(community.slug);
  const [available, setAvailable] = useState<boolean>();
  useEffect(() => {
    void ask("help").then((answer) => setAvailable(answer?.status === 200));
  }, []);
  const names = new Intl.DisplayNames([i18n.language], { type: "language" });
  const options = [
    { id: "none", name: t("bibleCom.none") },
    { id: "1", name: t("bibleCom.window", { n: 1 }) },
    { id: "2", name: t("bibleCom.window", { n: 2 }) },
    { id: "all", name: t("bibleCom.all") },
  ];
  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t("bibleCom.title")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <p
              role="status"
              className={`text-sm ${available === false ? "text-danger" : "text-muted"}`}
            >
              {available === undefined
                ? ""
                : t(available ? "bibleCom.available" : "bibleCom.unavailable")}
            </p>
            {community.languages.map((language) => (
              <Choice
                key={language}
                label={names.of(language) ?? language}
                value={mapping[language] ?? "none"}
                onChange={(target) =>
                  save({ ...mapping, [language]: target as Target })
                }
                options={options}
              />
            ))}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("editor.close")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
