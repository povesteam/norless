import { useEffect } from "react";
import type {
  UsageBatch,
  UsageEvent,
  UsageFeature,
  Via,
} from "../../shared/usage";
import { currentDeviceType } from "./device";

type Queued = Omit<UsageEvent, "ago"> & { at: number };

const BATCH = 100;

/**
 * Usage events, queued so measuring never slows a click, and sent
 * in batches: every 5 seconds and when the page is hidden. Lost when offline.
 */
export function createUsage(
  send: (batch: UsageBatch) => void,
  {
    now = Date.now,
    deviceType = (): string => "laptop",
  }: { now?: () => number; deviceType?: () => string } = {},
) {
  const queue: Queued[] = [];
  const context: { community?: string; layout?: string } = {};
  return {
    context,
    track<F extends UsageFeature>(
      feature: F,
      detail?: { via?: Via<F> } & Record<string, string | number | boolean>,
    ) {
      // ponytail: a tab left open without a network keeps at most a few batches.
      if (queue.length >= 5 * BATCH) return;
      queue.push({
        feature,
        at: now(),
        ...(context.community && { community: context.community }),
        ...(context.layout && { layout: context.layout }),
        ...(detail && { detail }),
      });
    },
    flush() {
      const time = now();
      while (queue.length) {
        const events = queue.splice(0, BATCH);
        send({
          deviceType: deviceType(),
          events: events.map(({ at, ...event }) => ({
            ...event,
            ago: Math.max(0, time - at),
          })),
        });
      }
    },
  };
}

const usage = createUsage(
  (batch) =>
    // keepalive: sent even while the page closes.
    void fetch("/api/usage", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(batch),
    }).catch(() => {}),
  // Called later: device.tsx and this module import each other through community.tsx.
  { deviceType: () => currentDeviceType() },
);
if (typeof window !== "undefined") {
  setInterval(usage.flush, 5_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") usage.flush();
  });
}

/** Records that a measured feature was used, and how. */
export const track = usage.track;

/** Events from now on belong to the community's pages; none outside them. */
export function useUsageCommunity(slug: string) {
  useEffect(() => {
    usage.context.community = slug;
    return () => {
      delete usage.context.community;
    };
  }, [slug]);
}

/** A view shows a layout: recorded once, and given to the events while it shows. */
export function useLayoutShown(view: string, layout: string | undefined) {
  useEffect(() => {
    if (!layout) return;
    usage.context.layout = layout;
    track("layout.shown", { view });
    return () => {
      if (usage.context.layout === layout) delete usage.context.layout;
    };
  }, [view, layout]);
}
