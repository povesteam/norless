import { useEffect, useSyncExternalStore } from "react";
import { registerSW } from "virtual:pwa-register";
import { showsNothing } from "../../shared/screens";
import { useLocation } from "wouter";
import { live } from "../data/connection";
import { useMe } from "../data/me";
import { useLiveView, useLocalProjection } from "../data/room";

/*
 * New versions (app-shell spec): the service worker keeps the app's files, so it opens
 * offline. After a deploy it finds the new ones, and they wait until the page takes
 * them: controllers and members press Reload on a notice, screens reload by themselves
 * while they show nothing.
 */

/** How many new versions came while this page was open; 0 until one waits. */
let waiting = 0;
const listeners = new Set<() => void>();
let registration: ServiceWorkerRegistration | undefined;
let registered = false;

/** Asks the server whether there's a new version. */
const check = () => void registration?.update().catch(() => {});

/** Installs the service worker, once. */
function register() {
  if (registered || !import.meta.env.PROD || !("serviceWorker" in navigator))
    return;
  registered = true;
  const anotherWaits = () => {
    waiting += 1;
    for (const listener of listeners) listener();
  };
  registerSW({
    onNeedRefresh: anotherWaits,
    onRegisteredSW(_url, found) {
      registration = found;
      // The plugin tells of the first waiting version only; each later one counts too,
      // so a notice closed for one comes back for the next.
      found?.addEventListener("updatefound", () => {
        const next = found.installing;
        next?.addEventListener("statechange", () => {
          if (next.state === "installed" && waiting > 0) anotherWaits();
        });
      });
    },
  });
  // A deploy restarts the server, so every open page reconnects: a good time to ask.
  let connected = live.status() === "connected";
  live.onStatus(() => {
    const now = live.status() === "connected";
    if (now && !connected) check();
    connected = now;
  });
  setInterval(check, 60 * 60_000);
}

/** Screens and devices that project by themselves, logged in or not. */
const screenPath =
  /^\/(s|pair)(\/|$)|^\/[^/]+\/(projector|local|stage|offline)(\/|$)/;

/**
 * The offline cache, for people who are logged in and for screens: a visitor's phone,
 * following along or reading songs, doesn't download the whole app in the background
 *.
 */
export function ServiceWorker() {
  const loggedIn = !!useMe().me?.user;
  const [location] = useLocation();
  const wanted = loggedIn || screenPath.test(location);
  useEffect(() => {
    if (wanted) register();
  }, [wanted]);
  return null;
}

// Pages load their code when first opened. After a deploy, a page opened before it and
// not kept by the service worker asks for files that are gone: it reloads into the new
// version, at most once a minute so a missing file can't make it reload forever.
const RELOADED = "norless:reloadedForNewFiles";
window.addEventListener("vite:preloadError", (event) => {
  try {
    if (Date.now() - Number(sessionStorage.getItem(RELOADED)) < 60_000) return;
    sessionStorage.setItem(RELOADED, String(Date.now()));
  } catch {
    return;
  }
  event.preventDefault();
  location.reload();
});

/** Which new version waits for this page to take it (each later one counts up); 0 for none. */
export const useNewVersion = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => waiting,
  );

/**
 * Reloads the page on the new version: the waiting service worker takes over first, or
 * already did for another page.
 */
export function takeNewVersion() {
  const waiting = registration?.waiting;
  if (!waiting) return location.reload();
  waiting.addEventListener("statechange", () => {
    if (waiting.state === "activated") location.reload();
  });
  waiting.postMessage({ type: "SKIP_WAITING" });
}

/**
 * On a screen or stage device: takes a waiting new version by itself, but only while it
 * shows nothing, so a reload never interrupts a song. `local` for the window a tab
 * projects to.
 */
export function ReloadWhenIdle({
  slug,
  local = false,
}: {
  slug: string;
  local?: boolean;
}) {
  const room = useLiveView(local ? null : slug);
  const own = useLocalProjection(local ? slug : null);
  const waiting = useNewVersion();
  const idle = showsNothing(local ? own : room);
  useEffect(() => {
    if (waiting && idle) takeNewVersion();
  }, [waiting, idle]);
  return null;
}
