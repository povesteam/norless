import {
  Check,
  Copy,
  ExternalLink,
  ListVideo,
  Save,
  Settings,
  X,
} from "lucide-react";
import {
  Button,
  Description,
  FieldError,
  Input,
  Label,
  Modal,
  TextArea,
  TextField,
} from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import type { Stream } from "../../server/songs/chapters";
import type { Playlist } from "../../server/playlists/playlists";
import {
  chapterLines,
  offsetIn,
  parseTimestamp,
  timestamp,
  type Shown,
} from "../../shared/chapters";
import { useCommunity, useReloadCommunity } from "../data/community";
import { send, useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { hasRole, useRoles } from "../data/me";
import { entryTitle } from "../stage/StageMonitor";
import {
  ActionButton,
  Empty,
  ErrorNotice,
  Placeholder,
  usePending,
} from "../ui/states";
import { clock } from "../ui/time";

export { ListVideo as ChaptersIcon };

/**
 * A playlist's YouTube chapters: its last service's entries at
 * their time in the video, from when the first one starts in it, ready to paste.
 */
export function ChaptersDialog({
  playlist,
  onClose,
}: {
  playlist: Playlist;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { slug, languages, youtubeChannel } = useCommunity();
  const roles = useRoles(slug);
  const owner = hasRole(roles, "owner");
  const { data, failed, retry } = useJson<Shown[]>(
    `/api/communities/${slug}/playlists/${playlist.id}/chapters`,
    useChanges(slug, "live_log", "entries"),
  );
  // The service's live stream on the community's channel gives the offset.
  const stream = useJson<{ stream: Stream | null }>(
    youtubeChannel
      ? `/api/communities/${slug}/playlists/${playlist.id}/stream`
      : null,
  ).data?.stream;
  const titles = new Map(
    playlist.entries.map((e) => [
      e.id,
      entryTitle(e, [i18n.language, ...languages]),
    ]),
  );
  const shown = (data ?? []).filter((s) => titles.has(s.entryId));
  const found = stream ? offsetIn(shown, stream.startedAt) : null;
  // What was typed wins over what the stream gives.
  const [typed, setTyped] = useState<string | null>(null);
  const start = typed ?? (found !== null ? timestamp(found) : "0:00");
  const [copied, setCopied] = useState(false);
  const seconds = parseTimestamp(start);
  const text = chapterLines(
    shown,
    seconds ?? 0,
    (id) => titles.get(id) ?? "",
    t("chapters.start"),
  ).join("\n");

  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t("chapters.title")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            {failed ? (
              <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
            ) : !data ? (
              <Placeholder lines={6} />
            ) : shown.length === 0 ? (
              <Empty
                title={t("chapters.none")}
                description={t("chapters.noneHelp")}
              />
            ) : (
              <>
                <TextField
                  value={start}
                  onChange={(value) => {
                    setTyped(value);
                    setCopied(false);
                  }}
                  isInvalid={seconds === null}
                >
                  <Label>{t("chapters.firstAt")}</Label>
                  <Input inputMode="numeric" placeholder="0:00" />
                  <Description>
                    {stream && found !== null
                      ? t("chapters.fromStream", {
                          time: clock(stream.startedAt, i18n.language),
                        })
                      : t("chapters.firstAtHelp")}
                  </Description>
                </TextField>
                {stream && found !== null ? (
                  <a
                    className="link self-start text-sm"
                    href={`https://www.youtube.com/watch?v=${encodeURIComponent(stream.videoId)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink />
                    {t("chapters.openVideo")}
                  </a>
                ) : (
                  !youtubeChannel &&
                  owner && (
                    <Link
                      href="/settings/schedule"
                      className="link self-start text-sm"
                    >
                      <Settings />
                      {t("chapters.setChannel")}
                    </Link>
                  )
                )}
                <TextField value={text} isReadOnly>
                  <Label>{t("chapters.text")}</Label>
                  <TextArea className="field-sizing-content font-mono" />
                </TextField>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("editor.close")}
            </Button>
            {text && seconds !== null && (
              <Button
                onPress={() => {
                  void navigator.clipboard
                    .writeText(`${text}\n`)
                    .then(() => setCopied(true));
                  // A start typed by the team corrects the stream's, which the songs'
                  // replay links follow.
                  if (typed !== null && stream && hasRole(roles, "team"))
                    void send(
                      "PUT",
                      `/api/communities/${slug}/playlists/${playlist.id}/stream`,
                      { videoId: stream.videoId, firstAt: seconds },
                    );
                }}
              >
                {copied ? <Check /> : <Copy />}
                {/* Both labels in one cell, so the button keeps its width. */}
                <span className="grid">
                  <span
                    className={`col-start-1 row-start-1 ${copied ? "invisible" : ""}`}
                  >
                    {t("chapters.copy")}
                  </span>
                  <span
                    className={`col-start-1 row-start-1 ${copied ? "" : "invisible"}`}
                  >
                    {t("chapters.copied")}
                  </span>
                </span>
              </Button>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/**
 * The Schedule tab's YouTube channel, for owners: where services
 * are streamed, so chapters find the service's stream and when it started.
 */
export function YouTubeChannelSettings() {
  const { t } = useTranslation();
  const { slug, youtubeChannel } = useCommunity();
  const reload = useReloadCommunity();
  const [channel, setChannel] = useState(youtubeChannel ?? "");
  const [state, setState] = useState<"saved" | "invalid" | "failed" | null>(
    null,
  );
  const [save, saving] = usePending(async () => {
    const response = await send(
      "PUT",
      `/api/communities/${slug}/youtube-channel`,
      { channel: channel.trim() || null },
    );
    setState(
      response?.ok ? "saved" : response?.status === 400 ? "invalid" : "failed",
    );
    if (response?.ok) {
      const saved = (await response.json()) as { channel: string | null };
      setChannel(saved.channel ?? "");
      reload();
    }
  });
  return (
    <section aria-labelledby="youtube-title" className="flex flex-col gap-4">
      <h3 id="youtube-title" className="text-xl font-semibold">
        {t("youtube.title")}
      </h3>
      <p className="text-sm text-muted">{t("youtube.help")}</p>
      {state === "failed" && <ErrorNotice message={t("states.actionFailed")} />}
      <div className="flex flex-wrap items-end gap-4">
        <TextField
          value={channel}
          onChange={(value) => {
            setChannel(value);
            setState(null);
          }}
          isInvalid={state === "invalid"}
          className="w-80 max-w-full"
        >
          <Label>{t("youtube.label")}</Label>
          <Input placeholder="@church" />
          <Description>{t("youtube.example")}</Description>
          <FieldError>{t("youtube.invalid")}</FieldError>
        </TextField>
        <ActionButton isPending={saving} onPress={() => void save()}>
          <Save />
          {t("youtube.save")}
        </ActionButton>
        {state === "saved" && (
          <span className="text-sm text-muted">{t("editor.saved")}</span>
        )}
      </div>
    </section>
  );
}
