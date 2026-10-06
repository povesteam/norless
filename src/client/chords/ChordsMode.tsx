import { FileMusic, Save, X } from "lucide-react";
import { Alert, Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation, useSearchParams } from "wouter";
import type { Conflict, Song } from "../../server/songs/songs";
import {
  chordsAt,
  keyOf,
  setBeats,
  setChords,
  type Key,
} from "../../shared/music/chords";
import { chordColors } from "../../shared/music/music";
import {
  followed,
  followers,
  lyricSections,
  mergeText,
  type Music as Track,
  musicFromText,
} from "../../shared/music/chord-track";
import type { Heard } from "../../shared/music/chord-detect";
import { lettersOnly } from "../../shared/song-render";
import { setBlock } from "../../shared/music/notation";
import { parseSong, partLabels } from "../../shared/song-text";
import { useChordColors, useCommunity, useShows } from "../data/community";
import {
  ConflictView,
  HeldBy,
  useSaveShortcut,
  useSongLock,
  useUnsavedGuard,
} from "../data/editing";
import { ReferenceLinksField } from "../songs/ReferenceLinks";
import { send, useJson } from "../data/fetch";
import { usePartName } from "../stage/parts";
import { hasRole, useRoles } from "../data/me";
import { NotationDialog, pianoTemplate } from "./Notation";
import { NotFound } from "../app/NotFound";
import { PlayPanel } from "./PlayChords";
import {
  ActionButton,
  ErrorNotice,
  Placeholder,
  usePending,
} from "../ui/states";
import { ChordPicker, type Target } from "./ChordPicker";
import { TappableText } from "./TappableText";
import { Tempo } from "./Tempo";

/** Who may add chords, notes and tempo: the team and editors (owners too). */
export const useCanEditChords = (slug: string) => {
  const roles = useRoles(slug);
  return hasRole(roles, "team") || hasRole(roles, "editor");
};

const keyName = (key: Key) => `${key.tonic}${key.minor ? "m" : ""}`;

/** /songs/:id/chords: the Chords mode, in the language of `?language=`. */
export function ChordsPage({ id }: { id: string }) {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const shows = useShows();
  const canEdit = useCanEditChords(slug);
  const [params] = useSearchParams();
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
  if (!song || song.deletedAt || !shows("chords") || !canEdit)
    return <NotFound />;
  return (
    <ChordsEditor song={song} language={params.get("language") ?? undefined} />
  );
}

