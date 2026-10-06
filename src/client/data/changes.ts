import { useEffect, useState } from "react";
import { live } from "./connection";

/**
 * A number that goes up when any of `tables` changes in the community, or when the live
 * connection comes back (changes may have been missed), to pass to `useJson` as its
 * version: the view loads what it shows again (live-updates spec).
 */
export function useChanges(
  slug: string | null | undefined,
  ...tables: string[]
) {
  const [count, setCount] = useState(0);
  const watched = tables.join();
  useEffect(() => {
    if (!slug) return;
    const names = watched.split(",");
    // Changes a moment apart load once.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const bump = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setCount((n) => n + 1), 150);
    };
    let wasConnected = live.status() === "connected";
    const stopStatus = live.onStatus(() => {
      const connected = live.status() === "connected";
      if (connected && !wasConnected) bump();
      wasConnected = connected;
    });
    const stopChanges = live.subscribe(`changes:${slug}`, (data) => {
      if ((data as { tables: string[] }).tables.some((t) => names.includes(t)))
        bump();
    });
    return () => {
      clearTimeout(timer);
      stopStatus();
      stopChanges();
    };
  }, [slug, watched]);
  return count;
}
