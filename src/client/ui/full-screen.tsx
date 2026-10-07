import { Button } from "@heroui/react";
import { Maximize } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Tip } from "./tip";

/** True after 3 seconds without a touch or pointer movement, until the next one. */
export function useStill() {
  const [still, setStill] = useState(false);
  useEffect(() => {
    let timer = setTimeout(() => setStill(true), 3000);
    const moved = () => {
      setStill(false);
      clearTimeout(timer);
      timer = setTimeout(() => setStill(true), 3000);
    };
    window.addEventListener("pointermove", moved);
    window.addEventListener("pointerdown", moved);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", moved);
      window.removeEventListener("pointerdown", moved);
    };
  }, []);
  return still;
}

const onFullScreenChange = (onChange: () => void) => {
  document.addEventListener("fullscreenchange", onChange);
  return () => document.removeEventListener("fullscreenchange", onChange);
};

/**
 * Full screen, an icon in a corner, while the view isn't still (screens spec): not while already
 * full screen, nor where the browser can't (an iPhone).
 */
export function FullScreenButton() {
  const { t } = useTranslation();
  const still = useStill();
  const full = useSyncExternalStore(
    onFullScreenChange,
    () => !!document.fullscreenElement,
  );
  if (still || full || !document.fullscreenEnabled) return null;
  return (
    <Tip label={t("screen.fullscreen")}>
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        aria-label={t("screen.fullscreen")}
        className="absolute end-4 top-4 z-10 bg-white/10 text-white/80"
        onPress={() => void document.documentElement.requestFullscreen()}
      >
        <Maximize />
      </Button>
    </Tip>
  );
}

/**
 * While the view shows, the phone's status and address bars take its background color
 * (`theme-color`; screens spec). `key` names what changes that color, to read it again.
 */
export function useBarColor(
  /** The view's root; null when it doesn't fill the page (a preview). */
  view: React.RefObject<HTMLElement | null> | null,
  key: string,
) {
  useEffect(() => {
    if (!view?.current) return;
    const color = getComputedStyle(view.current).backgroundColor;
    // A transparent overlay leaves the bars alone.
    if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)")
      return;
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = color;
    // The first theme-color that matches wins, so this one goes before index.html's.
    document.head.prepend(meta);
    return () => meta.remove();
  }, [view, key]);
}

/**
 * The phone's status and navigation bars in the app's own background, which its light or
 * dark mode and the community's colors set, not only the system's mode (app-shell spec).
 * Rendered once in the app's frame; a view that fills the page puts its own color first.
 */
export function AppBarColor() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    const paint = () => {
      const color = getComputedStyle(document.body).backgroundColor;
      if (color && color !== "rgba(0, 0, 0, 0)") meta.content = color;
    };
    paint();
    // Before index.html's, which follow only the system's mode.
    document.querySelector('meta[name="theme-color"]')?.before(meta);
    // The mode and the community's colors change classes on the page and styles in it.
    const watch = new MutationObserver(paint);
    watch.observe(document.documentElement, { attributes: true });
    watch.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => {
      watch.disconnect();
      meta.remove();
    };
  }, []);
  return null;
}

/**
 * While `locked`, the page behind a full-page menu holds still: a scroll that reaches the
 * menu's end doesn't move it.
 */
export function usePageHeld(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = before;
    };
  }, [locked]);
}