function ChordsEditor({
  song,
  language: initialLanguage,
}: {
  song: Song;
  language?: string;
}) {
  const { t, i18n } = useTranslation();
  const { slug } = useCommunity();
  const [, navigate] = useLocation();
  const [language, setLanguage] = useState(
    () =>
      song.versions.find((v) => v.language === initialLanguage)?.language ??
      song.versions[0]?.language ??
      "",
  );
  const version = song.versions.find((v) => v.language === language);
  // One track for every language; the text shown is built from it.
  const lyrics = version?.lyrics ?? "";
  const [base, setBase] = useState<Track>(song.music);
  const [music, setMusic] = useState<Track>(song.music);
  const text = mergeText(lyrics, music);
  const sections = lyricSections(lyrics);
  // Parts whose chords change only there, chosen in the chord picker.
  const [only, setOnly] = useState<ReadonlySet<string>>(new Set());
  /** An edit of the text shown, into the track. */
  const edit = (next: string, scope = only) =>
    setMusic(musicFromText(music, lyrics, next, (key) => scope.has(key)));
  const [savedBpm, setSavedBpm] = useState(song.bpm);
  const [bpm, setBpm] = useState(song.bpm);
  const [savedLinks, setSavedLinks] = useState(song.referenceLinks);
  const [links, setLinks] = useState(savedLinks);
  const linksChanged = JSON.stringify(links) !== JSON.stringify(savedLinks);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [problem, setProblem] = useState<"notSaved" | "refused" | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [notating, setNotating] = useState<{
    section: number;
    block: number | null;
  } | null>(null);
  const shows = useShows();
  const partName = usePartName();
  const musicChanged = JSON.stringify(music) !== JSON.stringify(base);
  const dirty = musicChanged || bpm !== savedBpm || linksChanged;
  useUnsavedGuard(dirty);
  const { holder } = useSongLock(song.id, [text, bpm, links]);
  const back = `/songs/${song.id}`;

  /** The track as the server has it now, after a conflict. */
  const latest = async () => {
    const response = await fetch(
      `/api/communities/${slug}/songs/${song.id}`,
    ).catch(() => null);
    return response?.ok ? ((await response.json()) as Song).music : null;
  };
  const [save, saving] = usePending(async (from: Track = base) => {
    if (musicChanged || from !== base) {
      const response = await send(
        "PUT",
        `/api/communities/${slug}/songs/${song.id}/music`,
        { base: from, music },
      );
      if (response?.status === 409) {
        setConflict(
          ((await response.json()) as { conflict: Conflict }).conflict,
        );
        return false;
      }
      setProblem(
        response?.status === 400 ? "refused" : response?.ok ? null : "notSaved",
      );
      if (!response?.ok) return false;
      setConflict(null);
      setBase(music);
    }
    if (bpm !== savedBpm) {
      const response = await send(
        "PUT",
        `/api/communities/${slug}/songs/${song.id}/tempo`,
        { bpm },
      );
      setProblem(response?.ok ? null : "notSaved");
      if (!response?.ok) return false;
      setSavedBpm(bpm);
    }
    if (linksChanged) {
      const response = await send(
        "PUT",
        `/api/communities/${slug}/songs/${song.id}/reference-links`,
        { links },
      );
      setProblem(response?.ok ? null : "notSaved");
      if (!response?.ok) return false;
      setSavedLinks(links);
    }
    return true;
  });
  useSaveShortcut(() => void save());

  const close = () => {
    if (dirty && !window.confirm(t("editor.discard"))) return;
    navigate(back);
  };
  // The track is every language's: switching keeps what was changed.
  const switchLanguage = (next: string) => setLanguage(next);

  const key = keyOf(song.keySignature);
  // In the member's chord colors, as in the musicians view (decision review).
  const color = useChordColors(useCommunity())
    ? (chord: string) => chordColors(chord, key)
    : undefined;
  const names = new Intl.DisplayNames([i18n.language], { type: "language" });
  // What a microphone or the mixer hears, offered in the chord picker.
  const [heard, setHeard] = useState<Heard | null | undefined>(undefined);
  const holding = useRef<(() => string | null) | null>(null);
  /** A chord over the letter tapped, or the tapped chord changed or removed. */
  const pick = (name: string | null) => target && place(target, name);
  const place = (target: Target, name: string | null) => {
    const chords = chordsAt(text, target.row);
    if (target.index !== null) {
      if (name === null) chords.splice(target.index, 1);
      else {
        const chord = chords[target.index];
        if (chord) chord.name = name;
      }
    } else if (name !== null) {
      const others = chords.filter((c) => c.at !== target.at);
      chords.splice(0, chords.length, ...others, { at: target.at, name });
    }
    edit(setChords(text, target.row, chords));
    setTarget(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">
          {t("chords.title", { title: lettersOnly(version?.title ?? "") })}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onPress={close}>
            <X />
            {t("editor.close")}
          </Button>
          <ActionButton
            isPending={saving}
            isDisabled={!dirty || !!holder}
            onPress={() => void save().then((ok) => ok && navigate(back))}
          >
            <Save />
            {t("editor.save")}
          </ActionButton>
        </div>
      </div>
      {holder && <HeldBy name={holder.name} />}
      {problem === "notSaved" && (
        <ErrorNotice
          message={t("editor.notSaved")}
          onRetry={() => void save()}
        />
      )}
      {problem === "refused" && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t("chords.refused")}</Alert.Title>
          </Alert.Content>
        </Alert>
      )}
      {conflict && (
        <ConflictView
          theirs={conflict.theirs}
          mine={conflict.mine}
          onKeepMine={() =>
            void latest().then((theirs) => theirs && save(theirs))
          }
          onUseTheirs={() =>
            void latest().then((theirs) => {
              if (!theirs) return;
              setBase(theirs);
              setMusic(theirs);
              setConflict(null);
            })
          }
        />
      )}
      <fieldset disabled={!!holder} className="contents">
        <div className="flex flex-wrap items-end gap-4">
          {song.versions.length > 1 && (
            <ToggleButtonGroup
              aria-label={t("song.language")}
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[language]}
              onSelectionChange={(keys) => {
                const [next] = keys;
                if (next !== undefined) switchLanguage(String(next));
              }}
            >
              {song.versions.map((v, i) => (
                <ToggleButton key={v.language} id={v.language}>
                  {i > 0 && <ToggleButtonGroup.Separator />}
                  {names.of(v.language) ?? v.language}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
          <Tempo bpm={bpm} onChange={setBpm} />
        </div>
        <p className="text-sm text-muted">{t("chords.hint")}</p>
        {(shows("midiChords") || shows("audioChords")) && (
          <PlayPanel
            songKey={key}
            piano={shows("midiChords")}
            listen={shows("audioChords")}
            // Played on the piano: over the letter tapped, once the keys are let go.
            onPlayed={(chord) => pick(chord)}
            onTake={(take) => {
              holding.current = take;
            }}
            onHeard={setHeard}
          />
        )}
        <TappableText
          text={text}
          color={color}
          // A chord held on the piano goes over the letter tapped at once (decision
          // review); else the picker opens.
          onTap={(tapped) => {
            const held = holding.current?.();
            if (held) place(tapped, held);
            else setTarget(tapped);
          }}
          onMove={(row, index, at) => {
            const chords = chordsAt(text, row);
            const chord = chords[index];
            if (!chord) return;
            chord.at = at;
            edit(setChords(text, row, chords));
          }}
          perBar={Number(song.timeSignature?.split("/")[0]) || 4}
          onBeats={(row, bar, beats) => edit(setBeats(text, row, bar, beats))}
          notation={{
            bpm,
            onEdit: (section, block) => setNotating({ section, block }),
          }}
        />
        <ReferenceLinksField slug={slug} links={links} onChange={setLinks} />
      </fieldset>
      {notating &&
        (() => {
          const { slides } = parseSong(text);
          const slide = slides[notating.section];
          const abc =
            notating.block === null
              ? null
              : (slide?.blocks[notating.block]?.abc ?? null);
          const apply = (next: string | null) => {
            edit(setBlock(text, notating.section, notating.block, next));
            setNotating(null);
          };
          return (
            <NotationDialog
              abc={abc}
              template={pianoTemplate(key && keyName(key), song.timeSignature)}
              meter={song.timeSignature === "3/4" ? "3/4" : "4/4"}
              bpm={bpm}
              part={partName(slide, partLabels(slides)[notating.section] ?? "")}
              onApply={apply}
              onRemove={abc === null ? undefined : () => apply(null)}
              onClose={() => setNotating(null)}
            />
          );
        })()}
      {target &&
        (() => {
          // A part whose chords other parts share: the change goes to all, or only here.
          const at = lyricSections(text).find(
            (s) => target.row >= s.start && target.row <= s.end,
          );
          const section = sections.find((s) => s.key === at?.key);
          const pattern = section ? followed(music, section) : null;
          const shared =
            section &&
            pattern !== null &&
            followers(music, sections, pattern) > 1
              ? section
              : null;
          return (
            <ChordPicker
              target={target}
              text={text}
              songKey={key}
              scope={
                shared && {
                  type: shared.type,
                  only: only.has(shared.key),
                  onChange: (alone) => {
                    const next = new Set(only);
                    if (alone) next.add(shared.key);
                    else next.delete(shared.key);
                    setOnly(next);
                  },
                }
              }
              onMove={
                target.index === null
                  ? undefined
                  : (step) => {
                      const chords = chordsAt(text, target.row);
                      const chord = chords[target.index ?? 0];
                      if (!chord) return;
                      chord.at = Math.max(0, chord.at + step);
                      edit(setChords(text, target.row, chords));
                      setTarget({ ...target, at: chord.at });
                    }
              }
              heard={heard === undefined ? undefined : (heard?.name ?? null)}
              onPick={pick}
              onClose={() => setTarget(null)}
            />
          );
        })()}
    </div>
  );
}

/** A link to a song's Chords mode, for those who may add chords. */
export function ChordsLink({
  songId,
  language,
  href,
}: {
  songId: string;
  language?: string;
  /** Where the Chords mode is, outside the community's pages. */
  href?: string;
}) {
  const { t } = useTranslation();
  return (
    <Link
      href={
        href ??
        `/songs/${songId}/chords${language ? `?language=${language}` : ""}`
      }
      className="link"
    >
      <FileMusic />
      {t("chords.open")}
    </Link>
  );
}
