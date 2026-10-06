import { Button, Drawer, Input, TextField } from "@heroui/react";
import {
  ArrowLeft,
  FileClock,
  Info,
  ListTree,
  Lightbulb,
  Menu,
  Pencil,
  Plus,
  Settings,
  Shield,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import type { Entry } from "../../server/playlists/playlists";
import { useCommunity, useShows } from "../data/community";
import { GoLive } from "./ControllerViews";
import { FeedbackButton } from "../app/FeedbackDialog";
import { LanguagePicker } from "../app/LanguagePicker";
import { InstallLink } from "../app/Install";
import { hasRole, useIsMember, useRoles } from "../data/me";
import { OnlineMembers } from "./OnlineMembers";
import { PlaylistList, ShowArchived } from "../playlists/PlaylistsPage";
import { NewPlaylistButton } from "../playlists/NewPlaylist";
import type { Via } from "../../shared/usage";
import { useHintAnchor } from "./hints";
import { SlidesPanel } from "./SlidesPanel";
import { UserMenu } from "../app/UserMenu";
import { Tip } from "../ui/tip";
import { BarPlace, besideTitle, useNameAbove } from "../app/BarPlace";
import { useDeviceType } from "../data/device";

// Classic: the playlist page, menu and controls of the old Norless.

/**
 * At the top of a community's pages in Classic: the menu, the open playlist's title
 *, the community, and the account at the right end
 *.
 */
export function ClassicBar() {
  const { t } = useTranslation();
  const { name } = useCommunity();
  const above = useNameAbove(useDeviceType().deviceType === "phone");
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  // Going to another page closes the menu.
  const [seen, setSeen] = useState(location);
  if (location !== seen) {
    setSeen(location);
    setOpen(false);
  }
  const menu = (
    <Button
      isIconOnly
      variant="ghost"
      aria-label={t("app.menu")}
      onPress={() => setOpen(true)}
    >
      <Menu className="size-6" />
    </Button>
  );
  // The community's name gives way first to a long title.
  const home = (
    <Link
      href="/"
      className={`min-w-0 shrink-[100] truncate text-lg font-semibold ${besideTitle}`}
    >
      {name}
    </Link>
  );
  return (
    <div className="group/bar flex flex-col pt-2">
      {above && (
        <Link href="/" className="truncate text-center text-xs text-muted">
          {name}
        </Link>
      )}
      <div className="flex items-center gap-2">
        {menu}
        <BarPlace place="title" />
        {!above && home}
        <div className="ms-auto flex shrink-0 items-center gap-2">
          <UserMenu compact />
        </div>
      </div>
      {/* Gone at once when closed, so a page it opens can take the focus. */}
      {open && (
        <Drawer.Backdrop isOpen onOpenChange={setOpen}>
          <Drawer.Content placement="left">
            <Drawer.Dialog aria-label={t("app.menu")}>
              {/* A way to close it with the mouse, besides Escape and the backdrop. */}
              <Tip label={t("editor.close")}>
                <Drawer.CloseTrigger aria-label={t("editor.close")} />
              </Tip>
              <Drawer.Header>
                <Drawer.Heading>{name}</Drawer.Heading>
              </Drawer.Header>
              <Drawer.Body>
                <ClassicMenu close={() => setOpen(false)} />
              </Drawer.Body>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      )}
    </div>
  );
}

/** The old app's menu: playlists, a new song, who is online, and the rest. */
function ClassicMenu({ close }: { close: () => void }) {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const roles = useRoles(slug);
  const isMember = useIsMember(slug);
  const shows = useShows();
  const [location, navigate] = useLocation();
  const current = /^\/playlists\/([^/]+)/.exec(location)?.[1];
  const [filter, setFilter] = useState("");
  const [archived, setArchived] = useState(false);
  return (
    // Following a link closes the menu, even to the page already open.
    <div
      className="flex flex-col gap-4"
      onClick={(event) =>
        (event.target as Element).closest("a") ? close() : undefined
      }
    >
      <LanguagePicker />
      {hasRole(roles, "editor") && (
        <Button
          variant="secondary"
          onPress={() => {
            close();
            navigate(current ? `/playlists/${current}?new-song` : "/songs/new");
          }}
        >
          <Plus />
          {t("classic.newSong")}
        </Button>
      )}
      {hasRole(roles, "team") && (
        <nav aria-label={t("playlists.title")} className="flex flex-col gap-2">
          <NewPlaylistButton />
          <TextField
            aria-label={t("playlists.filter")}
            value={filter}
            onChange={setFilter}
          >
            <Input placeholder={t("playlists.filter")} />
          </TextField>
          <ShowArchived isSelected={archived} onChange={setArchived} />
          <PlaylistList
            current={current}
            creators
            pageSize={10}
            query={filter}
            archived={archived}
          />
        </nav>
      )}
      {/* Named, so the avatars don't stand alone. */}
      {isMember && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-muted">
            {t("presence.online")}
          </h3>
          <OnlineMembers />
        </section>
      )}
      {/* Owners send theirs from the Ideas page, so the menu lists it once. */}
      {isMember && !hasRole(roles, "owner") && shows("feedback") && (
        <FeedbackButton className="h-auto min-w-0 justify-start p-0" />
      )}
      <nav aria-label={t("classic.more")} className="flex flex-col gap-2">
        {hasRole(roles, "owner") && (
          <>
            {shows("feedback") && (
              <Link href="/ideas" className="link">
                <Lightbulb />
                {t("feedback.title")}
              </Link>
            )}
            {shows("changes") && (
              <Link href="/changes" className="link">
                <FileClock />
                {t("changes.title")}
              </Link>
            )}
            <Link href="/settings" className="link">
              <Settings />
              {t("settings.title")}
            </Link>
          </>
        )}
        {isMember && (
          <Link href="/features" className="link">
            <ListTree />
            {t("featureTree.title")}
          </Link>
        )}
        <Link href="~/privacy" className="link">
          <Shield />
          {t("privacy.title")}
        </Link>
        <Link href="~/about" className="link">
          <Info />
          {t("about.title")}
        </Link>
        <InstallLink />
      </nav>
    </div>
  );
}

