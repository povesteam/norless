import { Button, Chip, Popover } from "@heroui/react";
import {
  ChevronLeft,
  ChevronRight,
  Ellipsis,
  MonitorPlay,
  Projector,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Tip } from "../ui/tip";
import type { LiveView } from "../../server/live/live-view";
import type { Screen } from "../../shared/screens";
import { useCommunity } from "../data/community";
import { Previews } from "./ControllerViews";
import { useDeviceType } from "../data/device";
import { useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { LanguageFlag, languageCode } from "../ui/icons";
import { MediaKeys } from "./MediaKeys";
import { BlankButton, useLiveTitle } from "./LiveBar";
import { LocalProjection, type ProjectHere } from "./LocalProjection";
import { Pages } from "./Pages";
import { sendLive, useLocal } from "../data/room";
import { useHintAnchor } from "./hints";
import { isOpen, oneDisplay, openFullScreen } from "./windows";

/**
 * At the bottom, for the team: each projector by its name, the Pages menu, and while an
 * entry is live, Blank (Show again while blank), Previous and Next (icons only on a narrow
 * page, as in the old app; disabled over an empty playlist). On touch devices, a
 * projector's button shows its preview in the page instead of a window. On a phone,
 * everything but Blank, Previous and Next is behind More.
 */
export function ClassicBottomBar({
  view,
  project,
  empty,
}: {
  view: LiveView | undefined;
  project: ProjectHere;
  /** The open playlist has no entries: nothing here to move through. */
  empty: boolean;
}) {
  const { t } = useTranslation();
  const community = useCommunity();
  // Projecting here, its own projector instead of the room's screens and pages.
  const local = useLocal()?.slug === community.slug;
  const touch = useDeviceType().deviceType !== "laptop";
  // The projectors whose preview shows in the page, on touch devices.
  const [previews, setPreviews] = useState<string[]>([]);
  const screens = useJson<Screen[]>(
    `/api/communities/${community.slug}/screens`,
    useChanges(community.slug, "screens"),
  ).data;
  const projectors = screens?.filter((s) => s.type === "projector") ?? [];
  const act = (action: Parameters<typeof sendLive>[1]) =>
    void sendLive(community.slug, action, "button");
  const live = !!view?.entry;
  const { title, where } = useLiveTitle(view);
  const keysHint = useHintAnchor("keys");
  const projectHint = useHintAnchor("project");
  // On a phone, Blank, Previous and Next keep the row; the rest go behind More.
  const phone = useDeviceType().deviceType === "phone";
  // Inside More, the buttons keep their labels.
  const narrow = !phone;
  // A button per projector, named as the screen (or per language without any), which
  // opens it on a laptop and shows its preview in the page on touch.
  const outputs =
    projectors.length > 0
      ? projectors.map((screen) => ({
          key: screen.id,
          name: screen.name,
          languages: screen.languages,
          flag: null,
          url: `/s/${screen.secret}`,
          window: screen.id,
        }))
      : community.languages.map((language) => ({
          key: language,
          name: t("controller.preview", { language: languageCode(language) }),
          languages: [language],
          flag: <LanguageFlag language={language} />,
          url: `/${community.slug}/projector/${language}`,
          window: `projector-${language}`,
        }));
  // The projector pressed on a laptop without a second display: it says so first.
  const [alone, setAlone] = useState<string | null>(null);
  const open = (output: (typeof outputs)[number]) =>
    void openFullScreen(output.url, output.window);
  const others = (
    <>
      {!local &&
        outputs.map((output, i) =>
          touch ? (
            <Button
              key={output.key}
              size="sm"
              variant="tertiary"
              aria-pressed={previews.includes(output.key)}
              onPress={() =>
                setPreviews(
                  previews.includes(output.key)
                    ? previews.filter((k) => k !== output.key)
                    : [...previews, output.key],
                )
              }
            >
              <MonitorPlay />
              {output.name}
            </Button>
          ) : (
            <Popover
              key={output.key}
              isOpen={alone === output.key}
              onOpenChange={(pressed) => {
                if (!pressed) setAlone(null);
                else if (oneDisplay() && !isOpen(output.window))
                  setAlone(output.key);
                else open(output);
              }}
            >
              <Button
                ref={i === 0 ? projectHint : undefined}
                size="sm"
                variant="tertiary"
              >
                <Projector />
                {output.name}
                {output.flag}
              </Button>
              <Popover.Content placement="top start" className="max-w-xs">
                <Popover.Dialog
                  aria-label={output.name}
                  className="flex flex-col items-start gap-2"
                >
                  <p>{t("classic.noProjector")}</p>
                  <Button
                    size="sm"
                    variant="secondary"
                    onPress={() => {
                      setAlone(null);
                      open(output);
                    }}
                  >
                    <Projector />
                    {t("classic.openAnyway")}
                  </Button>
                </Popover.Dialog>
              </Popover.Content>
            </Popover>
          ),
        )}
      {!local && <Pages live={view?.page?.id ?? null} narrow={narrow} />}
      <LocalProjection {...project} narrow={narrow} />
      <MediaKeys view={view} narrow={narrow} />
    </>
  );
  return (
    <div
      data-bottom-bar
      className="sticky bottom-0 z-10 -mx-4 mt-auto flex flex-col gap-2 border-t border-separator bg-background px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
    >
      {touch && previews.length > 0 && (
        <Previews
          languages={outputs
            .filter((o) => previews.includes(o.key))
            .flatMap((o) => o.languages)}
        />
      )}
      {phone && live && (
        // What's live, as the newer frame says it; one line, so nothing moves.
        <p className="flex h-6 min-w-0 items-center gap-2">
          <span className="truncate">
            <span className="font-semibold">{title}</span>
            {where !== title && (
              <span className="text-muted">{` · ${where}`}</span>
            )}
          </span>
          {view?.blank && (
            <Chip size="sm" color="warning" variant="soft">
              {t("live.blanked")}
            </Chip>
          )}
        </p>
      )}
      <div
        className={`flex items-center gap-2 ${phone ? "" : "flex-wrap"} ${
          phone && live ? "[&_button]:h-12" : ""
        }`}
      >
        {phone ? (
          <Popover>
            <Button
              size="sm"
              variant="tertiary"
              isIconOnly={live}
              aria-label={t("classic.more")}
            >
              <Ellipsis />
              {!live && t("classic.more")}
            </Button>
            <Popover.Content placement="top start">
              <Popover.Dialog
                aria-label={t("classic.more")}
                className="flex flex-col items-start gap-2"
              >
                {others}
              </Popover.Dialog>
            </Popover.Content>
          </Popover>
        ) : (
          others
        )}
        {!(phone && live) && <div className="flex-1" />}
        {live && (
          <>
            <BlankButton
              blank={!!view?.blank}
              onPress={() => act({ type: "blank", blank: !view?.blank })}
              labelClassName="max-[749px]:sr-only"
              isDisabled={empty}
            />
            {/* Their names in a tooltip too, which a phone shows on a long press. */}
            <Tip label={t("live.previous")}>
              <Button
                variant="secondary"
                className={phone ? "flex-1" : undefined}
                isDisabled={empty}
                onPress={() => act({ type: "previous" })}
              >
                <ChevronLeft />
                <span className="max-[749px]:sr-only">
                  {t("live.previous")}
                </span>
              </Button>
            </Tip>
            <Tip label={t("live.next")}>
              <Button
                ref={keysHint}
                className={phone ? "flex-1" : undefined}
                isDisabled={empty}
                onPress={() => act({ type: "next" })}
              >
                <span className="max-[749px]:sr-only">{t("live.next")}</span>
                <ChevronRight />
              </Button>
            </Tip>
          </>
        )}
      </div>
    </div>
  );
}
