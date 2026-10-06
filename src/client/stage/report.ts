import { useEffect } from "react";
import type { StageView } from "../../shared/live";
import { live } from "../data/connection";

/**
 * Tells the members' presence what this stage view shows, so the
 * Big screen draws its tile; again after a reconnect, and nothing once it closes.
 * A changed view (the community's languages arriving, a new layout) replaces the
 * last one: saying "nothing" in between would drop the device and add it again, and
 * the Big screen would draw its tile anew.
 */
export function useReportStageView(slug: string, view: StageView | null) {
  const json = JSON.stringify(view);
  useEffect(() => {
    const shown = JSON.parse(json) as StageView | null;
    if (!shown) return;
    const report = () =>
      live.send({ type: "stage-view", community: slug, view: shown });
    report();
    return live.onStatus(() => {
      if (live.status() === "connected") report();
    });
  }, [slug, json]);
  const showing = json !== "null";
  useEffect(() => {
    if (!showing) return;
    return () => live.send({ type: "stage-view", community: slug, view: null });
  }, [slug, showing]);
}
