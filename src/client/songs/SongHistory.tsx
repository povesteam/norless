import { History, Undo2 } from "lucide-react";
import { diffLines } from "diff";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReferenceLink, Song } from "../../server/songs/songs";
import type { Revision } from "../../server/songs/song-history";
import { send, useJson } from "../data/fetch";
import {
  ActionButton,
  ErrorNotice,
  Placeholder,
  usePending,
} from "../ui/states";

type State = Pick<
  Revision,
  | "keySignature"
  | "timeSignature"
  | "tags"
  | "bpm"
  | "authors"
  | "copyright"
  | "sourceUrl"
  | "referenceLinks"
  | "versions"
>;

/**
 * A song's saves, newest first: who, when, and what changed, as the state before each
 * save against the one after it. Editors and owners restore the state before a save.
 */
export function SongHistory({
  slug,
  song,
  canRestore,
  onRestored,
}: {
  slug: string;
  song: Song;
  canRestore: boolean;
  onRestored: () => void;
}) {
  const { t, i18n } = useTranslation();
  // Opened from the song's ⋯ menu, it comes into view.
  const section = useRef<HTMLElement>(null);
  useEffect(() => section.current?.scrollIntoView({ block: "start" }), []);
  // Loaded again after each save of the song, here or elsewhere.
  const { data, failed, retry } = useJson<Revision[]>(
    `/api/communities/${slug}/songs/${song.id}/revisions?at=${encodeURIComponent(song.updatedAt)}`,
  );
  const [notRestored, setNotRestored] = useState(false);
  const [restore, restoring] = usePending(async (id: string) => {
    if (!window.confirm(t("history.confirmRestore"))) return;
    const response = await send(
      "POST",
      `/api/communities/${slug}/songs/${song.id}/revisions/${id}/restore`,
    );
    setNotRestored(!response?.ok);
    if (response?.ok) onRestored();
  });

  return (
    <section ref={section} className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <History />
        {t("history.title")}
      </h3>
      {notRestored && <ErrorNotice message={t("history.notRestored")} />}
      {data === undefined ? (
        failed ? (
          <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
        ) : (
          <Placeholder lines={4} />
        )
      ) : !data || data.length === 0 ? (
        <p className="text-muted">{t("history.empty")}</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {data.map((revision, i) => (
            <li
              key={revision.id}
              className="flex flex-col gap-2 border-s-2 border-separator ps-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {t("history.saved", {
                    name: revision.savedBy ?? t("history.someone"),
                    when: new Date(revision.savedAt).toLocaleString(
                      i18n.language,
                      {
                        dateStyle: "medium",
                        timeStyle: "short",
                        hourCycle: "h23",
                      },
                    ),
                  })}
                </p>
                {canRestore && (
                  <ActionButton
                    size="sm"
                    variant="secondary"
                    isPending={restoring}
                    onPress={() => void restore(revision.id)}
                  >
                    <Undo2 />
                    {t("history.restore")}
                  </ActionButton>
                )}
              </div>
              <Changes before={revision} after={data[i - 1] ?? song} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** What a save changed: the song's fields, and the lines of each language's text. */
function Changes({ before, after }: { before: State; after: State }) {
  const { t, i18n } = useTranslation();
  const none = t("history.none");
  const show = (value: string | number | null) =>
    value === null || value === "" ? none : String(value);
  const fields = [
    before.keySignature !== after.keySignature &&
      t("history.key", {
        from: show(before.keySignature),
        to: show(after.keySignature),
      }),
    before.timeSignature !== after.timeSignature &&
      t("history.time", {
        from: show(before.timeSignature),
        to: show(after.timeSignature),
      }),
    before.bpm !== after.bpm &&
      t("history.tempo", { from: show(before.bpm), to: show(after.bpm) }),
    before.authors !== after.authors &&
      t("history.authors", {
        from: show(before.authors),
        to: show(after.authors),
      }),
    before.copyright !== after.copyright &&
      t("history.copyright", {
        from: show(before.copyright),
        to: show(after.copyright),
      }),
    before.sourceUrl !== after.sourceUrl &&
      t("history.source", {
        from: show(before.sourceUrl),
        to: show(after.sourceUrl),
      }),
    // Revisions from before links were kept say nothing about them.
    before.referenceLinks &&
      after.referenceLinks &&
      linksOf(before.referenceLinks) !== linksOf(after.referenceLinks) &&
      t("history.links", {
        from: show(linksOf(before.referenceLinks)),
        to: show(linksOf(after.referenceLinks)),
      }),
    before.tags.join(", ") !== after.tags.join(", ") &&
      t("history.tags", {
        from: show(before.tags.join(", ")),
        to: show(after.tags.join(", ")),
      }),
  ].filter((f) => typeof f === "string");
  const names = new Intl.DisplayNames([i18n.language], { type: "language" });
  const languages = [
    ...new Set([...before.versions, ...after.versions].map((v) => v.language)),
  ];
  return (
    <div className="flex flex-col gap-2 text-sm">
      {fields.map((field) => (
        <p key={field}>{field}</p>
      ))}
      {languages.map((language) => {
        const from = before.versions.find((v) => v.language === language);
        const to = after.versions.find((v) => v.language === language);
        const name = names.of(language) ?? language;
        return (
          <div key={language} className="flex flex-col gap-1">
            {from?.title !== to?.title && (
              <p>
                {t("history.titleIn", {
                  language: name,
                  from: show(from?.title ?? null),
                  to: show(to?.title ?? null),
                })}
              </p>
            )}
            {from?.text !== to?.text && (
              <>
                <p>{t("history.textIn", { language: name })}</p>
                <TextDiff from={from?.text ?? ""} to={to?.text ?? ""} />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

const marked = (lines: string, sign: string) =>
  lines
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => `${sign} ${line}\n`)
    .join("");

/** The removed and added lines, the unchanged ones left out. */
export function TextDiff({ from, to }: { from: string; to: string }) {
  return (
    <pre className="rounded-lg bg-surface-secondary p-2 font-mono whitespace-pre-wrap [overflow-wrap:anywhere]">
      {diffLines(from, to).map((part, i) =>
        part.added ? (
          <ins key={i} className="bg-success-soft text-foreground no-underline">
            {marked(part.value, "+")}
          </ins>
        ) : part.removed ? (
          <del key={i} className="bg-danger-soft text-foreground">
            {marked(part.value, "−")}
          </del>
        ) : (
          <span key={i} className="text-muted">
            {"…\n"}
          </span>
        ),
      )}
    </pre>
  );
}

/** Links as History names them: their titles, else their addresses. */
const linksOf = (links: ReferenceLink[]) =>
  links.map((l) => l.title || l.url).join(", ");
