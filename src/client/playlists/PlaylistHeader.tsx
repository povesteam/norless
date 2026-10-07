import { Button, Chip, Dropdown, Label, Modal, Separator } from "@heroui/react";
import {
  Archive,
  ArchiveRestore,
  BellDot,
  Ellipsis,
  ListMusic,
  Pencil,
  X,
} from "lucide-react";
import { type ReactElement, type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import type {
  Playlist,
  PlaylistSummary,
} from "../../server/playlists/playlists";
import { playlistName } from "../../shared/playlist-name";
import { useChanges } from "../data/changes";
import type { PlaylistTimes } from "../../server/playlists/times";
import type { PlaylistActivity } from "../../shared/live";
import { useCommunity, useShows } from "../data/community";
import { send, useJson } from "../data/fetch";
import { useIsMember } from "../data/me";
import { useDeviceType } from "../data/device";
import { ExportDialog, type ExportKind, ExportIcon } from "./PlaylistExport";
import { ChaptersDialog, ChaptersIcon } from "./Chapters";
import { NameAvatar } from "../ui/NameAvatar";
import { ShareLink } from "./ShareLink";
import { clock } from "../ui/time";
import { ActionButton, ErrorNotice, usePending } from "../ui/states";
import { InBar } from "../app/BarPlace";
import { PlaylistTitle } from "./PlaylistTitle";

const exportKinds: ExportKind[] = ["print", "html", "copy"];

export function PlaylistHeader({
  playlist,
  canChange,
  canArchive,
  onRename,
  onArchive,
  viewers,
  status,
}: {
  playlist: Playlist;
  canChange: boolean;
  /** For the team: archive it, or restore it while archived. */
  canArchive: boolean;
  onRename: (title: string) => Promise<unknown>;
  onArchive: (archived: boolean) => Promise<unknown>;
  /** Who else has it open: in this row, so coming and going moves nothing below. */
  viewers: ReactNode;
  /** The rest of the title row: problems, the end, who's online, the layout. */
  status?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const shows = useShows();
  const phone = useDeviceType().deviceType === "phone";
  const [editing, setEditing] = useState(false);
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [chaptering, setChaptering] = useState(false);
  const [telling, setTelling] = useState(false);
  const { slug } = useCommunity();
  const member = useIsMember(slug);
  // The newest other playlists, to go to one from the title's menu.
  const others = (
    useJson<{ playlists: PlaylistSummary[] }>(
      `/api/communities/${slug}/playlists?limit=6`,
      useChanges(slug, "playlists"),
    ).data?.playlists ?? []
  )
    .filter((p) => p.id !== playlist.id)
    .slice(0, 5);
  const chapters = member && shows("chapters");
  // The team tells the service's people it's ready.
  const ready =
    canArchive &&
    !playlist.archivedAt &&
    !!playlist.service &&
    shows("playlistNews");
  const hasActions =
    others.length > 0 ||
    shows("export") ||
    chapters ||
    ready ||
    canChange ||
    (canArchive && !playlist.archivedAt);
  // On a phone the title opens the actions, and no ⋯.
  const actions = (trigger: ReactElement) => (
    <Dropdown>
      {trigger}
      <Dropdown.Popover placement={phone ? "bottom start" : "bottom end"}>
        <Dropdown.Menu
          onAction={(key) => {
            // Archiving is undone with Restore, so it doesn't ask first.
            if (key === "archive") void onArchive(true);
            else if (key === "rename") setEditing(true);
            else if (key === "chapters") setChaptering(true);
            else if (key === "ready") setTelling(true);
            else if (key !== "all" && !String(key).startsWith("open:"))
              setExporting(key as ExportKind);
          }}
        >
          {canChange ? (
            <Dropdown.Item id="rename" textValue={t("playlist.rename")}>
              <Pencil />
              <Label>{t("playlist.rename")}</Label>
            </Dropdown.Item>
          ) : null}
          {shows("export")
            ? exportKinds.map((kind) => (
                <Dropdown.Item
                  key={kind}
                  id={kind}
                  textValue={t(`export.${kind}`)}
                >
                  <ExportIcon kind={kind} />
                  <Label>{t(`export.${kind}`)}</Label>
                </Dropdown.Item>
              ))
            : null}
          {ready ? (
            <Dropdown.Item id="ready" textValue={t("news.tell")}>
              <BellDot />
              <Label>
                {playlist.readyAt ? t("news.tellAgain") : t("news.tell")}
              </Label>
            </Dropdown.Item>
          ) : null}
          {chapters ? (
            <Dropdown.Item id="chapters" textValue={t("chapters.title")}>
              <ChaptersIcon />
              <Label>{t("chapters.title")}</Label>
            </Dropdown.Item>
          ) : null}
          {canArchive && !playlist.archivedAt ? (
            <Dropdown.Item id="archive" textValue={t("playlist.archive")}>
              <Archive />
              <Label>{t("playlist.archive")}</Label>
            </Dropdown.Item>
          ) : null}
          {/* Another playlist: the newest, then all of them. */}
          {others.length > 0 ? <Separator /> : null}
          {others.map((p) => {
            const name = playlistName(p, i18n.language);
            return (
              <Dropdown.Item
                key={p.id}
                id={`open:${p.id}`}
                href={`/${slug}/playlists/${p.id}`}
                textValue={name}
              >
                <ListMusic />
                <Label>{name}</Label>
              </Dropdown.Item>
            );
          })}
          {others.length > 0 ? (
            <Dropdown.Item
              id="all"
              href={`/${slug}/playlists`}
              textValue={t("playlists.all")}
            >
              <ListMusic />
              <Label>{t("playlists.all")}</Label>
            </Dropdown.Item>
          ) : null}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
  const menu =
    hasActions &&
    !phone &&
    actions(
      <Button
        isIconOnly
        variant="ghost"
        size="sm"
        aria-label={t("playlist.actions")}
      >
        <Ellipsis />
      </Button>,
    );

  return (
    <>
      {/* Its line is kept for members, so problems or people coming and going move
        nothing. On a phone one row, sideways if it must, so people coming online move
        nothing. */}
      <div
        className={`flex items-center gap-2 ${
          phone ? "overflow-x-auto py-0.5 *:shrink-0" : "flex-wrap"
        } ${member ? "min-h-8" : "empty:hidden"}`}
      >
        <InBar place="title">
          <PlaylistTitle
            playlist={playlist}
            canChange={canChange}
            editing={editing}
            onEditing={setEditing}
            onRename={onRename}
            asMenu={hasActions && phone ? actions : undefined}
          />
          {menu}
        </InBar>
        {shows("shortLinks") && (
          <ShareLink kind="playlist" id={playlist.id} compact={phone} />
        )}
        {/* A phone has its playlists in the menu. */}
        {shows("appFrame") && !phone && (
          <Link href="/playlists" className="link text-sm">
            <ListMusic />
            {t("playlists.all")}
          </Link>
        )}
        {viewers}
        {status}
        {telling && (
          <TellReadyDialog
            playlist={playlist}
            onClose={() => setTelling(false)}
          />
        )}
        {chaptering && (
          <ChaptersDialog
            playlist={playlist}
            onClose={() => setChaptering(false)}
          />
        )}
        {exporting && (
          <ExportDialog
            kind={exporting}
            playlist={playlist}
            onClose={() => setExporting(null)}
          />
        )}
      </div>
      {/* Under the row, so it wraps on a phone. */}
      {playlist.archivedAt && (
        <div className="flex w-full flex-wrap items-center gap-2">
          <Chip variant="soft">
            <Archive />
            {t("playlist.archivedOn", {
              date: new Intl.DateTimeFormat(i18n.language, {
                dateStyle: "medium",
              }).format(new Date(playlist.archivedAt)),
            })}
          </Chip>
          {canArchive && (
            <Button
              size="sm"
              variant="secondary"
              onPress={() => void onArchive(false)}
            >
              <ArchiveRestore />
              {t("playlist.restore")}
            </Button>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Telling the people in the playlist's service slots that it's ready, in the app and on
 * their phones; songs changed after it are told to its musicians.
 */
function TellReadyDialog({
  playlist,
  onClose,
}: {
  playlist: Playlist;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { slug } = useCommunity();
  const [outcome, setOutcome] = useState<
    { told: number; readyAt: string } | "nobody" | "failed" | null
  >(null);
  const [tell, telling] = usePending(async () => {
    const response = await send(
      "POST",
      `/api/communities/${slug}/playlists/${playlist.id}/ready`,
    );
    setOutcome(
      response?.ok
        ? ((await response.json()) as { told: number; readyAt: string })
        : response?.status === 400
          ? "nobody"
          : "failed",
    );
  });
  const told = typeof outcome === "object" && outcome !== null;
  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t("news.tell")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-3">
            <p>{t("news.tellHelp")}</p>
            {playlist.readyAt && !told && (
              <p className="text-sm text-muted">
                {t("news.toldBefore", {
                  at: new Intl.DateTimeFormat(i18n.language, {
                    dateStyle: "medium",
                    timeStyle: "short",
                    hourCycle: "h23",
                  }).format(new Date(playlist.readyAt)),
                })}
              </p>
            )}
            <p role="status" className="min-h-5 text-sm font-semibold">
              {told
                ? t("news.told", { count: outcome.told })
                : outcome === "nobody"
                  ? t("news.nobody")
                  : ""}
            </p>
            {outcome === "failed" && (
              <ErrorNotice message={t("states.actionFailed")} />
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("editor.close")}
            </Button>
            {!told && (
              <ActionButton isPending={telling} onPress={() => void tell()}>
                <BellDot />
                {t("news.tellButton")}
              </ActionButton>
            )}
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** For controllers: when the playlist should end, and against the scheduled event's end. */
export function PlaylistEnd({
  times,
}: {
  /** Undefined while they load; null when they can't be read. */
  times: PlaylistTimes | null | undefined;
}) {
  const { t, i18n } = useTranslation();
  const phone = useDeviceType().deviceType === "phone";
  const at = (iso: string) => clock(iso, i18n.language);
  // Its line is kept while the times load, so the page below doesn't move.
  if (times === undefined) return <p aria-hidden className="h-5" />;
  if (!times || times.entries.length === 0) return null;
  const past = times.minutesPast;
  // On a phone the time alone, as the rows give theirs, so the row stays one line
  //; its words are in its name.
  if (phone)
    return (
      <p className="text-sm text-muted" aria-label={t("times.endLabel")}>
        {`${times.approximate ? "≈" : ""}${at(times.end)}`}
      </p>
    );
  return (
    <p className="text-sm text-muted" aria-label={t("times.endLabel")}>
      {t(times.approximate ? "times.endApprox" : "times.end", {
        time: at(times.end),
      })}
      {past !== null &&
        times.scheduledEnd &&
        ` · ${
          past > 0
            ? t("times.past", { count: past, time: at(times.scheduledEnd) })
            : t("times.before", { count: -past, time: at(times.scheduledEnd) })
        }`}
    </p>
  );
}

/** The other members who have the playlist open. */
export function Viewers({
  viewers = [],
}: {
  viewers?: PlaylistActivity["viewers"];
}) {
  const { t } = useTranslation();
  if (viewers.length === 0) return null;
  return (
    <div className="flex items-center gap-1">
      {viewers.map(({ userId, name, avatar }) => (
        <NameAvatar
          key={userId}
          name={name}
          avatar={avatar}
          label={t("playlist.alsoHere", { name })}
        />
      ))}
    </div>
  );
}
