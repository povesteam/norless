import {
  AArrowDown,
  AArrowUp,
  Moon,
  SlidersHorizontal,
  Sun,
  SunMoon,
} from "lucide-react";
import {
  Button,
  Popover,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { useDevicePreferences } from "../data/device";
import { Tip } from "../ui/tip";

const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)");
const subscribe = (onChange: () => void) => {
  const query = systemDark();
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

const SIZES = { smallest: 0.6, largest: 2, step: 0.1 };

/**
 * The look of musicians and vocalists layouts on this device type: dark unless the
 * member chose light or the system's, so a light area can sit in a dark page and the
 * other way round; and a text size.
 */
export function useStageLook() {
  const { preferences, set } = useDevicePreferences();
  const dark = useSyncExternalStore(subscribe, () => systemDark().matches);
  const scheme = preferences.stageScheme ?? "dark";
  const textSize = preferences.textSize ?? 1;
  return {
    scheme,
    textSize,
    /** The theme scope for the layout's root. */
    className: (scheme === "system" ? dark : scheme === "dark")
      ? "dark"
      : "light",
    set,
  };
}

/**
 * A panel to choose dark, light or the system's colors and the text size. A panel, not a
 * menu, so it stays open while the size is tried step by step.
 */
export function StageLookMenu({
  children,
}: {
  /** More of the view's own settings, at the end. */
  children?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const { scheme, textSize, set } = useStageLook();
  const resize = (step: number) =>
    set({
      textSize:
        Math.round(
          Math.min(Math.max(textSize + step, SIZES.smallest), SIZES.largest) *
            10,
        ) / 10,
    });
  return (
    <Popover>
      <Tip label={t("stage.look")}>
        <Button
          size="sm"
          variant="tertiary"
          isIconOnly
          aria-label={t("stage.look")}
        >
          <SlidersHorizontal />
        </Button>
      </Tip>
      <Popover.Content placement="bottom end">
        <Popover.Dialog
          aria-label={t("stage.look")}
          className="flex flex-col gap-3"
        >
          <ToggleButtonGroup
            aria-label={t("stage.colors")}
            selectionMode="single"
            disallowEmptySelection
            size="sm"
            selectedKeys={[scheme]}
            onSelectionChange={(keys) => {
              const [key] = keys;
              if (key === "dark" || key === "light" || key === "system")
                set({ stageScheme: key });
            }}
          >
            {(["dark", "light", "system"] as const).map((id, i) => (
              <ToggleButton key={id} id={id}>
                {i > 0 && <ToggleButtonGroup.Separator />}
                {id === "dark" ? (
                  <Moon />
                ) : id === "light" ? (
                  <Sun />
                ) : (
                  <SunMoon />
                )}
                {t(`stage.${id}`)}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <div
            role="group"
            aria-label={t("stage.textSize", {
              percent: Math.round(textSize * 100),
            })}
            className="flex items-center justify-between gap-2"
          >
            <Button
              size="sm"
              variant="secondary"
              isIconOnly
              aria-label={t("stage.smaller")}
              isDisabled={textSize <= SIZES.smallest}
              onPress={() => resize(-SIZES.step)}
            >
              <AArrowDown />
            </Button>
            <span className="tabular-nums">{Math.round(textSize * 100)}%</span>
            <Button
              size="sm"
              variant="secondary"
              isIconOnly
              aria-label={t("stage.larger")}
              isDisabled={textSize >= SIZES.largest}
              onPress={() => resize(SIZES.step)}
            >
              <AArrowUp />
            </Button>
          </div>
          {children}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
