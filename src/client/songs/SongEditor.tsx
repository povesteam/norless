import { Save, X } from "lucide-react";
import {
  Button,
  Description,
  Input,
  Label,
  Tabs,
  TextArea,
  TextField,
} from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import type { Conflict, Song } from "../../server/songs/songs";
import { useCommunity, useShows } from "../data/community";
import { LayoutPicker, useLayout } from "../data/device";
import { useLayoutShown } from "../data/usage";
import {
  ConflictView,
  HeldBy,
  SmallSlides,
  UnclosedRepeats,
  useSaveShortcut,
  useSongLock,
  useUnsavedGuard,
} from "../data/editing";
import { send, useJson } from "../data/fetch";
import { LanguageMark } from "../ui/icons";
import { NotFound } from "../app/NotFound";
import {
  ActionButton,
  ErrorNotice,
  Placeholder,
  usePending,
} from "../ui/states";
import { TagsField } from "./TagsField";
import { SideBySide } from "./SideBySide";

export type Draft = {
  keySignature: string;
  timeSignature: string;
  tags: string[];
  authors: string;
  copyright: string;
  sourceUrl: string;
  /** Per community language; a version is saved once it has a title. */
  versions: Record<string, { title: string; text: string }>;
};

const draftOf = (song: Song | null, languages: string[]): Draft => ({
  keySignature: song?.keySignature ?? "",
  timeSignature: song?.timeSignature ?? "",
  tags: song?.tags ?? [],
  authors: song?.authors ?? "",
  copyright: song?.copyright ?? "",
  sourceUrl: song?.sourceUrl ?? "",
  versions: Object.fromEntries(
    languages.map((language) => {
      const v = song?.versions.find((x) => x.language === language);
      // The words only: chords live in the track, edited in the Chords mode.
      return [language, { title: v?.title ?? "", text: v?.lyrics ?? "" }];
    }),
  ),
});

/** One language at a time, or two side by side on wider screens. */
const editorLayouts = [
  { id: "side-by-side", devices: ["tablet", "laptop"], feature: "sideBySide" },
  { id: "one", devices: ["phone", "tablet", "laptop"] },
] as const;

/**
 * /songs/:id/edit: loads the song, then edits it. With `onClose`, it's in a column of
 * another page, such as the playlist's middle column during a service.
 */
export function SongEditPage({
  id,
  onClose,
}: {
  id: string;
  onClose?: () => void;
}) {
  const { slug } = useCommunity();
  const { t } = useTranslation();
  const {
    data: song,
    failed,
    retry,
  } = useJson<Song>(`/api/communities/${slug}/songs/${encodeURIComponent(id)}`);
  if (song === undefined)
    return failed ? (
      <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
    ) : (
      <Placeholder lines={12} />
    );
  if (song === null || song.deletedAt) return <NotFound />;
  return <SongEditor song={song} onClose={onClose} />;
}

/**
 * The whole song: key, time signature, tags, and a title and text per language.
 * Ctrl/Cmd+S saves and keeps it open; closing with unsaved changes asks first.
 */
