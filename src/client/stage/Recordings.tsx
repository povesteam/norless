import {
  AudioLines,
  Check,
  Download,
  Hand,
  Play,
  Trash2,
  X,
} from "lucide-react";
import { Button, Chip } from "@heroui/react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import type {
  Recording,
  RecordingPart,
  SongRecording,
} from "../../server/live/recording-view";
import type { Song } from "../../server/songs/songs";
import { titleFor } from "../../shared/song-render";
import { parseSong, partLabels } from "../../shared/song-text";
import { useCommunity } from "../data/community";
import { send, useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { usePartName } from "./parts";
import { hasRole, useRoles } from "../data/me";
import { NotFound } from "../app/NotFound";
import {
  ActionButton,
  Empty,
  ErrorNotice,
  Placeholder,
  usePending,
} from "../ui/states";

const clock = (ms: number | null) => {
  if (ms === null) return "";
  const seconds = Math.round(ms / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};

/**
 * A downloaded file's name: the recording's date on this device and the title, e.g.
 * "2026-10-02 Har minunat.m4a", without what file systems refuse.
 */
const fileName = (startedAt: string, title: string, ext: string) => {
  const day = new Date(startedAt);
  const date = [
    day.getFullYear(),
    String(day.getMonth() + 1).padStart(2, "0"),
    String(day.getDate()).padStart(2, "0"),
  ].join("-");
  return `${date} ${title.replace(/[\\/:*?"<>|]/g, "").trim()}.${ext}`;
};

/** /recordings: the community's recordings, newest first, for the team and owners. */
export function RecordingsPage() {
  const { t, i18n } = useTranslation();
  const { slug, languages } = useCommunity();
  const { data, failed, retry } = useJson<Recording[]>(
    `/api/communities/${slug}/recordings`,
    useChanges(slug, "recordings", "recording_access", "recording_parts"),
  );
  if (data === undefined)
    return failed ? (
      <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
    ) : (
      <Placeholder lines={6} />
    );
  if (data === null) return <NotFound />;
  const order = [i18n.language, ...languages];
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">{t("recordings.title")}</h2>
      {data.length === 0 ? (
        <Empty
          title={t("recordings.empty")}
          description={t("recordings.emptyHelp")}
        />
      ) : (
        <ul className="divide-y divide-separator border-y border-separator">
          {data.map((r) => {
            const asked = r.requests?.filter((q) => q.status === "asked");
            return (
              <li key={r.id} className="flex flex-col gap-1 py-2">
                <Link href={`/recordings/${r.id}`} className="link font-medium">
                  {new Date(r.startedAt).toLocaleString(i18n.language, {
                    dateStyle: "full",
                    timeStyle: "short",
                    hourCycle: "h23",
                  })}
                </Link>
                <p className="text-sm text-muted">
                  {[
                    t(`recordings.by`, { name: r.by ?? "?" }),
                    t(`recordings.mode.${r.mode}`),
                    clock(r.durationMs),
                    r.parts
                      .filter((p) => p.songId)
                      .map((p) => titleFor(p.titles ?? {}, order))
                      .join(", "),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <span className="flex flex-wrap gap-1">
                  {r.status !== "ready" && (
                    <Chip size="sm" variant="soft">
                      {t(`recordings.status.${r.status}`)}
                    </Chip>
                  )}
                  {asked && asked.length > 0 && (
                    <Chip size="sm" color="warning" variant="soft">
                      {t("recordings.asking", { count: asked.length })}
                    </Chip>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** /recordings/:id: a file per song, with its parts to play from, and who may listen. */
export function RecordingPage({ id }: { id: string }) {
  const { t, i18n } = useTranslation();
  const { slug, languages } = useCommunity();
  const roles = useRoles(slug);
  const [, navigate] = useLocation();
  const [loads, setLoads] = useState(0);
  const url = `/api/communities/${slug}/recordings/${id}`;
  const {
    data: r,
    failed,
    retry,
  } = useJson<Recording>(
    url,
    loads +
      useChanges(slug, "recordings", "recording_access", "recording_parts"),
  );
  const reload = () => setLoads((n) => n + 1);
  const [problem, setProblem] = useState(false);
  const [act, acting] = usePending(
    async (method: "POST" | "PUT" | "DELETE", path: string, body?: object) => {
      const response = await send(method, `${url}${path}`, body);
      setProblem(!response?.ok);
      if (response?.ok) reload();
      return !!response?.ok;
    },
  );
  if (r === undefined)
    return failed ? (
      <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
    ) : (
      <Placeholder lines={8} />
    );
  if (r === null) return <NotFound />;
  const order = [i18n.language, ...languages];
  const canPlay = r.access === "own" || r.access === "granted";
  const canDelete = r.access === "own" || hasRole(roles, "owner");

  return (
    <article className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold">
        {new Date(r.startedAt).toLocaleString(i18n.language, {
          dateStyle: "full",
          timeStyle: "short",
          hourCycle: "h23",
        })}
      </h2>
      <p className="text-muted">
        {[
          t("recordings.by", { name: r.by ?? "?" }),
          r.device && t("recordings.from", { device: r.device }),
          t(`recordings.mode.${r.mode}`),
          clock(r.durationMs),
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {problem && <ErrorNotice message={t("states.actionFailed")} />}
      {r.status !== "ready" && (
        <p className="text-muted">{t(`recordings.status.${r.status}`)}</p>
      )}

      {r.access === "own" && r.requests && r.requests.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">{t("recordings.requests")}</h3>
          {r.requests.map((q) => (
            <div key={q.userId} className="flex flex-wrap items-center gap-2">
              <span>{q.name}</span>
              <Chip size="sm" variant="soft">
                {t(`recordings.access.${q.status}`)}
              </Chip>
              {q.status !== "granted" && (
                <ActionButton
                  size="sm"
                  isPending={acting}
                  onPress={() =>
                    void act("PUT", `/access/${q.userId}`, {
                      status: "granted",
                    })
                  }
                >
                  <Check />
                  {t("recordings.grant")}
                </ActionButton>
              )}
              {q.status !== "refused" && (
                <ActionButton
                  size="sm"
                  variant="secondary"
                  isPending={acting}
                  onPress={() =>
                    void act("PUT", `/access/${q.userId}`, {
                      status: "refused",
                    })
                  }
                >
                  <X />
                  {q.status === "granted"
                    ? t("recordings.withdraw")
                    : t("recordings.refuse")}
                </ActionButton>
              )}
            </div>
          ))}
        </section>
      )}

      {!canPlay && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-muted">
            {r.access === "asked"
              ? t("recordings.askedHelp")
              : t("recordings.noAccess", { name: r.by ?? "?" })}
          </p>
          {r.access !== "asked" && (
            <ActionButton
              size="sm"
              isPending={acting}
              onPress={() => void act("POST", "/access")}
            >
              <Hand />
              {t("recordings.ask")}
            </ActionButton>
          )}
        </div>
      )}

      <ol className="flex flex-col gap-3">
        {r.parts.map((part) => {
          const title = part.titles
            ? titleFor(part.titles, order)
            : t(`recordings.kinds.${part.kind ?? "none"}`);
          return (
            <PartPlayer
              key={part.id}
              part={part}
              title={title}
              audio={canPlay ? `${url}/parts/${part.id}/audio` : null}
              download={fileName(r.startedAt, title, part.ext)}
            />
          );
        })}
      </ol>

      {canDelete && (
        <Button
          variant="danger-soft"
          className="self-start"
          onPress={() =>
            window.confirm(t("recordings.confirmDelete")) &&
            void act("DELETE", "").then(
              (ok) => ok && navigate("/recordings", { replace: true }),
            )
          }
        >
          <Trash2 />
          {t("recordings.delete")}
        </Button>
      )}
    </article>
  );
}

/**
 * A song's last 5 recorded files on its page, for the team and owners, playable for
 * those with access (rehearsal-recordings spec). Nothing while it has none.
 */
export function SongRecordings({ songId }: { songId: string }) {
  const { t, i18n } = useTranslation();
  const { slug, languages } = useCommunity();
  const [loads, setLoads] = useState(0);
  const { data } = useJson<SongRecording[]>(
    `/api/communities/${slug}/songs/${songId}/recordings`,
    loads + useChanges(slug, "recordings", "recording_parts"),
  );
  const [ask, asking] = usePending(async (id: string) => {
    const response = await send(
      "POST",
      `/api/communities/${slug}/recordings/${id}/access`,
    );
    if (response?.ok) setLoads((n) => n + 1);
  });
  if (!data?.length) return null;
  const order = [i18n.language, ...languages];
  return (
    <section className="flex flex-col gap-3" aria-labelledby="song-recordings">
      <h3
        id="song-recordings"
        className="flex items-center gap-2 text-lg font-semibold"
      >
        <AudioLines />
        {t("recordings.title")}
      </h3>
      <ol className="flex flex-col gap-3">
        {data.map(({ recording: r, part }) => {
          const canPlay = r.access === "own" || r.access === "granted";
          return (
            <PartPlayer
              key={part.id}
              part={part}
              title={[
                new Date(r.startedAt).toLocaleString(i18n.language, {
                  dateStyle: "full",
                  timeStyle: "short",
                  hourCycle: "h23",
                }),
                t("recordings.by", { name: r.by ?? "?" }),
              ].join(" · ")}
              audio={
                canPlay
                  ? `/api/communities/${slug}/recordings/${r.id}/parts/${part.id}/audio`
                  : null
              }
              download={fileName(
                r.startedAt,
                titleFor(part.titles ?? {}, order),
                part.ext,
              )}
            >
              {!canPlay &&
                (r.access === "asked" ? (
                  <p className="text-sm text-muted">
                    {t("recordings.askedHelp")}
                  </p>
                ) : (
                  <ActionButton
                    size="sm"
                    className="self-start"
                    isPending={asking}
                    onPress={() => void ask(r.id)}
                  >
                    <Hand />
                    {t("recordings.ask")}
                  </ActionButton>
                ))}
            </PartPlayer>
          );
        })}
      </ol>
      <Link href="/recordings" className="link self-start text-sm">
        <AudioLines />
        {t("recordings.all")}
      </Link>
    </section>
  );
}

/** One file: its title and length, its parts to play from, and the player. */
function PartPlayer({
  part,
  title,
  audio,
  download,
  children,
}: {
  part: RecordingPart;
  title: string;
  audio: string | null;
  /** The name it's saved under. */
  download: string;
  /** Below it, e.g. asking for access. */
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { slug, languages } = useCommunity();
  const partName = usePartName();
  const player = useRef<HTMLAudioElement>(null);
  const song = useJson<Song>(
    part.songId ? `/api/communities/${slug}/songs/${part.songId}` : null,
  ).data;
  const version =
    song &&
    (languages
      .map((l) => song.versions.find((v) => v.language === l))
      .find(Boolean) ??
      song.versions[0]);
  const slides = version ? parseSong(version.text).slides : [];
  const labels = partLabels(slides);
  const playFrom = (ms: number) => {
    const element = player.current;
    if (!element) return;
    element.currentTime = ms / 1000;
    void element.play();
  };
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-separator p-3">
      <p className="font-semibold">
        {title}{" "}
        <span className="text-sm font-normal text-muted">
          {clock(part.endMs - part.startMs)}
        </span>
      </p>
      {audio && (
        <>
          {part.marks.length > 1 && (
            <div
              className="flex flex-wrap gap-1"
              aria-label={t("recordings.parts")}
            >
              {part.marks.map((mark, i) => (
                <Button
                  key={i}
                  size="sm"
                  variant="secondary"
                  onPress={() => playFrom(mark.atMs)}
                >
                  <Play />
                  {partName(
                    slides[mark.slide],
                    labels[mark.slide] ?? String(mark.slide + 1),
                  )}
                </Button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <audio
              ref={player}
              controls
              preload="none"
              src={audio}
              className="w-full max-w-xl"
            />
            <a href={audio} download={download} className="link text-sm">
              <Download />
              {t("recordings.download")}
            </a>
          </div>
        </>
      )}
      {children}
    </li>
  );
}