/**
 * The playlist and the selected entry's slides side by side from 750 px, the song editor
 * in the slides' place while a song is edited. The window doesn't scroll, each column
 * does. Narrower, one at a time, and the page scrolls.
 */
export function ClassicColumns({
  top,
  playlist,
  entry,
  title,
  isLive,
  liveSlide,
  onGo,
  column,
  onBack,
  canEditSongs,
  editor,
  onEdit,
  aside,
}: {
  /** Above the playlist and staying there: its title and the search box. */
  top: React.ReactNode;
  playlist: React.ReactNode;
  entry: Entry | null;
  /** The selected entry's title. */
  title: string;
  /** The selected entry is on the screens. */
  isLive: boolean;
  /** The slide on the screens, when the selected entry is live. */
  liveSlide: number | null;
  /** For the team: sends the entry's slide live. */
  onGo?: (
    entryId: string,
    slide: number | undefined,
    via: Via<"live.go">,
  ) => void;
  /** What a narrow page shows when no song is being edited. */
  column: "playlist" | "slides";
  onBack: () => void;
  canEditSongs: boolean;
  /** The song editor, while a song is being edited. */
  editor: React.ReactNode;
  onEdit: (songId: string) => void;
  /** In the slides' place while no entry is selected, e.g. suggestions for an empty playlist. */
  aside?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const searchHint = useHintAnchor("search");
  const goLiveHint = useHintAnchor("goLive");
  const shown = editor ? "slides" : column;
  const narrow = (name: string) => (shown === name ? "" : "max-[749px]:hidden");
  return (
    <div className="gap-4 min-[750px]:grid min-[750px]:min-h-0 min-[750px]:flex-1 min-[750px]:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] min-[750px]:grid-rows-[minmax(0,1fr)]">
      <div className={`flex min-w-0 flex-col gap-3 ${narrow("playlist")}`}>
        <div ref={searchHint} className="flex flex-col gap-3">
          {top}
        </div>
        <div
          ref={goLiveHint}
          className="min-[750px]:min-h-0 min-[750px]:flex-1 min-[750px]:overflow-y-auto"
        >
          {playlist}
        </div>
      </div>
      <div
        className={`flex min-w-0 flex-col gap-3 min-[750px]:overflow-y-auto ${narrow("slides")}`}
      >
        {editor || (!entry && aside) || (
          <>
            <div className="flex items-center gap-2">
              <Button
                isIconOnly
                variant="ghost"
                className="min-[750px]:hidden"
                aria-label={t("classic.back")}
                onPress={onBack}
              >
                <ArrowLeft className="size-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-xl font-semibold">{title}</h3>
                {/* Members only; the line stays while empty, so the slides don't move. */}
                {entry && "addedBy" in entry && (
                  <p className="min-h-5 truncate text-sm text-muted">
                    {entry.addedBy &&
                      t("playlist.addedBy", { name: entry.addedBy })}
                  </p>
                )}
              </div>
              {canEditSongs && entry?.song && !entry.song.deleted && (
                <Button
                  isIconOnly
                  variant="ghost"
                  aria-label={t("editor.editSong")}
                  onPress={() => entry.song && onEdit(entry.song.id)}
                >
                  <Pencil className="size-5" />
                </Button>
              )}
              {onGo &&
                entry &&
                entry.kind !== "divider" &&
                !entry.song?.deleted && (
                  // Going live moves nothing, the edit button included.
                  <GoLive
                    isLive={isLive}
                    onGo={() => onGo(entry.id, undefined, "go-button")}
                  />
                )}
            </div>
            <SlidesPanel
              entry={entry}
              live={liveSlide}
              onGo={onGo && ((entryId, slide) => onGo(entryId, slide, "slide"))}
            />
          </>
        )}
      </div>
    </div>
  );
}
