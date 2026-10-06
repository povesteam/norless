import { DoorOpen, LogOut, QrCode, Users, X } from "lucide-react";
import {
  Button,
  Chip,
  Dropdown,
  Label,
  ListBox,
  Modal,
  Select,
  Separator,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import type { PlaylistSummary } from "../../server/playlists/playlists";
import type { PracticeRoom } from "../../server/live/rooms";
import type { Mode } from "../../shared/live";
import { useChanges } from "../data/changes";
import { useCommunity } from "../data/community";
import { QrImage } from "../account/QrImage";
import { playlistName } from "../../shared/playlist-name";
import { send, useJson } from "../data/fetch";
import { useMe, useRoles } from "../data/me";
import { joinRoom, useJoinedRoom } from "../data/room";
import { ActionButton, ErrorNotice, usePending } from "../ui/states";

/**
 * In the live bar, for the team: the room this device controls, the
 * practice rooms running to join, starting one, and for its starter or an owner its
 * mode, its link and ending it.
 */
export function RoomMenu() {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const me = useMe().me?.user?.id;
  const owner = useRoles(slug).includes("owner");
  const joined = useJoinedRoom(slug);
  const rooms =
    useJson<PracticeRoom[]>(
      `/api/communities/${slug}/rooms`,
      useChanges(slug, "rooms"),
    ).data ?? [];
  const room = rooms.find((r) => r.id === joined);
  const [starting, setStarting] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [failed, setFailed] = useState(false);
  const mine = room && (room.startedBy === me || owner);
  const label = room
    ? t("rooms.practice", { name: room.name })
    : rooms.length
      ? t("rooms.mainWithOthers", { count: rooms.length })
      : t("rooms.main");
  const act = async (key: string) => {
    if (key === "main") return joinRoom(slug, null);
    if (key === "start") return setStarting(true);
    if (key === "invite") return setInviting(true);
    if (!room) return;
    if (key === "service" || key === "rehearsal") {
      const response = await send(
        "PATCH",
        `/api/communities/${slug}/rooms/${room.id}`,
        {
          mode: key,
        },
      );
      return setFailed(!response?.ok);
    }
    if (key === "end") {
      if (!window.confirm(t("rooms.confirmEnd"))) return;
      const response = await send(
        "DELETE",
        `/api/communities/${slug}/rooms/${room.id}`,
      );
      setFailed(!response?.ok);
      if (response?.ok) joinRoom(slug, null);
      return;
    }
    joinRoom(slug, key);
  };
  return (
    <>
      <Dropdown>
        <Button
          size="sm"
          variant={room ? "primary" : "tertiary"}
          aria-label={t("rooms.menu", { room: label })}
        >
          {room ? <DoorOpen /> : <Users />}
          <span className="max-[749px]:sr-only">{label}</span>
        </Button>
        <Dropdown.Popover placement="top start">
          <Dropdown.Menu
            aria-label={t("rooms.title")}
            onAction={(key) => void act(String(key))}
          >
            <Dropdown.Section
              selectionMode="single"
              selectedKeys={[joined ?? "main"]}
            >
              <Dropdown.Item id="main" textValue={t("rooms.main")}>
                <Dropdown.ItemIndicator type="dot" />
                <Users />
                <Label>{t("rooms.main")}</Label>
              </Dropdown.Item>
              {rooms.map((r) => (
                <Dropdown.Item
                  key={r.id}
                  id={r.id}
                  textValue={t("rooms.practice", { name: r.name })}
                >
                  <Dropdown.ItemIndicator type="dot" />
                  <DoorOpen />
                  <Label>{t("rooms.practice", { name: r.name })}</Label>
                </Dropdown.Item>
              ))}
            </Dropdown.Section>
            <Separator />
            {[
              <Dropdown.Item
                key="start"
                id="start"
                textValue={t("rooms.start")}
              >
                <DoorOpen />
                <Label>{t("rooms.start")}</Label>
              </Dropdown.Item>,
              ...(room
                ? [
                    <Dropdown.Item
                      key="invite"
                      id="invite"
                      textValue={t("rooms.invite")}
                    >
                      <QrCode />
                      <Label>{t("rooms.invite")}</Label>
                    </Dropdown.Item>,
                  ]
                : []),
              ...(room && mine
                ? [
                    room.mode === "rehearsal" ? (
                      <Dropdown.Item
                        key="service"
                        id="service"
                        textValue={t("rooms.asService")}
                      >
                        <Users />
                        <Label>{t("rooms.asService")}</Label>
                      </Dropdown.Item>
                    ) : (
                      <Dropdown.Item
                        key="rehearsal"
                        id="rehearsal"
                        textValue={t("rooms.asRehearsal")}
                      >
                        <Users />
                        <Label>{t("rooms.asRehearsal")}</Label>
                      </Dropdown.Item>
                    ),
                    <Dropdown.Item
                      key="end"
                      id="end"
                      textValue={t("rooms.end")}
                      variant="danger"
                    >
                      <X />
                      <Label>{t("rooms.end")}</Label>
                    </Dropdown.Item>,
                  ]
                : []),
            ]}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      {failed && <ErrorNotice message={t("states.actionFailed")} />}
      {starting && <StartRoom onClose={() => setStarting(false)} />}
      {inviting && room && (
        <InviteRoom room={room} onClose={() => setInviting(false)} />
      )}
    </>
  );
}

/** Starting a practice room: its playlist and whether it counts as a service. */
function StartRoom({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const { slug } = useCommunity();
  const [, navigate] = useLocation();
  const list = useJson<{ playlists: PlaylistSummary[]; next: string | null }>(
    `/api/communities/${slug}/playlists?limit=10`,
  ).data;
  const playlists = list?.playlists ?? [];
  const [playlist, setPlaylist] = useState<string | null>(null);
  // The next service's playlist, as the home opens, if it's among these.
  const chosen =
    playlist ??
    (playlists.find((p) => p.id === list?.next) ?? playlists[0])?.id ??
    null;
  const [mode, setMode] = useState<Mode>("rehearsal");
  const [failed, setFailed] = useState(false);
  const [start, startingRoom] = usePending(async () => {
    const response = await send("POST", `/api/communities/${slug}/rooms`, {
      playlistId: chosen,
      mode,
    });
    setFailed(!response?.ok);
    if (!response?.ok) return;
    const { id } = (await response.json()) as { id: string };
    joinRoom(slug, id);
    onClose();
    if (chosen) navigate(`/playlists/${chosen}`);
  });
  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>{t("rooms.start")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col gap-4">
            <p className="text-sm text-muted">{t("rooms.startHelp")}</p>
            {failed && <ErrorNotice message={t("states.actionFailed")} />}
            <Select
              value={chosen}
              onChange={(id) => setPlaylist(String(id))}
              isDisabled={!playlists.length}
            >
              <Label>{t("rooms.playlist")}</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {playlists.map((p) => (
                    <ListBox.Item
                      key={p.id}
                      id={p.id}
                      textValue={playlistName(p, i18n.language)}
                    >
                      {playlistName(p, i18n.language)}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <ToggleButtonGroup
              aria-label={t("rooms.counts")}
              selectionMode="single"
              disallowEmptySelection
              size="sm"
              selectedKeys={[mode]}
              onSelectionChange={(keys) => {
                const [key] = keys;
                if (key === "rehearsal" || key === "service") setMode(key);
              }}
            >
              <ToggleButton id="rehearsal">{t("rooms.rehearsal")}</ToggleButton>
              <ToggleButton id="service">
                <ToggleButtonGroup.Separator />
                {t("rooms.service")}
              </ToggleButton>
            </ToggleButtonGroup>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("feedback.close")}
            </Button>
            <ActionButton isPending={startingRoom} onPress={() => void start()}>
              <DoorOpen />
              {t("rooms.startButton")}
            </ActionButton>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** The room's link and QR, for screens and guests to join it. */
function InviteRoom({
  room,
  onClose,
}: {
  room: PracticeRoom;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const path = `/${slug}/join/${room.id}`;
  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Container>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading>
              {t("rooms.practice", { name: room.name })}
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col items-center gap-3">
            <QrImage path={path} label={t("rooms.qr")} />
            <p className="text-sm text-muted">{t("rooms.inviteHelp")}</p>
            <code className="text-sm break-all select-all">{`${location.origin}${path}`}</code>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onPress={onClose}>
              <X />
              {t("feedback.close")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/**
 * /<community>/join/<room>: a practice room's link, for a screen or a guest's phone: this
 * device follows the room, and opens the view it's for.
 */
export function JoinRoomPage({
  slug,
  roomId,
}: {
  slug: string;
  roomId: string;
}) {
  const { t } = useTranslation();
  const room = useJson<{ id: string; playlistId: string | null }>(
    `/api/communities/${slug}/rooms/${roomId}`,
  ).data;
  const joined = useJoinedRoom(slug);
  if (room === undefined) return null;
  if (room === null)
    return (
      <div className="flex max-w-md flex-col gap-3 p-4">
        <h2 className="text-2xl font-semibold">{t("rooms.ended")}</h2>
        <Link href={`~/${slug}`} className="link">
          {t("rooms.toCommunity")}
        </Link>
      </div>
    );
  return (
    <div className="flex max-w-md flex-col gap-4 p-4">
      <h2 className="text-2xl font-semibold">{t("rooms.joinTitle")}</h2>
      {joined === roomId ? (
        <>
          <p className="text-muted">{t("rooms.joinedHelp")}</p>
          <nav className="flex flex-col gap-2">
            <Link href={`~/${slug}/musicians`} className="link">
              {t("musicians.title")}
            </Link>
            <Link href={`~/${slug}/vocalists`} className="link">
              {t("vocalists.title")}
            </Link>
            <Link href={`~/${slug}/stage`} className="link">
              {t("screens.types.stage")}
            </Link>
            {room.playlistId && (
              <Link
                href={`~/${slug}/playlists/${room.playlistId}`}
                className="link"
              >
                {t("rooms.playlistLink")}
              </Link>
            )}
          </nav>
        </>
      ) : (
        <Button onPress={() => joinRoom(slug, roomId)}>
          <DoorOpen />
          {t("rooms.join")}
        </Button>
      )}
    </div>
  );
}

/** On the musicians and vocalists pages: this device follows a practice room, and can leave it. */
export function RoomChip({ slug }: { slug: string }) {
  const { t } = useTranslation();
  const joined = useJoinedRoom(slug);
  if (!joined) return null;
  return (
    <Chip variant="soft" color="accent">
      <DoorOpen className="size-4" />
      {t("rooms.following")}
      <Button
        size="sm"
        variant="ghost"
        isIconOnly
        aria-label={t("rooms.leave")}
        onPress={() => joinRoom(slug, null)}
      >
        <LogOut />
      </Button>
    </Chip>
  );
}
