import { ArrowLeft, Guitar } from "lucide-react";
import { TempoButton } from "./TempoListener";
import { shows } from "../../shared/features";
import { RecordButton } from "./Recorder";
import { Button, Dropdown, Label } from "@heroui/react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { LayoutIcon } from "../ui/icons";
import { Link } from "wouter";
import { ShareChords } from "../chords/PlayChords";
import { TodayBadge } from "../team/MyNextLine";
import { keyOf } from "../../shared/music/chords";
import { type Community, switchesOf, useChordColors } from "../data/community";
import { useDeviceType, useLayout } from "../data/device";
import {
  defaultLayout,
  instrumentLayouts,
  type Profile,
} from "./instrument-layouts";
import { guitarShapes } from "../../shared/preferences";
import { useLayoutShown, useUsageCommunity } from "../data/usage";
import { useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { StageLookMenu, useStageLook } from "./StageLook";
import { useBarColor } from "../ui/full-screen";
import { hasRole, useMe, useRoles } from "../data/me";
import { useLiveView } from "../data/room";
import { RoomChip } from "../live/PracticeRooms";
import { MusicianDialog } from "../account/MusicianProfile";
import { Tip } from "../ui/tip";
import { Musicians } from "./Musicians";
import { useReportStageView } from "./report";

export const musiciansLayouts = [
  { id: "bar-grid", devices: ["phone", "tablet", "laptop"] },
  { id: "chords", devices: ["phone", "tablet", "laptop"] },
  ...instrumentLayouts,
  // The chord played now, shared by the team's devices.
  {
    id: "live-chord",
    devices: ["phone", "tablet", "laptop"],
    feature: "liveChord",
  },
] as const;

/** The member's musician profile, with the community's note names when they chose none. */
export function useProfile(community: Community | null | undefined): Profile {
  const { me } = useMe();
  const musician = me?.user ? me.preferences.musician : undefined;
  return {
    plays: musician?.instruments ?? [],
    shapes: musician?.shapes?.length ? musician.shapes : guitarShapes,
    naming: musician?.noteNames ?? community?.noteNames ?? "letters",
    colors: useChordColors(community),
  };
}

/** /<community>/musicians: the musicians view on a member's own device, in their layout. */
export function MusiciansPage({ slug }: { slug: string }) {
  const { t, i18n } = useTranslation();
  const community = useJson<Community>(
    `/api/communities/${encodeURIComponent(slug)}`,
    useChanges(slug, "communities"),
  ).data;
  const look = useStageLook();
  const { me } = useMe();
  const main = me?.user ? me.preferences.musician?.main : undefined;
  const { layout, setLayout } = useLayout("musicians", musiciansLayouts, (d) =>
    defaultLayout(main, d),
  );
  const profile = useProfile(community);
  const liveView = useLiveView(slug);
  const { deviceType } = useDeviceType();
  const offered = musiciansLayouts.filter((l) =>
    (l.devices as readonly string[]).includes(deviceType),
  );
  // Asked once, in a dialog: closing it with nothing picked is "Not now", remembered like
  // a seen hint; "What I play" in the Display menu opens it again.
  const { savePreferences } = useMe();
  const switches = community ? switchesOf(community) : null;
  const unasked =
    !!me?.user &&
    !!switches &&
    shows(switches, "instruments") &&
    !me.preferences.musician?.instruments?.length &&
    !me.preferences.hints?.includes("musician");
  const [asking, setAsking] = useState<boolean | null>(null);
  const closeAsking = () => {
    setAsking(false);
    if (unasked && me)
      void savePreferences({
        ...me.preferences,
        hints: [...(me.preferences.hints ?? []), "musician"],
      });
  };
  useUsageCommunity(slug);
  useLayoutShown("musicians", layout?.id);
  useReportStageView(
    slug,
    me?.user
      ? {
          view: "musicians",
          layout: layout?.id ?? "bar-grid",
          languages: [i18n.language, ...(community?.languages ?? [])],
          textSize: look.textSize,
          dark: look.className === "dark",
          device: deviceType,
          profile: {
            plays: profile.plays,
            shapes: profile.shapes,
            naming: profile.naming,
            colors: profile.colors,
          },
        }
      : null,
  );
  const roles = useRoles(slug);
  const canControl = hasRole(roles, "team");
  const root = useRef<HTMLDivElement>(null);
  useBarColor(root, look.className);
  return (
    <div
      ref={root}
      className={`${look.className} fixed inset-0 flex flex-col bg-background text-foreground`}
    >
      {/* One row of icons, so the song has the room. */}
      <header className="flex items-center gap-2 overflow-x-auto border-b border-separator px-3 py-2">
        <Link
          href={`~/${slug}`}
          aria-label={community?.name ?? t("musicians.back")}
          className="link shrink-0"
        >
          <ArrowLeft />
        </Link>
        <RoomChip slug={slug} />
        {me?.user && switches && shows(switches, "mySchedule") && (
          <TodayBadge slug={slug} />
        )}
        {/* Many layouts: a menu, with those for this device type; its icon opens
          it, without an arrow (2026-10-05). */}
        <Dropdown>
          <Tip label={t(`musicians.layouts.${layout?.id ?? "bar-grid"}`)}>
            <Button
              isIconOnly
              size="sm"
              variant="secondary"
              aria-label={`${t("musicians.layout")}: ${t(`musicians.layouts.${layout?.id ?? "bar-grid"}`)}`}
              className="ms-auto shrink-0"
            >
              <LayoutIcon id={layout?.id ?? "bar-grid"} />
            </Button>
          </Tip>
          <Dropdown.Popover placement="bottom end" className="min-w-56">
            <Dropdown.Menu
              aria-label={t("musicians.layout")}
              selectionMode="single"
              selectedKeys={[layout?.id ?? "bar-grid"]}
              onSelectionChange={(keys) => {
                const [key] = keys === "all" ? [] : keys;
                if (key !== undefined) setLayout(String(key));
              }}
            >
              {offered.map((l) => (
                <Dropdown.Item
                  key={l.id}
                  id={l.id}
                  textValue={t(`musicians.layouts.${l.id}`)}
                >
                  <Dropdown.ItemIndicator type="dot" />
                  <LayoutIcon id={l.id} />
                  <Label>{t(`musicians.layouts.${l.id}`)}</Label>
                </Dropdown.Item>
              ))}
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
        {canControl && switches && shows(switches, "recordings") && (
          <RecordButton slug={slug} compact />
        )}
        {canControl && switches && shows(switches, "liveChord") && (
          <ShareChords
            slug={slug}
            songKey={keyOf(
              liveView?.entry?.keySignature ||
                liveView?.song?.keySignature ||
                "",
            )}
          />
        )}
        {canControl &&
          community &&
          shows(switchesOf(community), "tempoCheck") && (
            <TempoButton
              slug={slug}
              view={liveView}
              settings={community.tempoCheck}
              compact
            />
          )}
        <StageLookMenu>
          {me?.user && switches && shows(switches, "instruments") && (
            <Button
              size="sm"
              variant="secondary"
              // Closes the Display panel, under the dialog.
              slot="close"
              onPress={() => setAsking(true)}
            >
              <Guitar />
              {t("instruments.whatIPlay")}
            </Button>
          )}
        </StageLookMenu>
      </header>
      {(asking ?? unasked) && <MusicianDialog onClose={closeAsking} />}
      {/* The text size scales the whole layout, as reading glasses would. */}
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{ zoom: look.textSize }}
      >
        <Musicians
          slug={slug}
          languages={[i18n.language, ...(community?.languages ?? [])]}
          layout={layout?.id ?? "bar-grid"}
          canControl={canControl}
          canEdit={hasRole(roles, "team") || hasRole(roles, "editor")}
          profile={profile}
          lookAhead
          wheel={!!community && shows(switchesOf(community), "chordWheel")}
          leader={!!community && shows(switchesOf(community), "ledBy")}
        />
      </div>
    </div>
  );
}
