import { useEffect, useState, useSyncExternalStore } from "react";
import type { Kept } from "../../server/live/offline";
import { pageUrl } from "../../shared/slides";

/**
 * Offline on one device: a switch per device keeps the songs and the
 * newest playlists in the browser's cache while online, so the installed app projects
 * them without internet. Nothing personal is kept.
 */
const CACHE = "norless-offline";
const keptUrl = (slug: string) => `/api/communities/${slug}/offline`;
const flag = (slug: string) => `norless:offline:${slug}`;

const changed = new EventTarget();
const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** Whether this device keeps the community's songs. */
export const keeps = (slug: string) => read(flag(slug)) === "1";

/** The switch, per device. Off, what was kept goes. */
export function useKeepOffline(slug: string) {
  const on = useSyncExternalStore(
    (listener) => {
      changed.addEventListener("change", listener);
      return () => changed.removeEventListener("change", listener);
    },
    () => keeps(slug),
  );
  const set = (value: boolean) => {
    try {
      if (value) localStorage.setItem(flag(slug), "1");
      else localStorage.removeItem(flag(slug));
    } catch {
      // Kept for this page only.
    }
    changed.dispatchEvent(new Event("change"));
    if (!value) void caches.open(CACHE).then((c) => c.delete(keptUrl(slug)));
  };
  return [on, set] as const;
}

/**
 * Fetches what to keep and puts it in the cache, with the 4K pages of the kept
 * playlists' slides, which the service worker answers with when
 * there's no network (public/push-sw.js); false when it couldn't.
 */
export async function keep(slug: string) {
  const response = await fetch(keptUrl(slug)).catch(() => null);
  if (!response?.ok) return false;
  const cache = await caches.open(CACHE);
  await cache.put(keptUrl(slug), response.clone());
  const kept = (await response.json()) as Kept;
  const pages = kept.playlists.flatMap((p) =>
    p.entries.flatMap((e) =>
      (e.slides?.files ?? []).flatMap((f) =>
        f.state === "ready"
          ? Array.from({ length: f.total ?? 0 }, (_, i) =>
              pageUrl(f.id, i + 1, 3840),
            )
          : [],
      ),
    ),
  );
  for (const page of pages)
    if (!(await cache.match(page))) await cache.add(page).catch(() => null);
  changed.dispatchEvent(new Event("change"));
  return true;
}

/** What this device kept, or null. */
export async function readKept(slug: string): Promise<Kept | null> {
  const response = await caches
    .match(keptUrl(slug), { cacheName: CACHE })
    .catch(() => undefined);
  return response ? ((await response.json()) as Kept) : null;
}

/** What this device kept, following it as it's kept again. */
export function useKept(slug: string) {
  const [kept, setKept] = useState<Kept | null>();
  useEffect(() => {
    const load = () => void readKept(slug).then(setKept);
    load();
    changed.addEventListener("change", load);
    return () => changed.removeEventListener("change", load);
  }, [slug]);
  return kept;
}

/** Letters without accents, in lower case, for searching. */
export const plain = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
