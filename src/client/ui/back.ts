import { useEffect, useEffectEvent, useState } from "react";

/** A back taking a closed thing's entry off, until its popstate comes. */
let settling: Promise<void> | null = null;
/**
 * Takes a closed thing's entry off. The back comes later, so a page opened meanwhile
 * (closing the search to open the song editor) would be the one taken off: until it
 * comes, the router's pushes and replaces wait, then run in order.
 */
const takeOff = () => {
  const { pushState, replaceState } = history;
  const waiting: (() => void)[] = [];
  history.pushState = (...args) =>
    void waiting.push(() => history.pushState(...args));
  history.replaceState = (...args) =>
    void waiting.push(() => history.replaceState(...args));
  const done = new Promise<void>((resolve) =>
    window.addEventListener(
      "popstate",
      () => {
        history.pushState = pushState;
        history.replaceState = replaceState;
        for (const run of waiting) run();
        resolve();
      },
      { once: true },
    ),
  );
  settling = done;
  void done.then(() => {
    if (settling === done) settling = null;
  });
  history.back();
};

/** Once no back is taking an entry off, also one a cleanup in the same commit starts. */
const settled = async () => {
  await Promise.resolve();
  while (settling) await settling;
};

const markOf = () => (history.state as { back?: string } | null)?.back;

/**
 * While `open`, the system back (Android's button or gesture) closes it instead of leaving
 * the page: it has a history entry of its own, which back takes off and `close` follows.
 * Still open after that (one of several things closed), it gets a new entry. Closed
 * another way, it takes its entry back off, unless the page moved on since; a thing
 * opening meanwhile, such as a dialog opened from the search, waits for that back, which
 * would otherwise take its entry instead.
 */
export function useBackCloses(open: boolean, close: () => void) {
  const onBack = useEffectEvent(close);
  const [backs, setBacks] = useState(0);
  useEffect(() => {
    if (!open) return;
    const mark = `${Date.now()}-${Math.random()}`;
    let cancelled = false;
    let pushed = false;
    let popped = false;
    const pop = () => {
      // A later entry came off, not this one.
      if (markOf() === mark) return;
      popped = true;
      onBack();
      setBacks((n) => n + 1);
    };
    void settled().then(() => {
      if (cancelled) return;
      history.pushState({ ...(history.state as object), back: mark }, "");
      pushed = true;
      window.addEventListener("popstate", pop);
    });
    return () => {
      cancelled = true;
      window.removeEventListener("popstate", pop);
      if (pushed && !popped && markOf() === mark) takeOff();
    };
  }, [open, backs]);
}

/** Whether a dialog, menu or list React Aria put over the page is open. */
const overlayOpen = () =>
  [...document.body.children].some(
    (child) =>
      child.id !== "root" &&
      !!child.querySelector(
        '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]',
      ),
  );

/**
 * Back closes the topmost dialog, drawer or menu, as Esc does: React Aria puts each over
 * the page as a child of the body and closes the topmost on Esc, so they need no wiring
 * one by one. Rendered once.
 */
export function BackClosesOverlays() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const watch = new MutationObserver(() => setOpen(overlayOpen()));
    watch.observe(document.body, { childList: true });
    return () => watch.disconnect();
  }, []);
  useBackCloses(open, () =>
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    ),
  );
  return null;
}
