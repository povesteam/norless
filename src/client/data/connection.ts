import { createLive } from "../live/live";

/** The app's one live connection. */
export const live = createLive(
  `${location.origin.replace(/^http/, "ws")}/api/live`,
);
