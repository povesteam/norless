import {
  Button,
  Dropdown,
  Label,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { ChevronDown } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";
import {
  chooseLayout,
  type DevicePreferences,
  type DeviceType,
  deviceTypeFor,
  type LayoutOption,
  layoutsAt,
  type Preferences,
} from "../../shared/preferences";
import { useShows } from "./community";
import { Tip } from "../ui/tip";
import { LayoutIcon } from "../ui/icons";
import { useMe } from "./me";

const OVERRIDE = "norless:device-type";
const VISITOR = "norless:preferences";
const CHANGED = "norless:device"; // fired on this tab when either is written

// Storage can be unavailable (private windows, blocked site data).
const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Kept for this page only.
  }
  window.dispatchEvent(new Event(CHANGED));
};

const parse = (json: string): Preferences => {
  try {
    return JSON.parse(json) as Preferences;
  } catch {
    return {};
  }
};

const touch = () => window.matchMedia("(pointer: coarse)");
const subscribe = (onChange: () => void) => {
  const media = touch();
  window.addEventListener("resize", onChange);
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
    media.removeEventListener("change", onChange);
  };
};
const detected = () =>
  deviceTypeFor({
    width: window.screen.width,
    height: window.screen.height,
    touch: touch().matches,
  });
const current = () => (read(OVERRIDE) as DeviceType | null) ?? detected();
/** The window's width in CSS pixels, following it as it's resized. */
export const useWindowWidth = () =>
  useSyncExternalStore(subscribe, () => window.innerWidth);

/** This device's type, outside React. */
export const currentDeviceType = current;

/**
 * This device's type: detected from the screen and the main input, unless someone set
 * it for this device. `setDeviceType(null)` goes back to the detected type.
 */
export function useDeviceType() {
  const deviceType = useSyncExternalStore(subscribe, current);
  const isDetected = useSyncExternalStore(subscribe, () => !read(OVERRIDE));
  const setDeviceType = useCallback(
    (type: DeviceType | null) =>
      write(OVERRIDE, type === null || type === detected() ? null : type),
    [],
  );
  return { deviceType, isDetected, setDeviceType };
}

/**
 * Preferences for this device's type: a member's from their account, so a new phone
 * gets their phone preferences; a visitor's from this device.
 */
export function useDevicePreferences() {
  const { me, savePreferences } = useMe();
  const { deviceType } = useDeviceType();
  const visitor = useSyncExternalStore(subscribe, () => read(VISITOR) ?? "{}");
  const all: Preferences = me?.user ? me.preferences : parse(visitor);
  const set = (change: DevicePreferences) => {
    const next = { ...all, [deviceType]: { ...all[deviceType], ...change } };
    if (me?.user) savePreferences(next);
    else write(VISITOR, JSON.stringify(next));
  };
  return { preferences: all[deviceType] ?? {}, set };
}

/** The layout a view shows on this device, and a way to choose another. */
export function useLayout<L extends LayoutOption>(
  view: string,
  layouts: readonly L[],
  /** The layout when none was chosen on this device type, e.g. by main instrument. */
  fallback?: (deviceType: string) => string | undefined,
) {
  const { deviceType } = useDeviceType();
  const { preferences, set } = useDevicePreferences();
  // A choice the switches don't offer is kept for when they do.
  const layout = chooseLayout(
    layoutsAt(layouts, useShows()),
    deviceType,
    preferences.layouts?.[view] ?? fallback?.(deviceType),
  );
  const setLayout = (id: string) =>
    set({ layouts: { ...preferences.layouts, [view]: id } });
  return { layout, setLayout };
}

/** The layouts made for this device type, to choose among; nothing when there's one. */
export function LayoutPicker({
  layouts,
  layout,
  onChange,
  label,
  names,
  menu = false,
}: {
  layouts: readonly LayoutOption[];
  layout: string;
  onChange: (id: string) => void;
  label: string;
  names: (id: string) => string;
  /** One button naming the layout, with a menu of the others, where room is short. */
  menu?: boolean;
}) {
  const { deviceType } = useDeviceType();
  const offered = layoutsAt(layouts, useShows()).filter((l) =>
    l.devices.includes(deviceType),
  );
  if (offered.length < 2) return null;
  if (menu)
    return (
      <Dropdown>
        {deviceType === "phone" ? (
          // Its icon alone on a phone, as the stage views'.
          <Tip label={names(layout)}>
            <Button
              isIconOnly
              size="sm"
              variant="secondary"
              aria-label={`${label}: ${names(layout)}`}
            >
              <LayoutIcon id={layout} />
            </Button>
          </Tip>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            aria-label={`${label}: ${names(layout)}`}
          >
            <LayoutIcon id={layout} />
            {names(layout)}
            <ChevronDown />
          </Button>
        )}
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu
            aria-label={label}
            selectionMode="single"
            selectedKeys={[layout]}
            onSelectionChange={(keys) => {
              const [key] = keys === "all" ? [] : keys;
              if (key !== undefined) onChange(String(key));
            }}
          >
            {offered.map((l) => (
              <Dropdown.Item key={l.id} id={l.id} textValue={names(l.id)}>
                <Dropdown.ItemIndicator type="dot" />
                <LayoutIcon id={l.id} />
                <Label>{names(l.id)}</Label>
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    );
  return (
    <ToggleButtonGroup
      aria-label={label}
      selectionMode="single"
      disallowEmptySelection
      size="sm"
      selectedKeys={[layout]}
      onSelectionChange={(keys) => {
        const [key] = keys;
        if (key !== undefined) onChange(String(key));
      }}
    >
      {offered.map((l, i) => (
        <ToggleButton key={l.id} id={l.id}>
          {i > 0 && <ToggleButtonGroup.Separator />}
          <LayoutIcon id={l.id} />
          {names(l.id)}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