export function SongEditor({
  song: initial,
  onClose,
  onCreated,
  title,
}: {
  song: Song | null;
  onClose?: () => void;
  /**
   * A new song was saved for the first time; it stays open here. Its Save button says
   * where the song goes, e.g. "Save and add to playlist".
   */
  onCreated?: { label: string; run: (id: string) => void };
  /** A new song's title in a language, e.g. what was typed in the search box. */
  title?: { language: string; text: string };
}) {
  const { t } = useTranslation();
  const { slug, languages } = useCommunity();
  const [, navigate] = useLocation();
  const tags = useJson<{ tag: string }[]>(`/api/communities/${slug}/tags`).data;
  const [song, setSong] = useState(initial);
  const firstTab =
    title && languages.includes(title.language) ? title.language : languages[0];
  // A typed title isn't a change to discard: closing asks nothing.
  const [saved, setSaved] = useState(() => {
    const draft = draftOf(initial, languages);
    if (title && firstTab)
      draft.versions[firstTab] = { title: title.text, text: "" };
    return draft;
  });
  const [draft, setDraft] = useState(saved);
  const shows = useShows();
  const badSource =
    draft.sourceUrl.trim() !== "" &&
    !/^https:\/\/\S+$/.test(draft.sourceUrl.trim());
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  // Why the last save didn't happen; the draft stays as typed.
  const [problem, setProblem] = useState<"needsTitle" | "notSaved" | null>(
    null,
  );
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  // One editor per song: while someone else edits it, this one is read-only.
  const { holder } = useSongLock(song?.id ?? null, draft);
  const { layout, setLayout } = useLayout("song-editor", editorLayouts);
  useLayoutShown("song-editor", layout?.id);
  useUnsavedGuard(dirty);
  // A new song starts with its title; a frame later, after a closing menu has given
  // the focus back to its button.
  const titleInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (initial) return;
    const frame = requestAnimationFrame(() => titleInput.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [initial]);

  const setVersion = (
    language: string,
    field: "title" | "text",
    value: string,
  ) =>
    setDraft((d) => ({
      ...d,
      versions: {
        ...d.versions,
        [language]: {
          title: "",
          text: "",
          ...d.versions[language],
          [field]: value,
        },
      },
    }));

  const [save, saving] = usePending(
    async (bases: Record<string, string> = {}) => {
      const versions = Object.entries(draft.versions)
        .filter(([, v]) => v.title.trim() !== "")
        .map(([language, v]) => ({
          language,
          ...v,
          baseText:
            bases[language] ??
            song?.versions.find((x) => x.language === language)?.lyrics,
        }));
      if (versions.length === 0) return setProblem("needsTitle");
      const body = { ...draft, versions };
      const response = song
        ? await send("PUT", `/api/communities/${slug}/songs/${song.id}`, body)
        : await send("POST", `/api/communities/${slug}/songs`, body);
      if (response?.status === 409) {
        setProblem(null);
        setConflict(
          ((await response.json()) as { conflict: Conflict }).conflict,
        );
        return;
      }
      if (!response?.ok) return setProblem("notSaved");
      const next = (await response.json()) as Song;
      setProblem(null);
      setConflict(null);
      setSong(next);
      setSaved(draft);
      setJustSaved(true);
      if (!song && onCreated) onCreated.run(next.id);
      else if (!song) navigate(`/songs/${next.id}/edit`, { replace: true });
    },
  );
  useSaveShortcut(() => void save());

  const close = () => {
    if (dirty && !window.confirm(t("editor.discard"))) return;
    if (onClose) onClose();
    else navigate(song ? `/songs/${song.id}` : "/");
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">
        {song ? t("editor.editSong") : t("editor.newSong")}
      </h2>
      {problem === "needsTitle" && (
        <ErrorNotice message={t("editor.needsTitle")} />
      )}
      {problem === "notSaved" && (
        <ErrorNotice
          message={t("editor.notSaved")}
          onRetry={() => void save()}
        />
      )}
      {holder && <HeldBy name={holder.name} />}
      {conflict && (
        <ConflictView
          theirs={conflict.theirs}
          mine={conflict.mine}
          onKeepMine={() =>
            void save({ [conflict.language]: conflict.theirs ?? "" })
          }
          onUseTheirs={() => {
            setVersion(conflict.language, "text", conflict.theirs ?? "");
            setConflict(null);
          }}
        />
      )}
      {/* How it's laid out is this device's own choice, even while read-only. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span />
        <LayoutPicker
          layouts={editorLayouts}
          layout={layout?.id ?? "one"}
          onChange={setLayout}
          label={t("editor.layout")}
          names={(l) => t(`editor.layouts.${l}`)}
        />
      </div>
      <fieldset disabled={!!holder} className="contents">
        {layout?.id === "side-by-side" ? (
          <SideBySide
            versions={draft.versions}
            saved={song?.versions.map((v) => v.language) ?? []}
            onChange={setVersion}
          />
        ) : (
          <Tabs defaultSelectedKey={firstTab}>
            <Tabs.ListContainer>
              <Tabs.List aria-label={t("song.language")}>
                {languages.map((language) => (
                  <Tabs.Tab key={language} id={language}>
                    <LanguageMark language={language} />
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
            {languages.map((language) => (
              <Tabs.Panel
                key={language}
                id={language}
                className="flex flex-col gap-4 pt-4"
              >
                <TextField
                  value={draft.versions[language]?.title ?? ""}
                  onChange={(value) => setVersion(language, "title", value)}
                >
                  <Label>{t("editor.title")}</Label>
                  <Input ref={language === firstTab ? titleInput : undefined} />
                </TextField>
                <TextField
                  value={draft.versions[language]?.text ?? ""}
                  onChange={(value) => setVersion(language, "text", value)}
                >
                  <Label>{t("editor.text")}</Label>
                  {/* Chords sit over lyrics by column, so the text is monospace. */}
                  {/* Room for two verses when empty; it grows with the text. */}
                  <TextArea className="min-h-[14lh] field-sizing-content font-mono" />
                  <Description>{t("editor.textHelp")}</Description>
                </TextField>
                <UnclosedRepeats text={draft.versions[language]?.text ?? ""} />
                <SmallSlides text={draft.versions[language]?.text ?? ""} />
              </Tabs.Panel>
            ))}
          </Tabs>
        )}
      </fieldset>
      {/* The fields every language shares, after the title and text. */}
      <fieldset disabled={!!holder} className="contents">
        <div className="grid grid-cols-2 gap-4">
          <TextField
            value={draft.keySignature}
            onChange={(value) => setDraft({ ...draft, keySignature: value })}
          >
            <Label>{t("editor.key")}</Label>
            <Input />
          </TextField>
          <TextField
            value={draft.timeSignature}
            onChange={(value) => setDraft({ ...draft, timeSignature: value })}
          >
            <Label>{t("editor.time")}</Label>
            <Input />
          </TextField>
        </div>
        <TagsField
          tags={draft.tags}
          known={tags?.map((x) => x.tag) ?? []}
          onChange={(value) => setDraft({ ...draft, tags: value })}
        />
        {shows("credits") && (
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              value={draft.authors}
              onChange={(value) => setDraft({ ...draft, authors: value })}
              maxLength={300}
            >
              <Label>{t("editor.authors")}</Label>
              <Input />
            </TextField>
            <TextField
              value={draft.copyright}
              onChange={(value) => setDraft({ ...draft, copyright: value })}
              maxLength={300}
            >
              <Label>{t("editor.copyright")}</Label>
              <Input />
            </TextField>
            <TextField
              value={draft.sourceUrl}
              onChange={(value) => setDraft({ ...draft, sourceUrl: value })}
              isInvalid={badSource}
              maxLength={500}
            >
              <Label>{t("editor.source")}</Label>
              <Input type="url" inputMode="url" placeholder="https://" />
              <Description>{t("editor.sourceHelp")}</Description>
            </TextField>
          </div>
        )}
      </fieldset>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted" aria-live="polite">
          {justSaved && !dirty ? t("editor.saved") : ""}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onPress={close}>
            <X />
            {t("editor.close")}
          </Button>
          <ActionButton
            isPending={saving}
            isDisabled={badSource || !!holder}
            onPress={() => void save()}
          >
            <Save />
            {!song && onCreated ? onCreated.label : t("editor.save")}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
