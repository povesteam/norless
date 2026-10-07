import { useEffect } from "react";
import type { Screen } from "../../shared/screens";

/** A display, from the Window Management API in Chromium browsers. */
export type Display = {
  label: string;
  isPrimary: boolean;
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
};
/**
 * The displays, where the browser can tell. Only `ask` lets the browser ask for the
 * permission; otherwise, before it's granted, there are none, so opening a screen or
 * projecting locally never brings up a permission prompt.
 */
export async function displaysOf(ask = false): Promise<Display[]> {
  const details = (
    window as Window & {
      getScreenDetails?: () => Promise<{ screens: Display[] }>;
    }
  ).getScreenDetails;
  if (!details) return [];
  if (!ask) {
    const permission = await navigator.permissions
      .query({ name: "window-management" as PermissionName })
      .catch(() => null);
    if (permission?.state !== "granted") return [];
  }
  return details
    .call(window)
    .then((d) => d.screens)
    .catch(() => []);
}

export const remembered = (screenId: string) => {
  try {
    return localStorage.getItem(`norless:display:${screenId}`);
  } catch {
    return null;
  }
};
const remember = (screenId: string, label: string) => {
  try {
    localStorage.setItem(`norless:display:${screenId}`, label);
  } catch {
    // Chosen again next time.
  }
};

/** The windows opened from this page, by key, so opening one again brings it forward. */
const opened = new Map<string, Window>();

/** Whether a window opened for `key` from this page is still open. */
export const isOpen = (key: string) => {
  const win = opened.get(key);
  return !!win && !win.closed;
};

/** Whether the browser knows this device has only its own display (Chromium); elsewhere it can't tell. */
export const oneDisplay = () =>
  (window.screen as typeof window.screen & { isExtended?: boolean })
    .isExtended === false;

/**
 * Opens a page full screen on a display, where the browser lets pages choose one
 * (Chromium): on `display`, else on the one chosen before for `key` on this device, else
 * on the first that isn't the laptop's own. Without one, or elsewhere, it opens in a new
 * window of half the screen, in its middle, which has a fullscreen button: full screen,
 * or the browser's own size for a window, on the laptop's own display would cover the
 * controller. A window already open for `key` comes forward instead, so a
 * second click doesn't make a second projector; choosing a display moves it there.
 */
export async function openOnDisplay(
  url: string,
  key: string,
  display?: string,
) {
  const open = opened.get(key);
  if (open && !open.closed) {
    if (display === undefined) {
      open.focus();
      return open;
    }
    open.close();
  }
  const displays = await displaysOf();
  const label = display ?? remembered(key);
  const target =
    displays.find((d) => d.label === label) ??
    displays.find((d) => !d.isPrimary);
  if (target) remember(key, target.label);
  const here = window.screen as typeof window.screen & {
    availLeft?: number;
    availTop?: number;
  };
  const half = {
    left: (here.availLeft ?? 0) + here.availWidth / 4,
    top: (here.availTop ?? 0) + here.availHeight / 4,
    width: here.availWidth / 2,
    height: here.availHeight / 2,
  };
  // Named, so even after this page reloads the same window is reused.
  const win = window.open(
    url,
    `norless-${key}`,
    target
      ? `popup,fullscreen,left=${target.availLeft},top=${target.availTop},width=${target.availWidth},height=${target.availHeight}`
      : `popup,left=${half.left},top=${half.top},width=${half.width},height=${half.height}`,
  );
  if (win) opened.set(key, win);
  return win;
}

/** The keys that drive what's live. */
const liveKeys = new Set([
  "PageUp",
  "PageDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Escape",
  "Enter",
]);

/**
 * In a window the controller opened (a projector on the second display): the live keys
 * reach the controller's page as if pressed there, so a clicker or the keyboard works
 * whichever window has the focus.
 */
export function usePassKeysToOpener(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!liveKeys.has(event.key) || event.ctrlKey || event.metaKey) return;
      let opener: (Window & typeof globalThis) | null;
      try {
        // Another site's window can't be reached.
        opener = window.opener?.document ? window.opener : null;
      } catch {
        return;
      }
      if (!opener || opener.closed) return;
      event.preventDefault();
      opener.document.dispatchEvent(
        new opener.KeyboardEvent("keydown", {
          key: event.key,
          altKey: event.altKey,
          shiftKey: event.shiftKey,
          bubbles: true,
          cancelable: true,
        }),
      );
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}

export const openScreen = (screen: Screen, display?: string) =>
  openOnDisplay(`/s/${screen.secret}`, screen.id, display);

/**
 * Opens a page full screen on the projector: the first time, the browser asks to let
 * Norless place windows (Chromium); without that, a window the operator moves there.
 */
export async function openFullScreen(url: string, key: string) {
  const permission = await navigator.permissions
    .query({ name: "window-management" as PermissionName })
    .catch(() => null);
  if (permission?.state === "prompt") await displaysOf(true);
  return openOnDisplay(url, key);
}
