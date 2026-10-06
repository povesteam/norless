import { useEffect } from "react";
import type { StageView } from "../../shared/live";
import { live } from "../data/connection";

/**
 * Tells the members' presence what this stage view shows, so the
 * Big screen draws its tile; again after a reconnect, and nothing once it closes.
 */
export function useReportStageView(slug: string, view: StageView | null) {
  const json = JSON.stringify(view);
  useEffect(() => {
    const shown = JSON.parse(json) as StageView | null;
    if (!shown) return;
    const report = () =>
      live.send({ type: "stage-view", community: slug, view: shown });
    report();
    const stop = live.onStatus(() => {
      if (live.status() === "connected") report();
    });
    return () => {
      stop();
      live.send({ type: "stage-view", community: slug, view: null });
    };
  }, [slug, json]);
}
