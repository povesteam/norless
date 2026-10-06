import { Ban, Undo2, ThumbsDown, ThumbsUp, X } from "lucide-react";
import {
  Alert,
  Button,
  Label,
  Modal,
  TextArea,
  TextField,
  ToggleButton,
} from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import type {
  ExcludedSong,
  ReviewedSong,
} from "../../server/songs/song-feedback";
import type { Song } from "../../server/songs/songs";
import { useCommunity } from "../data/community";
import { send, useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { hasRole, useMe, useRoles } from "../data/me";
import {
  ActionButton,
  Empty,
  ErrorNotice,
  Placeholder,
  usePending,
} from "../ui/states";
import { relativeTime } from "../ui/time";

const songUrl = (slug: string, id: string) =>
  `/api/communities/${slug}/songs/${encodeURIComponent(id)}`;

/**
 * Like and dislike on a song's page, with how many members chose each; owners also read
 * why members dislike it. Only members get `opinions` with the song.
 */
export function SongOpinions({
  song,
  onChanged,
}: {
  song: Song;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const device = useMe().me?.user?.device;
  const [disliking, setDisliking] = useState(false);
  const [failed, setFailed] = useState(false);
  const [vote, voting] = usePending(
    async (opinion: "like" | "dislike" | null, reason?: string) => {
      const response = await send("PUT", `${songUrl(slug, song.id)}/opinion`, {
        opinion,
        reason,
      });
      setFailed(!response?.ok);
      if (response?.ok) onChanged();
      return response?.ok;
    },
  );
  const opinions = song.opinions;
  if (!opinions) return null;
  // The community's laptop or a guest's phone shows the counts, without voting.
  const canVote = !device && !song.deletedAt;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleButton
          size="sm"
          isSelected={opinions.mine === "like"}
          isDisabled={!canVote || voting}
          onChange={(on) => void vote(on ? "like" : null)}
        >
          <ThumbsUp />
          {t("opinions.like")}{" "}
          <span className="tabular-nums">{opinions.likes}</span>
        </ToggleButton>
        <ToggleButton
          size="sm"
          isSelected={opinions.mine === "dislike"}
          isDisabled={!canVote || voting}
          onChange={(on) => (on ? setDisliking(true) : void vote(null))}
        >
          <ThumbsDown />
          {t("opinions.dislike")}{" "}
          <span className="tabular-nums">{opinions.dislikes}</span>
        </ToggleButton>
        {failed && <ErrorNotice message={t("states.actionFailed")} />}
      </div>
      {opinions.reasons && opinions.reasons.length > 0 && (
        <Reasons reasons={opinions.reasons} />
      )}
      {disliking && (
        <DislikeDialog
          onDislike={async (reason) => {
            if (await vote("dislike", reason)) setDisliking(false);
          }}
          onClose={() => setDisliking(false)}
        />
      )}
    </div>
  );
}

/** Why members dislike a song, by name. */
function Reasons({ reasons }: { reasons: { name: string; reason: string }[] }) {
  const { t } = useTranslation();
  return (
    <ul aria-label={t("opinions.reasons")} className="text-sm text-muted">
      {reasons.map(({ name, reason }, i) => (
        <li key={i}>{t("opinions.reason", { name, reason })}</li>
      ))}
    </ul>
  );
}

/** A dislike may say why; it is saved without a reason too. */
function DislikeDialog({
  onDislike,
  onClose,
}: {
  onDislike: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const [save, saving] = usePending(() => onDislike(reason));
  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t("opinions.dislikeTitle")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <TextField value={reason} onChange={setReason}>
              <Label>{t("opinions.why")}</Label>
              <TextArea
                rows={3}
                maxLength={500}
                className="field-sizing-content"
                autoFocus
              />
            </TextField>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("editor.close")}
            </Button>
            <ActionButton isPending={saving} onPress={() => void save()}>
              <ThumbsDown />
              {t("opinions.dislike")}
            </ActionButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** Owners exclude a song, saying why, or include it again. */
async function setExclusion(slug: string, id: string, reason: string | null) {
  const response = await send("PUT", `${songUrl(slug, id)}/exclusion`, {
    reason,
  });
  return !!response?.ok;
}

/** The owners' button on a song's page, with its dialog. */
export function ExcludeButton({
  songId,
  onChanged,
}: {
  songId: string;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" onPress={() => setOpen(true)}>
        <Ban />
        {t("opinions.exclude")}
      </Button>
      {open && (
        <ExcludeDialog
          songId={songId}
          onExcluded={() => {
            setOpen(false);
            onChanged();
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function ExcludeDialog({
  songId,
  onExcluded,
  onClose,
}: {
  songId: string;
  onExcluded: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const [reason, setReason] = useState("");
  const [failed, setFailed] = useState(false);
  const [save, saving] = usePending(async () => {
    const ok = await setExclusion(slug, songId, reason.trim());
    setFailed(!ok);
    if (ok) onExcluded();
  });
  return (
    <Modal.Backdrop isOpen onOpenChange={(isOpen) => !isOpen && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t("opinions.excludeTitle")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <p className="text-sm text-muted">{t("opinions.excludeHelp")}</p>
            <TextField value={reason} onChange={setReason} isRequired>
              <Label>{t("opinions.excludeReason")}</Label>
              <TextArea
                rows={3}
                maxLength={500}
                className="field-sizing-content"
                autoFocus
              />
            </TextField>
            {failed && <ErrorNotice message={t("states.actionFailed")} />}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("editor.close")}
            </Button>
            <ActionButton
              variant="danger"
              isPending={saving}
              isDisabled={!reason.trim()}
              onPress={() => void save()}
            >
              <Ban />
              {t("opinions.exclude")}
            </ActionButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** "Include again", for owners. */
function IncludeButton({
  songId,
  onChanged,
}: {
  songId: string;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const [include, including] = usePending(async () => {
    if (await setExclusion(slug, songId, null)) onChanged();
  });
  return (
    <ActionButton
      size="sm"
      variant="secondary"
      isPending={including}
      onPress={() => void include()}
    >
      <Undo2 />
      {t("opinions.include")}
    </ActionButton>
  );
}

/** On an excluded song's page, for everyone: it isn't sung here, and why. */
export function ExcludedNotice({
  song,
  onChanged,
}: {
  song: Song;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const owner = hasRole(useRoles(slug), "owner");
  if (!song.excluded) return null;
  return (
    <Alert status="warning">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{t("opinions.excluded")}</Alert.Title>
        <Alert.Description>{song.excluded.reason}</Alert.Description>
      </Alert.Content>
      {owner && <IncludeButton songId={song.id} onChanged={onChanged} />}
    </Alert>
  );
}

/** Settings, Song feedback: the disliked songs, most dislikes first, and the excluded ones. */
export function SongFeedbackSettings() {
  const { t, i18n } = useTranslation();
  const { slug } = useCommunity();
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((n) => n + 1);
  const { data, failed, retry } = useJson<{
    disliked: ReviewedSong[];
    excluded: ExcludedSong[];
  }>(
    `/api/communities/${slug}/song-feedback`,
    version + useChanges(slug, "song_opinions", "songs"),
  );
  const [excluding, setExcluding] = useState<string | null>(null);
  if (!data)
    return failed ? (
      <ErrorNotice message={t("states.loadFailed")} onRetry={retry} />
    ) : (
      <Placeholder lines={4} />
    );
  const title = (id: string, text: string) => (
    <Link href={`/songs/${id}`} className="link font-medium">
      {text}
    </Link>
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">{t("opinions.disliked")}</h3>
        {data.disliked.length === 0 ? (
          <Empty
            title={t("opinions.noDisliked")}
            description={t("opinions.noDislikedHelp")}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {data.disliked.map((song) => (
              <li
                key={song.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-separator p-3"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  {title(song.id, song.title)}
                  <span className="flex gap-3 text-sm tabular-nums">
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="size-4" />
                      {t("opinions.likes", { count: song.likes })}
                    </span>
                    <span className="flex items-center gap-1">
                      <ThumbsDown className="size-4" />
                      {t("opinions.dislikes", { count: song.dislikes })}
                    </span>
                  </span>
                  {song.reasons.length > 0 && (
                    <Reasons reasons={song.reasons} />
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => setExcluding(song.id)}
                >
                  <Ban />
                  {t("opinions.exclude")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold">{t("opinions.excludedSongs")}</h3>
        {data.excluded.length === 0 ? (
          <Empty
            title={t("opinions.noExcluded")}
            description={t("opinions.noExcludedHelp")}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {data.excluded.map((song) => (
              <li
                key={song.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-separator p-3"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  {title(song.id, song.title)}
                  <span>{song.reason}</span>
                  <span className="text-sm text-muted">
                    {t(
                      song.by ? "opinions.excludedBy" : "opinions.excludedAt",
                      {
                        name: song.by,
                        when: relativeTime(song.at, new Date(), i18n.language),
                      },
                    )}
                  </span>
                </div>
                <IncludeButton songId={song.id} onChanged={reload} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {excluding && (
        <ExcludeDialog
          songId={excluding}
          onExcluded={() => {
            setExcluding(null);
            reload();
          }}
          onClose={() => setExcluding(null)}
        />
      )}
    </div>
  );
}
