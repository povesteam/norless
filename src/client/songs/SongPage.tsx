import {
  ArrowUpDown,
  Ban,
  Check,
  Ellipsis,
  ExternalLink,
  History,
  Link2,
  Pencil,
} from "lucide-react";
import {
  Alert,
  Button,
  AvatarGroup,
  Chip,
  Dropdown,
  Label,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { lettersOnly } from "../../shared/song-render";
import type { Song } from "../../server/songs/songs";
import { EDIT_LOCK_MS } from "../../shared/live";
import { Link } from "wouter";
import { useCommunity, useShows } from "../data/community";
import { live } from "../data/connection";
import { send, useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { hasRole, useIsMember, useMe, useRoles } from "../data/me";
import { NameAvatar } from "../ui/NameAvatar";
import { LiveBar } from "../live/LiveBar";
import { LocalProjection } from "../live/LocalProjection";
import { useDeviceType } from "../data/device";
import { NotFound } from "../app/NotFound";
import { projectLocally, sendLive, useLocal } from "../data/room";
import { ChordsLink, useCanEditChords } from "../chords/ChordsMode";
import { HeldBy, useSongEdits } from "../data/editing";
import { SectionEditor } from "./SectionEditor";
import { SongHistory } from "./SongHistory";
import { SongRecordings } from "../stage/Recordings";
import { SongKeyDialog } from "./KeyDialog";
import { ShareResult, useShareLink } from "../playlists/ShareLink";
import { ReferenceLinkList } from "./ReferenceLinks";
import { SongText } from "./SongText";
import { SongPlaysSummary } from "./Statistics";
import { WatchAgain } from "./Replays";
import { ExcludeDialog, ExcludedNotice, SongOpinions } from "./SongFeedback";
import { ErrorNotice, Placeholder } from "../ui/states";

export function SongPage({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const community = useCommunity();
  // Saves by anyone, here or elsewhere, load the song again (with names, for members).
  const [loads, setLoads] = useState(0);
  const reload = useCallback(() => setLoads((n) => n + 1), []);
  useEffect(() => live.subscribe(`song:${id}`, reload), [id, reload]);
  const {
    data: song,
    failed,
    retry,
  } = useJson<Song>(
    `/api/communities/${community.slug}/songs/${encodeURIComponent(id)}`,
    // Likes and measured tempos show on the page too.
    loads + useChanges(community.slug, "song_opinions", "tempo_checks"),
  );
  const [language, setLanguage] = useState<string>();
  const [editing, setEditing] = useState<{
    language: string;
    index: number;
  } | null>(null);
  const [excluding, setExcluding] = useState(false);
  const [history, setHistory] = useState(false);
  const { share, state: shared } = useShareLink("song", id);
  // On a laptop, a song's languages side by side.
  const laptop = useDeviceType().deviceType === "laptop";
  const roles = useRoles(community.slug);
  const canEdit = hasRole(roles, "editor");
  const canEditChords = useCanEditChords(community.slug);
  const [changingKey, setChangingKey] = useState(false);
  const { me } = useMe();
  const local = useLocal();
  const shows = useShows();

  // Members see who edits which section, live.
  const isMember = useIsMember(community.slug);
  const { edits, now } = useSongEdits(id, isMember);
  // One editor per song: while someone else has it, it's read-only.
  const holder =
    edits.find(
      (e) =>
        e.userId !== me?.user?.id && now - Date.parse(e.typedAt) < EDIT_LOCK_MS,
    ) ?? null;

  if (song === undefined)
    return failed ? (
      <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
    ) : (
      <Placeholder lines={10} />
    );
  const version =
    song?.versions.find((v) => v.language === (language ?? i18n.language)) ??
    song?.versions[0];
  if (!song || !version) return <NotFound />;

  const names = new Intl.DisplayNames([i18n.language], { type: "language" });
  const languageName = (code: string) => {
    const name = names.of(code) ?? code;
    return name.charAt(0).toLocaleUpperCase(i18n.language) + name.slice(1);
  };

  // Anyone can project the song on a screen connected to this device.
  const entryId = `song:${song.id}`;
  const projecting =
    local?.slug === community.slug &&
    local.playlistId === null &&
    local.entries[0]?.id === entryId;
  const project = () => {
    projectLocally({
      slug: community.slug,
      // In the language shown here.
      languages: [
        version.language,
        ...community.languages.filter((l) => l !== version.language),
      ],
      playlistId: null,
      entries: [
        {
          id: entryId,
          kind: "song",
          song: {
            type: "song",
            id: song.id,
            titles: Object.fromEntries(
              song.versions.map((v) => [v.language, v.title]),
            ),
            keySignature: song.keySignature,
            timeSignature: song.timeSignature,
            tags: song.tags,
            lastPlayedAt: null,
            deleted: false,
            playedRecently: false,
          },
          bible: null,
          text: null,
          plannedMinutes: null,
          keySignature: null,
        },
      ],
      known: [song],
    });
    void sendLive(community.slug, { type: "go", entryId }, "song-page");
  };

  const more = [
    canEditChords &&
      shows("instruments") &&
      !song.deletedAt && {
        id: "key",
        icon: <ArrowUpDown />,
        label: t("keys.change"),
      },
    isMember &&
      shows("chords") && {
        id: "history",
        icon: <History />,
        label: t("history.title"),
      },
    shows("shortLinks") && {
      id: "share",
      icon: <Link2 />,
      label: t("share.copy"),
    },
    hasRole(roles, "owner") &&
      shows("songFeedback") &&
      !song.deletedAt &&
      !song.excluded && {
        id: "exclude",
        icon: <Ban />,
        label: t("opinions.exclude"),
      },
  ].filter((action) => !!action);
  const sideBySide = laptop && song.versions.length > 1;
  const shownVersions = sideBySide ? song.versions : [version];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold">{lettersOnly(version.title)}</h2>
        {/* The song's actions in one row, the rarer ones in ⋯. */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {!projecting && !song.deletedAt && (
            <LocalProjection projecting={false} start={project} />
          )}
          {canEditChords && shows("chords") && !song.deletedAt && (
            <ChordsLink songId={song.id} language={version.language} />
          )}
          {canEdit && !song.deletedAt && (
            <Link href={`/songs/${song.id}/edit`} className="link">
              <Pencil />
              {t("editor.editSong")}
            </Link>
          )}
          {more.length > 0 && (
            <Dropdown>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label={t("song.more")}
              >
                <Ellipsis />
              </Button>
              <Dropdown.Popover placement="bottom end">
                <Dropdown.Menu
                  onAction={(key) => {
                    if (key === "key") setChangingKey(true);
                    else if (key === "exclude") setExcluding(true);
                    else if (key === "share") void share();
                    else if (key === "history") setHistory(true);
                  }}
                >
                  {more.map(({ id: key, icon, label }) => (
                    <Dropdown.Item key={key} id={key} textValue={label}>
                      {icon}
                      <Label>{label}</Label>
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          )}
          {shared === "copied" && (
            <span role="status" className="flex items-center gap-1">
              <Check className="size-4" />
              {t("share.copied")}
            </span>
          )}
          <ShareResult state={shared} />
        </div>
      </div>
      {excluding && (
        <ExcludeDialog
          songId={song.id}
          onExcluded={() => {
            setExcluding(false);
            reload();
          }}
          onClose={() => setExcluding(false)}
        />
      )}
      {song.people && <People {...song.people} />}
      {shows("credits") && <Credits song={song} />}
      {song.deletedAt && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t("song.deleted")}</Alert.Title>
          </Alert.Content>
        </Alert>
      )}
      <ExcludedNotice song={song} onChanged={reload} />
      <div className="flex flex-wrap gap-2">
        {song.keySignature && (
          <Chip variant="secondary">
            {t("song.key", { key: song.keySignature })}
          </Chip>
        )}
        {song.timeSignature && (
          <Chip variant="secondary">
            {t("song.time", { time: song.timeSignature })}
          </Chip>
        )}
        {song.bpm !== null && (
          <Chip variant="secondary">{t("song.tempo", { bpm: song.bpm })}</Chip>
        )}
        {song.suggestedBpm !== null && shows("tempoCheck") && (
          <span className="flex items-center gap-1">
            <Chip variant="soft">
              {t("tempo.measured", { bpm: song.suggestedBpm })}
            </Chip>
            {canEditChords && !song.deletedAt && (
              <Button
                size="sm"
                variant="ghost"
                onPress={() =>
                  void send(
                    "PUT",
                    `/api/communities/${community.slug}/songs/${song.id}/tempo`,
                    { bpm: song.suggestedBpm },
                  ).then(reload)
                }
              >
                <Check />
                {t("tempo.accept")}
              </Button>
            )}
          </span>
        )}
        {song.tags.map((tag) => (
          <Chip key={tag} variant="soft">
            {tag}
          </Chip>
        ))}
      </div>
      {song.referenceLinks.length > 0 && shows("chords") && (
        <ReferenceLinkList links={song.referenceLinks} />
      )}
      {shows("songFeedback") && <SongOpinions song={song} onChanged={reload} />}
      {shows("statistics") && <SongPlaysSummary songId={song.id} />}
      {song.versions.length > 1 && !sideBySide && (
        <ToggleButtonGroup
          aria-label={t("song.language")}
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[version.language]}
          onSelectionChange={(keys) => {
            const [key] = keys;
            if (key !== undefined) setLanguage(String(key));
          }}
          className="self-start"
        >
          {song.versions.map((v, i) => (
            <ToggleButton key={v.language} id={v.language}>
              {i > 0 && <ToggleButtonGroup.Separator />}
              {languageName(v.language)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      )}
      {holder && (canEdit || canEditChords) && <HeldBy name={holder.name} />}
      <div
        className={sideBySide ? "grid gap-8" : undefined}
        style={
          sideBySide
            ? {
                gridTemplateColumns: `repeat(${shownVersions.length}, minmax(0, 1fr))`,
              }
            : undefined
        }
      >
        {shownVersions.map((v) => (
          <section
            key={v.language}
            lang={v.language}
            aria-label={sideBySide ? languageName(v.language) : undefined}
            className="flex min-w-0 flex-col gap-3"
          >
            {sideBySide && (
              <h3 className="font-semibold text-muted">
                {languageName(v.language)}
              </h3>
            )}
            <SongText
              text={v.text}
              others={
                new Map(
                  edits
                    .filter(
                      (e) =>
                        e.userId !== me?.user?.id &&
                        e.language === v.language &&
                        e.section >= 0,
                    )
                    .map((e) => [e.section, { name: e.name, draft: e.draft }]),
                )
              }
              locked={!!holder}
              onEdit={
                canEdit && !song.deletedAt
                  ? (index) => setEditing({ language: v.language, index })
                  : undefined
              }
              editLabel={t("editor.editSection")}
            />
          </section>
        ))}
      </div>
      {editing !== null && (
        <SectionEditor
          slug={community.slug}
          song={song}
          language={editing.language}
          index={editing.index}
          onSaved={reload}
          onClose={() => setEditing(null)}
        />
      )}
      {changingKey && (
        <SongKeyDialog
          slug={community.slug}
          song={song}
          onChanged={reload}
          onClose={() => setChangingKey(false)}
        />
      )}
      {history && isMember && shows("chords") && (
        <SongHistory
          slug={community.slug}
          song={song}
          canRestore={canEdit}
          onRestored={reload}
        />
      )}
      {hasRole(roles, "team") && shows("recordings") && (
        <SongRecordings songId={song.id} />
      )}
      {/* Last on the page, so a list that arrives later moves nothing. */}
      {shows("replays") && <WatchAgain songId={song.id} />}
      {/* Projecting here: the live bar at the bottom; Project here is at the top. */}
      {projecting && (
        <LiveBar view={local.view} project={{ projecting, start: project }} />
      )}
    </div>
  );
}

/** Who wrote the song, whose copyright it is, and the page it was taken from. */
function Credits({ song }: { song: Song }) {
  const { t } = useTranslation();
  const { authors, copyright, sourceUrl } = song;
  if (!authors && !copyright && !sourceUrl) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
      {[authors, copyright].filter(Boolean).join(" · ")}
      {sourceUrl && (
        <>
          {(authors || copyright) && <span aria-hidden>·</span>}
          <a href={sourceUrl} target="_blank" rel="noreferrer" className="link">
            <ExternalLink className="size-4" />
            {t("song.source")}
          </a>
        </>
      )}
    </p>
  );
}

/** "youtube.com" for https://www.youtube.com/watch?v=… */

/** Who created and last edited the song, as small avatars with the name on hover. */
function People({ createdBy, updatedBy }: NonNullable<Song["people"]>) {
  const { t } = useTranslation();
  const people = [
    createdBy && {
      ...createdBy,
      label: t("song.createdBy", { name: createdBy.name }),
    },
    updatedBy && {
      ...updatedBy,
      label: t("song.updatedBy", { name: updatedBy.name }),
    },
  ].filter((person) => !!person);
  if (people.length === 0) return null;
  // Their names beside them, so the initials say who.
  return (
    <div className="flex items-center gap-2">
      <AvatarGroup>
        {people.map(({ name, avatar, label }) => (
          <NameAvatar key={label} name={name} avatar={avatar} label={label} />
        ))}
      </AvatarGroup>
      <span className="text-sm text-muted">
        {people.map(({ label }) => label).join(" · ")}
      </span>
    </div>
  );
}
