/** What a change is about, for the Changes page's filter. */
export const changeKinds = [
  "songs",
  "playlists",
  "settings",
  "members",
  "recordings",
] as const;
export type ChangeKind = (typeof changeKinds)[number];

const kinds: Record<string, ChangeKind> = {
  songs: "songs",
  song_versions: "songs",
  playlists: "playlists",
  entries: "playlists",
  members: "members",
  recordings: "recordings",
  recording_access: "recordings",
};

/** A logged table's kind; the rest (screens, pages, schedule, rooms, the community) are settings. */
export const kindOf = (table: string): ChangeKind => kinds[table] ?? "settings";
