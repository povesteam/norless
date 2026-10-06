import { useEffect, useEffectEvent } from "react";
import type { Entry } from "../../server/playlists/playlists";
import { type LiveVia, sendLive } from "../data/room";

const inTextField = (target: EventTarget | null) =>
  target instanceof Element &&
  !!target.closest("input, textarea, select, [contenteditable], [role=dialog]");

/**
 * Up and Down select, Alt+Up and Alt+Down move, Delete or Backspace removes; never
 * while typing. Captured, so the list doesn't move its focus on Alt+arrows.
 * For the team, Enter sends the selected entry live, PageDown and Right go next,
 * PageUp and Left previous, Esc blanks; PageUp and PageDown even while typing.
 */
export function usePlaylistKeys({
  slug,
  controls,
  canChange,
  entries,
  selected,
  setSelected,
  move,
  remove,
}: {
  slug: string;
  /** Whether this device controls what's live. */
  controls: boolean;
  canChange: boolean;
  entries: Entry[];
  selected: string | null;
  setSelected: (id: string) => void;
  move: (from: number, to: number) => void;
  remove: (entryId: string) => Promise<unknown>;
}) {
  const selectedIndex = entries.findIndex((e) => e.id === selected);
  // Listening once, with this render's values, so no key falls between a render's
  // removing the listener and the next one's adding it.
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (event.ctrlKey || event.metaKey) return;
    const typing = inTextField(event.target);
    // A key on the projector's window comes from it, made up; clickers send PageUp and PageDown.
    const key = (way: "key" | "clicker") =>
      event.isTrusted ? way : "projector-key";
    const live = (action: Parameters<typeof sendLive>[1], via: LiveVia) => {
      event.preventDefault();
      event.stopPropagation();
      void sendLive(slug, action, via);
    };
    if (controls && event.key === "PageDown")
      return live({ type: "next" }, key("clicker"));
    if (controls && event.key === "PageUp")
      return live({ type: "previous" }, key("clicker"));
    if (typing) return;
    if (controls && event.key === "ArrowRight")
      return live({ type: "next" }, key("key"));
    if (controls && event.key === "ArrowLeft")
      return live({ type: "previous" }, key("key"));
    if (controls && event.key === "Escape")
      return live({ type: "blank", blank: true }, key("key"));
    // Enter on a button or link presses it instead.
    const onControl =
      event.target instanceof Element &&
      !!event.target.closest("button, a, [role=button], [role=menuitem]");
    if (controls && event.key === "Enter" && selected && !onControl)
      return live({ type: "go", entryId: selected }, "enter");
    const step =
      event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (step && event.altKey) {
      if (!canChange || selectedIndex < 0) return;
      event.preventDefault();
      event.stopPropagation();
      move(selectedIndex, selectedIndex + step);
    } else if (step) {
      // The list moves its own selection.
      if ((event.target as Element).closest?.("[role=grid]")) return;
      const next =
        entries[
          Math.min(Math.max(selectedIndex + step, 0), entries.length - 1)
        ];
      if (!next) return;
      event.preventDefault();
      setSelected(next.id);
    } else if (
      (event.key === "Delete" || event.key === "Backspace") &&
      canChange &&
      selected
    ) {
      event.preventDefault();
      void remove(selected);
    }
  });
  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    document.addEventListener("keydown", listener, true);
    return () => document.removeEventListener("keydown", listener, true);
  }, []);
}
