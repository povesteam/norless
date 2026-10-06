import type { LiveView } from "../../server/live/live-view";
import type { LiveAction } from "../../shared/live";

/** What an action does to the live view, when it can be told without the server. */
export function guessAfter(
  view: LiveView,
  action: LiveAction,
): LiveView | null {
  if (!view.entryId) return null;
  const at = (slide: number) =>
    slide >= 0 && slide < view.slides ? { ...view, slide, blank: false } : null;
  switch (action.type) {
    case "go":
      return action.entryId === view.entryId ? at(action.slide ?? 0) : null;
    case "next":
      return at(view.slide + 1);
    case "previous":
      return at(view.slide - 1);
    case "blank":
      return {
        ...view,
        blank: action.blank,
        page: action.blank ? null : view.page,
      };
    default:
      return null;
  }
}
