import { BookOpen, Check, Monitor, MonitorPlay, QrCode } from "lucide-react";
import { Button, Dropdown, Header, Label } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Screen } from "../../shared/screens";
import { useCommunity, useShows } from "../data/community";
import { BibleComSettings } from "../playlists/BibleCom";
import { useJson } from "../data/fetch";
import { useChanges } from "../data/changes";
import { ScreenIcon } from "../ui/icons";
import { PairDevices } from "../account/Pairing";
import { displaysOf, openScreen, remembered, type Display } from "./windows";

/** A menu with the community's screens, each opened with one click on its display. */
export function ScreenLauncher() {
  const { t } = useTranslation();
  const { slug } = useCommunity();
  const shows = useShows();
  const screens = useJson<Screen[]>(
    `/api/communities/${slug}/screens`,
    useChanges(slug, "screens"),
  ).data;
  const [displays, setDisplays] = useState<Display[]>();
  const [pairing, setPairing] = useState(false);
  const [bibleCom, setBibleCom] = useState(false);
  if (!screens) return null;
  const canChoose = "getScreenDetails" in window;
  return (
    <>
      <Dropdown>
        <Button size="sm" variant="tertiary">
          <MonitorPlay />
          {t("screens.title")}
        </Button>
        <Dropdown.Popover placement="top end">
          <Dropdown.Menu
            aria-label={t("screens.title")}
            onAction={(key) => {
              const [action, id, display] = String(key).split(":");
              const screen = screens.find((s) => s.id === id);
              if (action === "choose") void displaysOf(true).then(setDisplays);
              else if (action === "pair") setPairing(true);
              else if (action === "bible-com") setBibleCom(true);
              else if (screen)
                void openScreen(
                  screen,
                  display === undefined
                    ? undefined
                    : displays?.[+display]?.label,
                );
            }}
          >
            {displays && displays.length > 1 ? (
              screens.map((screen) => (
                <Dropdown.Section key={screen.id}>
                  <Header>{screen.name}</Header>
                  {displays.map((display, i) => (
                    <Dropdown.Item
                      key={i}
                      id={`open:${screen.id}:${i}`}
                      textValue={t("screens.display", { n: i + 1 })}
                    >
                      <Monitor />
                      <Label>{t("screens.display", { n: i + 1 })}</Label>
                      {remembered(screen.id) === display.label && <Check />}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Section>
              ))
            ) : (
              <>
                {screens.map((screen) => (
                  <Dropdown.Item
                    key={screen.id}
                    id={`open:${screen.id}`}
                    textValue={t("screens.openNamed", { name: screen.name })}
                  >
                    <ScreenIcon type={screen.type} />
                    <Label>
                      {t("screens.openNamed", { name: screen.name })}
                    </Label>
                  </Dropdown.Item>
                ))}
                {canChoose && screens.length > 0 && (
                  <Dropdown.Item
                    id="choose"
                    textValue={t("screens.chooseDisplay")}
                  >
                    <Monitor />
                    <Label>{t("screens.chooseDisplay")}</Label>
                  </Dropdown.Item>
                )}
              </>
            )}
            {screens.length > 0 && (
              <Dropdown.Item id="pair" textValue={t("pair.menu")}>
                <QrCode />
                <Label>{t("pair.menu")}</Label>
              </Dropdown.Item>
            )}
            {shows("screens") && (
              <Dropdown.Item id="bible-com" textValue={t("bibleCom.menu")}>
                <BookOpen />
                <Label>{t("bibleCom.menu")}</Label>
              </Dropdown.Item>
            )}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      {pairing && (
        <PairDevices screens={screens} onClose={() => setPairing(false)} />
      )}
      {bibleCom && <BibleComSettings onClose={() => setBibleCom(false)} />}
    </>
  );
}
